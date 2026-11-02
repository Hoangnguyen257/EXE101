import { NextResponse } from 'next/server'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth/auth-service'
import { validateCsrf } from '@/lib/security/csrf'
import { DOC_TYPE_LABEL } from '@/lib/labels'
import type { DocType } from '@/lib/types'
import { extractTextFromBuffer, extractLogisticsFields } from '@/lib/ocr/ocr-extractor'
import {
  MAX_FILE_SIZE,
  validateComprehensiveUpload,
} from '@/lib/storage/document-storage'
import { getStorageProvider } from '@/lib/storage/storage-provider'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
  const cookieHeader = req.headers.get('cookie')
  const cookieToken = cookieHeader?.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))?.split('=')[1]
  const sessionUser = await getSessionUser(bearerToken || cookieToken)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { pendingUploadId, storageKey } = body

    if (!pendingUploadId && !storageKey) {
      return NextResponse.json(
        { error: 'Thiếu thông tin nhận diện lượt tải lên (pendingUploadId hoặc storageKey).' },
        { status: 400 }
      )
    }

    // 1. Tìm bản ghi PendingUpload trong cơ sở dữ liệu
    const pending = await prisma.pendingUpload.findFirst({
      where: {
        OR: [
          pendingUploadId ? { id: pendingUploadId } : undefined,
          storageKey ? { storageKey: storageKey } : undefined,
        ].filter(Boolean) as any,
        confirmedAt: null,
      },
      include: {
        shipment: true,
      },
    })

    if (!pending) {
      return NextResponse.json(
        { error: 'Yêu cầu tải lên không tồn tại hoặc đã được xác nhận trước đó.' },
        { status: 404 }
      )
    }

    if (pending.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Yêu cầu tải lên đã quá hạn (24 giờ). Vui lòng khởi tạo lại phiên tải mới.' },
        { status: 410 }
      )
    }

    if (!pending.shipment.departmentId) {
      return NextResponse.json(
        { error: 'Lô hàng chưa có phòng ban trực thuộc. Không thể hoàn tất tải lên.' },
        { status: 400 }
      )
    }

    // 2. Kiểm tra tập tin đã thật sự tồn tại trên kho lưu trữ
    const provider = getStorageProvider()
    const exists = await provider.exists(pending.storageKey)
    if (!exists) {
      return NextResponse.json(
        { error: 'Tập tin chưa được tải lên hệ thống lưu trữ đối tượng. Vui lòng thử lại sau.' },
        { status: 400 }
      )
    }

    // 3. Đọc dữ liệu tập tin từ StorageProvider
    const storageData = await provider.get(pending.storageKey)
    const fileBuffer = storageData.buffer

    if (fileBuffer.length > MAX_FILE_SIZE) {
      // Xóa file vượt dung lượng để giải phóng không gian lưu trữ
      await provider.delete(pending.storageKey)
      return NextResponse.json(
        { error: `Tập tin (${(fileBuffer.length / (1024 * 1024)).toFixed(1)}MB) vượt quá dung lượng tối đa cho phép (25MB).` },
        { status: 400 }
      )
    }

    // 4. Kiểm tra chữ ký số nhị phân Magic Bytes & cấu trúc an toàn
    const validation = validateComprehensiveUpload(fileBuffer, pending.fileName, pending.mimeType)
    if (!validation.isValid) {
      await provider.delete(pending.storageKey)
      return NextResponse.json(
        { error: validation.error || 'Nội dung tập tin không hợp lệ hoặc chứa mã độc.' },
        { status: 400 }
      )
    }

    const checksum = validation.checksum

    // 5. Sửa logic chống trùng: Kiểm tra tập tin trùng lặp trong phạm vi lô hàng (Deduplication Check)
    const existingStorageObjects = await prisma.storageObject.findMany({
      where: { checksumSha256: checksum },
      select: { storageKey: true },
    })

    if (existingStorageObjects.length > 0) {
      const matchingKeys = existingStorageObjects.map((s) => s.storageKey)
      const duplicateInShipment = await prisma.document.findFirst({
        where: {
          shipmentId: pending.shipmentId,
          storageKey: { in: matchingKeys },
          isDeleted: false,
        },
      })

      if (duplicateInShipment) {
        // Nếu trùng lặp trong cùng lô, xóa file vừa tải lên để tiết kiệm dung lượng
        await provider.delete(pending.storageKey)
        return NextResponse.json(
          {
            error: `Tập tin ${pending.fileName} đã tồn tại trong lô hàng này (Trùng mã SHA-256: ${checksum.slice(0, 12)}...).`,
            isDuplicate: true,
          },
          { status: 409 }
        )
      }
    }

    // 6. Trích xuất text & thông tin OCR thông minh
    const rawOcrText = extractTextFromBuffer(fileBuffer, pending.fileName)
    const extractedLogistics = extractLogisticsFields(rawOcrText)

    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const displayLabel = pending.docType === 'OTHER' && pending.customTypeName
      ? pending.customTypeName
      : (DOC_TYPE_LABEL[pending.docType as DocType] ?? pending.docType)
    const title = `${displayLabel} ${pending.shipment.jobNo}`
    const ext = path.extname(pending.fileName).toLowerCase()

    // Gói tạo Document + Version + OcrResult + StorageObject trong một transaction
    // Nếu bước DB lỗi -> Xóa file đã upload trên storage để rollback
    let newDoc
    try {
      newDoc = await prisma.$transaction(async (tx) => {
        // 7. Tạo Document chính thức (giữ nguyên fileName gốc để hiển thị)
        const doc = await tx.document.create({
          data: {
            id: docId,
            orgId: pending.orgId,
            shipmentId: pending.shipment.id,
            customerId: pending.shipment.customerId!,
            departmentId: pending.shipment.departmentId!,
            type: pending.docType,
            customTypeName: pending.customTypeName,
            title,
            fileName: pending.fileName,
            fileSizeBytes: fileBuffer.length,
            storageKey: pending.storageKey,
            pages: ext === '.pdf' ? 1 : 1,
            docDate: pending.docDate || new Date().toISOString().slice(0, 10),
            createdBy: sessionUser.id,
            updatedBy: sessionUser.id,
            editedHtml: `<p>${title}</p><p>${rawOcrText.slice(0, 500)}</p>`,
          },
        })

        // 8. Tạo Document Version 1
        const version1 = await tx.documentVersion.create({
          data: {
            documentId: doc.id,
            versionNumber: 1,
            fileName: pending.fileName,
            storageKey: pending.storageKey,
            sizeBytes: fileBuffer.length,
            uploadedBy: sessionUser.id,
            changeNote: 'Tải lên hoàn tất qua Presigned URL',
          },
        })

        // 9. Lưu kết quả OCR vào database
        await tx.documentOcrResult.create({
          data: {
            documentId: doc.id,
            versionId: version1.id,
            status: 'COMPLETED',
            confidenceScore: extractedLogistics.confidenceScore,
            rawText: rawOcrText,
            structuredData: JSON.stringify(extractedLogistics),
          },
        })

        // 10. Đăng ký StorageObject
        await tx.storageObject.upsert({
          where: { storageKey: pending.storageKey },
          update: {
            sizeBytes: fileBuffer.length,
            checksumSha256: checksum,
            mimeType: validation.mimeType || pending.mimeType,
          },
          create: {
            storageKey: pending.storageKey,
            bucket: provider.driver === 's3' ? (process.env.S3_BUCKET || 'tml-storage-vault') : 'tml-vault',
            mimeType: validation.mimeType || pending.mimeType,
            sizeBytes: fileBuffer.length,
            checksumSha256: checksum,
          },
        })

        // 11. Đánh dấu bản ghi PendingUpload đã hoàn tất
        await tx.pendingUpload.update({
          where: { id: pending.id },
          data: { confirmedAt: new Date() },
        })

        // 12. Cập nhật ShipmentRequirement sang UPLOADED
        await tx.shipmentRequirement.updateMany({
          where: { shipmentId: pending.shipmentId, docType: pending.docType },
          data: { status: 'UPLOADED' },
        })

        // 13. Ghi vết kiểm toán Audit Log
        await tx.auditLog.create({
          data: {
            orgId: sessionUser.orgId,
            userId: sessionUser.id,
            action: 'upload',
            resourceType: 'document',
            resourceId: doc.id,
            status: 'SUCCESS',
          },
        })

        return doc
      })
    } catch (dbError: any) {
      // Rollback: nếu bước DB lỗi thì xóa file đã ghi trên storage
      try {
        await provider.delete(pending.storageKey)
      } catch (delErr) {
        console.error('Không thể dọn dẹp file sau lỗi DB confirm transaction:', delErr)
      }
      throw dbError
    }

    return NextResponse.json({
      success: true,
      document: newDoc,
      storageKey: pending.storageKey,
      checksumSha256: checksum,
    })
  } catch (error: any) {
    console.error('Confirm Upload Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Đã xảy ra lỗi khi xác nhận tải lên.' },
      { status: 500 }
    )
  }
}

