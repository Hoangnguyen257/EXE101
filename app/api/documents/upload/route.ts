import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
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

  const sessionUser = await getSessionUser()
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
      include: { customer: true },
    })

    if (!shipment) {
      return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
    }

    // Permission check
    const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'UPLOAD', {
      departmentId: shipment.departmentId,
      ownerId: shipment.ownerId,
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

      // 3. Kiểm tra tệp trùng lặp (Deduplication Check)
      const existingStorage = await prisma.storageObject.findFirst({
        where: { checksumSha256: checksum },
      })

      if (existingStorage) {
        const duplicateInShipment = await prisma.document.findFirst({
          where: { shipmentId: shipment.id, storageKey: existingStorage.storageKey, isDeleted: false },
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

      const safeFileName = sanitizeFileName(file.name)
      const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      const storageKey = generateStorageKey({ extension: ext })
      const provider = getStorageProvider()

      // Ghi tập tin thông qua StorageProvider (hỗ trợ lưu bền vững trên Local disk hoặc S3/R2/MinIO)
      await provider.put(storageKey, fileBuffer, uploadValidation.mimeType || file.type)

      const displayLabel = docType === 'OTHER' && customTypeName ? customTypeName : (DOC_TYPE_LABEL[docType as DocType] ?? docType)
      const title = `${displayLabel} ${shipment.jobNo}`

      // 4. Trích xuất text & OCR Metadata thông minh
      const rawOcrText = extractTextFromBuffer(fileBuffer, file.name)
      const extractedLogistics = extractLogisticsFields(rawOcrText)

      // Tạo Document
      const newDoc = await prisma.document.create({
        data: {
          id: docId,
          orgId: sessionUser.orgId,
          shipmentId: shipment.id,
          customerId: shipment.customerId,
          departmentId: shipment.departmentId,
          type: docType,
          customTypeName: customTypeName || null,
          title,
          fileName: file.name,
          fileSizeBytes: file.size,
          storageKey,
          pages: ext === '.pdf' ? 1 : 1,
          docDate,
          createdBy: sessionUser.id,
          updatedBy: sessionUser.id,
          editedHtml: `<p>${title}</p><p>${rawOcrText.slice(0, 500)}</p>`,
        },
      })

      // Tạo Document Version 1
      const version1 = await prisma.documentVersion.create({
        data: {
          documentId: newDoc.id,
          versionNumber: 1,
          fileName: file.name,
          storageKey,
          sizeBytes: file.size,
          uploadedBy: sessionUser.id,
          changeNote: 'Tải lên ban đầu',
        },
      })

      // 5. Lưu kết quả OCR & thông tin logistics có cấu trúc vào DB
      await prisma.documentOcrResult.create({
        data: {
          documentId: newDoc.id,
          versionId: version1.id,
          status: 'COMPLETED',
          confidenceScore: extractedLogistics.confidenceScore,
          rawText: rawOcrText,
          structuredData: JSON.stringify(extractedLogistics),
        },
      })

      // Đăng ký Storage Object
      await prisma.storageObject.create({
        data: {
          storageKey,
          bucket: provider.driver === 's3' ? (process.env.S3_BUCKET || 'tml-storage-vault') : 'tml-vault',
          mimeType: uploadValidation.mimeType || file.type || (ext === '.pdf' ? 'application/pdf' : 'image/jpeg'),
          sizeBytes: file.size,
          checksumSha256: checksum,
        },
      })

      // Cập nhật trạng thái Shipment Requirement sang UPLOADED
      await prisma.shipmentRequirement.updateMany({
        where: { shipmentId: shipment.id, docType: docType },
        data: { status: 'UPLOADED' },
      })

      // Audit Log
      await prisma.auditLog.create({
        data: {
          orgId: sessionUser.orgId,
          userId: sessionUser.id,
          action: 'upload',
          resourceType: 'document',
          resourceId: newDoc.id,
          status: 'SUCCESS',
          diffJson: JSON.stringify({
            fileName: file.name,
            size: file.size,
            checksumSha256: checksum,
            shipment: shipment.jobNo,
            confidenceScore: extractedLogistics.confidenceScore,
          }),
        },
      })

      // Sync Event có kèm departmentId để cách ly SSE
      await prisma.syncEvent.create({
        data: {
          orgId: sessionUser.orgId,
          eventType: 'DOCUMENT_CREATED',
          entityType: 'document',
          entityId: newDoc.id,
          payload: JSON.stringify({
            title,
            shipmentId: shipment.id,
            departmentId: shipment.departmentId,
            docType,
            confidence: extractedLogistics.confidenceScore,
          }),
        },
      })

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
