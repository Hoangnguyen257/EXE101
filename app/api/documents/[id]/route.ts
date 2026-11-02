import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      shipment: { include: { participants: true } },
      customer: true,
      archiveBox: true,
      ocrResults: { orderBy: { extractedAt: 'desc' } },
      versions: { orderBy: { versionNumber: 'desc' } },
      creator: { select: { id: true, name: true, email: true } },
    },
  })

  if (!doc || doc.isDeleted) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại hoặc đã bị xóa.' }, { status: 404 })
  }

  // Permission check: DOCUMENTS:VIEW
  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'VIEW', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
    ownerId: doc.shipment?.ownerId,
    assignedUserIds: doc.shipment?.participants?.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem chứng từ này.' }, { status: 403 })
  }

  return NextResponse.json({
    document: {
      id: doc.id,
      title: doc.title,
      type: doc.type,
      customTypeName: doc.customTypeName,
      fileName: doc.fileName,
      fileSizeBytes: doc.fileSizeBytes,
      pages: doc.pages,
      docDate: doc.docDate,
      retentionUntil: doc.retentionUntil,
      archiveBox: doc.archiveBox,
      shipment: doc.shipment,
      customer: doc.customer,
      creator: doc.creator,
      ocrResults: doc.ocrResults.map((r) => ({
        id: r.id,
        status: r.status,
        confidenceScore: r.confidenceScore,
        rawText: r.rawText,
        structuredData: r.structuredData ? JSON.parse(r.structuredData) : null,
        extractedAt: r.extractedAt.toISOString(),
      })),
      versions: doc.versions.map((v) => ({
        id: v.id,
        versionNumber: v.versionNumber,
        fileName: v.fileName,
        sizeBytes: v.sizeBytes,
        uploadedAt: v.uploadedAt.toISOString(),
        changeNote: v.changeNote,
      })),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    },
  })
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { shipment: { include: { participants: true } } },
  })

  if (!doc || doc.isDeleted) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại hoặc đã bị xóa.' }, { status: 404 })
  }

  // Permission check: DOCUMENTS:EDIT
  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'EDIT', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
    ownerId: doc.shipment?.ownerId,
    assignedUserIds: doc.shipment?.participants?.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền chỉnh sửa chứng từ này.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { title, docDate, customTypeName, retentionUntil, archiveBoxId, ocrCorrections } = body

    const updateData: any = { updatedBy: sessionUser.id }
    if (title !== undefined) updateData.title = title
    if (docDate !== undefined) updateData.docDate = docDate
    if (customTypeName !== undefined) updateData.customTypeName = customTypeName
    if (retentionUntil !== undefined) updateData.retentionUntil = retentionUntil
    if (archiveBoxId !== undefined) updateData.archiveBoxId = archiveBoxId || null

    const updated = await prisma.document.update({
      where: { id: doc.id },
      data: updateData,
    })

    // Nếu người dùng hiệu chỉnh dữ liệu OCR (OCR Correction)
    if (ocrCorrections && typeof ocrCorrections === 'object') {
      const latestOcr = await prisma.documentOcrResult.findFirst({
        where: { documentId: doc.id },
        orderBy: { extractedAt: 'desc' },
      })

      if (latestOcr) {
        let currentStructured: any = {}
        try {
          currentStructured = JSON.parse(latestOcr.structuredData || '{}')
        } catch {}

        const mergedStructured = { ...currentStructured, ...ocrCorrections, userVerified: true }

        await prisma.documentOcrResult.update({
          where: { id: latestOcr.id },
          data: {
            structuredData: JSON.stringify(mergedStructured),
            confidenceScore: 100.0, // Đã được con người kiểm tra & xác nhận
          },
        })
      }
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'edit',
        resourceType: 'document',
        resourceId: doc.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ updateData, ocrCorrections }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Cập nhật thông tin chứng từ thành công.',
      document: updated,
    })
  } catch (error: any) {
    console.error('Lỗi cập nhật chứng từ:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi cập nhật chứng từ.' }, { status: 500 })
  }
}

