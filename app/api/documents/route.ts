import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'
import { DOC_TYPE_LABEL } from '@/lib/labels'
import type { DocType } from '@/lib/types'

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

  const sessionUser = await getSessionUser()
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

    // Permission check
    const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'CREATE', {
      departmentId: shipment.departmentId,
      ownerId: shipment.ownerId,
      assignedUserIds: shipment.participants.map((p) => p.userId),
    })

    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền tạo chứng từ trong lô hàng này.' }, { status: 403 })
    }

    const docId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const displayLabel = type === 'OTHER' && customTypeName ? customTypeName : (DOC_TYPE_LABEL[type as DocType] ?? type)
    const finalTitle = customTitle || `${displayLabel} ${shipment.jobNo}`

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
        fileName: `${docId}.pdf`,
        fileSizeBytes: ocrText.length,
        storageKey: `vault/${docId}.pdf`,
        pages: 1,
        docDate,
        archiveBoxId: archiveBoxId || null,
        retentionUntil: retentionUntil || null,
        editedHtml: editedHtml || `<p>${finalTitle}</p>`,
        createdBy: sessionUser.id,
        updatedBy: sessionUser.id,
      },
    })

    if (ocrText && ocrText.trim()) {
      await prisma.documentOcrResult.create({
        data: {
          documentId: doc.id,
          status: 'COMPLETED',
          confidenceScore: 90.0,
          rawText: ocrText,
        },
      })
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'upload',
        resourceType: 'document',
        resourceId: doc.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ title: finalTitle, type }),
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

