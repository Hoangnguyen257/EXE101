import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'
import { DOC_TYPE_LABEL } from '@/lib/labels'
import type { DocType } from '@/lib/types'
import { extractTextFromBuffer, extractLogisticsFields } from '@/lib/ocr/ocr-extractor'

import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
  sanitizeFileName,
  validateComprehensiveUpload,
} from '@/lib/storage/document-storage'
import { getStorageProvider, generateStorageKey } from '@/lib/storage/storage-provider'

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
    const formData = await req.formData()
    const shipmentId = formData.get('shipmentId') as string
    const docType = (formData.get('docType') as string) || 'OTHER'
    const customTypeName = (formData.get('customTypeName') as string) || ''
    const docDate = (formData.get('docDate') as string) || new Date().toISOString().slice(0, 10)
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy file tải lên.' }, { status: 400 })
    }

    if (!shipmentId) {
      return NextResponse.json({ error: 'Vui lòng chọn lô hàng liên kết.' }, { status: 400 })
    }

    // Check shipment
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { customer: true, participants: true },
    })

    if (!shipment) {
      return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
    }

    const effectiveDeptId = shipment.departmentId || sessionUser.departments?.[0]?.id || null

    // Permission check
    const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'UPLOAD', {
      departmentId: effectiveDeptId || undefined,
      ownerId: shipment.ownerId,
      assignedUserIds: shipment.participants.map((p) => p.userId),
    })

    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền tải chứng từ lên lô hàng này.' }, { status: 403 })
    }

    const createdDocs = []

    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return NextResponse.json(
          { error: `Định dạng ${ext} không được hỗ trợ. Chỉ chấp nhận PDF, JPG, PNG.` },
          { status: 400 }
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `Tập tin ${file.name} vượt quá dung lượng tối đa cho phép (25MB).` },
          { status: 400 }
        )
      }

      const fileBuffer = Buffer.from(await file.arrayBuffer())

      // 1. Kiểm tra toàn diện an ninh tập tin (Magic Bytes, MIME, Extension, PDF integrity)
      const uploadValidation = validateComprehensiveUpload(fileBuffer, file.name, file.type)
      if (!uploadValidation.isValid) {
        return NextResponse.json({ error: uploadValidation.error }, { status: 400 })
      }

      // 2. Tính mã băm SHA-256 Checksum
      const checksum = uploadValidation.checksum

      // 3. Sửa logic chống trùng: So sánh checksum trong phạm vi lô hàng
      // Tìm tất cả các storageKey có cùng checksum, sau đó kiểm tra xem lô hàng này đã chứa chứng từ đó chưa
      const existingStorageObjects = await prisma.storageObject.findMany({
        where: { checksumSha256: checksum },
        select: { storageKey: true },
      })

      if (existingStorageObjects.length > 0) {
        const matchingKeys = existingStorageObjects.map((s) => s.storageKey)
        const duplicateInShipment = await prisma.document.findFirst({
          where: {
            shipmentId: shipment.id,
            storageKey: { in: matchingKeys },
            isDeleted: false,
          },
        })

        if (duplicateInShipment) {
          return NextResponse.json(
            {
              error: `Tập tin ${file.name} đã tồn tại trong lô hàng này với nội dung giống hệt (Trùng mã băm SHA-256: ${checksum.slice(0, 12)}...).`,
              isDuplicate: true,
            },
            { status: 409 }
          )
        }
      }

      // Giữ tên file gốc riêng để hiển thị, lưu tên đã sanitize cho storage
      const originalFileName = file.name
      const safeFileName = sanitizeFileName(file.name)
      const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const storageKey = generateStorageKey({ extension: ext })
      const provider = getStorageProvider()

      // Ghi tập tin vật lý trước (nếu ghi file lỗi thì không tạo bản ghi DB)
      let writtenStorageKey: string | null = null
      try {
        await provider.put(storageKey, fileBuffer, uploadValidation.mimeType || file.type)
        writtenStorageKey = storageKey
      } catch (writeErr: any) {
        console.error('Lỗi khi ghi file vào StorageProvider:', writeErr)
        return NextResponse.json({ error: 'Không thể ghi tập tin vào hệ thống lưu trữ.' }, { status: 500 })
      }

      const displayLabel = docType === 'OTHER' && customTypeName ? customTypeName : (DOC_TYPE_LABEL[docType as DocType] ?? docType)
      const title = `${displayLabel} ${shipment.jobNo}`

      // 4. Trích xuất text & OCR Metadata thông minh
      const rawOcrText = extractTextFromBuffer(fileBuffer, file.name)
      const extractedLogistics = extractLogisticsFields(rawOcrText)

      // Gói tạo Document + Version + OcrResult + StorageObject trong một transaction
      // Nếu bước DB lỗi -> Xóa file đã ghi trên storage để tránh rác mồ côi
      let newDoc
      try {
        newDoc = await prisma.$transaction(async (tx) => {
          const doc = await tx.document.create({
            data: {
              id: docId,
              orgId: sessionUser.orgId,
              shipmentId: shipment.id,
              customerId: shipment.customerId || null,
              departmentId: effectiveDeptId,
              type: docType,
              customTypeName: customTypeName || null,
              title,
              fileName: originalFileName,
              fileSizeBytes: file.size,
              storageKey,
              pages: ext === '.pdf' ? 1 : 1,
              docDate,
              createdBy: sessionUser.id,
              updatedBy: sessionUser.id,
              editedHtml: `<p>${title}</p><p>${rawOcrText.slice(0, 500)}</p>`,
            },
          })

          const version1 = await tx.documentVersion.create({
            data: {
              documentId: doc.id,
              versionNumber: 1,
              fileName: originalFileName,
              storageKey,
              sizeBytes: file.size,
              uploadedBy: sessionUser.id,
              changeNote: 'Tải lên ban đầu',
            },
          })

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

          await tx.storageObject.create({
            data: {
              storageKey,
              bucket: provider.driver === 's3' ? (process.env.S3_BUCKET || 'tml-storage-vault') : 'tml-vault',
              mimeType: uploadValidation.mimeType || file.type || (ext === '.pdf' ? 'application/pdf' : 'image/jpeg'),
              sizeBytes: file.size,
              checksumSha256: checksum,
            },
          })

          await tx.shipmentRequirement.updateMany({
            where: { shipmentId: shipment.id, docType: docType },
            data: { status: 'UPLOADED' },
          })

          await tx.auditLog.create({
            data: {
              orgId: sessionUser.orgId,
              userId: sessionUser.id,
              action: 'upload',
              resourceType: 'document',
              resourceId: doc.id,
              status: 'SUCCESS',
              diffJson: JSON.stringify({
                fileName: originalFileName,
                size: file.size,
                checksumSha256: checksum,
                shipment: shipment.jobNo,
                confidenceScore: extractedLogistics.confidenceScore,
              }),
            },
          })

          await tx.syncEvent.create({
            data: {
              orgId: sessionUser.orgId,
              eventType: 'DOCUMENT_CREATED',
              entityType: 'document',
              entityId: doc.id,
              payload: JSON.stringify({
                title,
                shipmentId: shipment.id,
                departmentId: shipment.departmentId,
                docType,
                confidence: extractedLogistics.confidenceScore,
              }),
            },
          })

          return doc
        })
      } catch (dbError: any) {
        // Rollback: nếu bước DB lỗi thì xóa file đã ghi
        if (writtenStorageKey) {
          try {
            await provider.delete(writtenStorageKey)
          } catch (delErr) {
            console.error('Không thể dọn dẹp file mồ côi sau lỗi DB transaction:', delErr)
          }
        }
        throw dbError
      }

      createdDocs.push({
        ...newDoc,
        extracted: extractedLogistics,
      })
    }

    return NextResponse.json({
      success: true,
      count: createdDocs.length,
      documents: createdDocs,
    })
  } catch (error: any) {
    console.error('Lỗi upload chứng từ:', error)
    return NextResponse.json({ error: error.message || 'Lỗi xử lý tải lên.' }, { status: 500 })
  }
}
