import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'
import { DOC_TYPE_LABEL } from '@/lib/labels'
import type { DocType } from '@/lib/types'
import { getStorageProvider } from '@/lib/storage/storage-provider'
import { extractLogisticsFields } from '@/lib/ocr/ocr-extractor'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const shipmentId = searchParams.get('shipmentId')
  const type = searchParams.get('type')
  const q = searchParams.get('q')
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const permissionWhere = await PermissionService.buildDocumentWhereInput(sessionUser, 'VIEW')
  const andConditions: any[] = [{ isDeleted: false }, permissionWhere]

  if (shipmentId) andConditions.push({ shipmentId })
  if (type && type !== 'all') andConditions.push({ type })
  if (q && q.trim()) {
    andConditions.push({
      OR: [
        { title: { contains: q.trim() } },
        { fileName: { contains: q.trim() } },
      ],
    })
  }

  const whereClause = { AND: andConditions }

  const [total, docs] = await Promise.all([
    prisma.document.count({ where: whereClause }),
    prisma.document.findMany({
      where: whereClause,
      include: {
        shipment: { select: { jobNo: true, blNo: true } },
        customer: { select: { shortName: true, name: true } },
        ocrResults: { take: 1, orderBy: { extractedAt: 'desc' } },
        versions: { take: 1, orderBy: { versionNumber: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ])

  return NextResponse.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      customTypeName: d.customTypeName,
      fileName: d.fileName,
      fileSizeBytes: d.fileSizeBytes,
      docDate: d.docDate,
      retentionUntil: d.retentionUntil,
      shipment: d.shipment,
      customer: d.customer,
      ocrText: d.ocrResults[0]?.rawText || '',
      structuredData: d.ocrResults[0]?.structuredData ? JSON.parse(d.ocrResults[0].structuredData) : null,
      confidenceScore: d.ocrResults[0]?.confidenceScore ?? 0,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  })
}

export async function POST(req: Request) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const sessionUser = await getSessionUser(req)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const {
      shipmentId,
      customerId,
      type = 'OTHER',
      customTypeName,
      title: customTitle,
      docDate = new Date().toISOString().slice(0, 10),
      ocrText = '',
      editedHtml = '',
      archiveBoxId,
      retentionUntil,
      pages = [],
    } = body

    if (!shipmentId) {
      return NextResponse.json({ error: 'Thiếu thông tin shipmentId.' }, { status: 400 })
    }

    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { participants: true },
    })

    if (!shipment) {
      return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
    }

    if (!shipment.departmentId) {
      return NextResponse.json(
        { error: 'Lô hàng chưa có phòng ban trực thuộc. Không thể tạo chứng từ.' },
        { status: 400 }
      )
    }

    // Kiểm tra quyền UPLOAD chứng từ trong lô hàng
    const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'UPLOAD', {
      departmentId: shipment.departmentId,
      ownerId: shipment.ownerId,
      assignedUserIds: shipment.participants.map((p) => p.userId),
    })

    if (!perm.allowed) {
      return NextResponse.json(
        { error: perm.reason || 'Bạn không có quyền tải lên chứng từ trong lô hàng này.' },
        { status: 403 }
      )
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const displayLabel = type === 'OTHER' && customTypeName ? customTypeName : (DOC_TYPE_LABEL[type as DocType] ?? type)
    const finalTitle = customTitle || `${displayLabel} ${shipment.jobNo}`

    // Chuẩn bị dữ liệu nhị phân tập tin từ ảnh quét hoặc nội dung soạn thảo
    let fileBuffer: Buffer
    let mimeType = 'image/jpeg'
    let fileExt = 'jpg'

    if (Array.isArray(pages) && pages.length > 0 && pages[0]?.dataUrl) {
      const firstDataUrl = pages[0].dataUrl
      const match = firstDataUrl.match(/^data:([^;]+);base64,(.+)$/)
      if (match) {
        mimeType = match[1]
        fileBuffer = Buffer.from(match[2], 'base64')
        if (mimeType === 'application/pdf') fileExt = 'pdf'
        else if (mimeType === 'image/png') fileExt = 'png'
        else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') fileExt = 'jpg'
      } else {
        fileBuffer = Buffer.from(firstDataUrl, 'utf8')
      }
    } else if (editedHtml && editedHtml.trim()) {
      fileBuffer = Buffer.from(editedHtml, 'utf8')
      mimeType = 'text/html'
      fileExt = 'html'
    } else {
      fileBuffer = Buffer.from(`TML LOGISTICS DOCUMENT: ${finalTitle}\nJob: ${shipment.jobNo}`, 'utf8')
      mimeType = 'text/plain'
      fileExt = 'txt'
    }

    // Lưu trữ tập tin vật lý lên StorageProvider bền vững (Local / S3)
    const now = new Date()
    const dateFolder = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
    const storageKey = `vault/${dateFolder}/${crypto.randomUUID()}.${fileExt}`
    const storage = getStorageProvider()
    await storage.put(storageKey, fileBuffer, mimeType)

    const checksumSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex')

    // Lưu bản ghi StorageObject
    await prisma.storageObject.create({
      data: {
        storageKey,
        mimeType,
        sizeBytes: fileBuffer.length,
        checksumSha256,
      },
    })

    // Lưu bản ghi Document
    const doc = await prisma.document.create({
      data: {
        id: docId,
        orgId: sessionUser.orgId,
        shipmentId: shipment.id,
        customerId: customerId || shipment.customerId,
        departmentId: shipment.departmentId,
        type,
        customTypeName: customTypeName || null,
        title: finalTitle,
        fileName: `${finalTitle.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF]/g, '_')}.${fileExt}`,
        fileSizeBytes: fileBuffer.length,
        storageKey,
        pages: pages.length || 1,
        docDate,
        archiveBoxId: archiveBoxId || null,
        retentionUntil: retentionUntil || null,
        editedHtml: editedHtml || `<p>${finalTitle}</p>`,
        createdBy: sessionUser.id,
        updatedBy: sessionUser.id,
      },
    })

    // Tạo phiên bản đầu tiên DocumentVersion (v1)
    const version = await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        versionNumber: 1,
        fileName: doc.fileName,
        storageKey,
        sizeBytes: fileBuffer.length,
        uploadedBy: sessionUser.id,
        changeNote: 'Tạo mới từ luồng Quét / Soạn thảo',
      },
    })

    // Bóc tách thông tin nghiệp vụ và lưu DocumentOcrResult
    const structuredData = extractLogisticsFields(ocrText)
    await prisma.documentOcrResult.create({
      data: {
        documentId: doc.id,
        versionId: version.id,
        status: 'COMPLETED',
        confidenceScore: structuredData.confidenceScore || 90.0,
        rawText: ocrText || '',
        structuredData: JSON.stringify(structuredData),
      },
    })

    // Cập nhật checklist ShipmentRequirement nếu loại chứng từ này thuộc yêu cầu của lô hàng
    await prisma.shipmentRequirement.updateMany({
      where: {
        shipmentId: shipment.id,
        docType: type,
      },
      data: {
        status: 'UPLOADED',
      },
    })

    // Ghi nhật ký kiểm toán (AuditLog)
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'upload',
        resourceType: 'document',
        resourceId: doc.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ title: finalTitle, type, storageKey }),
      },
    })

    // Phát sinh SyncEvent
    await prisma.syncEvent.create({
      data: {
        orgId: sessionUser.orgId,
        eventType: 'DOCUMENT_CREATED',
        entityType: 'document',
        entityId: doc.id,
        payload: JSON.stringify({
          id: doc.id,
          title: doc.title,
          type: doc.type,
          shipmentId: shipment.id,
          departmentId: shipment.departmentId,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      document: doc,
    })
  } catch (error: any) {
    console.error('Lỗi tạo chứng từ:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi tạo chứng từ.' }, { status: 500 })
  }
}

