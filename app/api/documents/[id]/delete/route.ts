import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
  })

  if (!doc || doc.isDeleted) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại hoặc đã bị xóa.' }, { status: 404 })
  }

  // Permission check: DOCUMENTS:DELETE
  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'DELETE', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xóa chứng từ này.' }, { status: 403 })
  }

  // Soft delete
  await prisma.document.update({
    where: { id: doc.id },
    data: {
      isDeleted: true,
      deletedAt: new Date(),
    },
  })

  // Audit Log
  await prisma.auditLog.create({
    data: {
      orgId: sessionUser.orgId,
      userId: sessionUser.id,
      action: 'delete',
      resourceType: 'document',
      resourceId: doc.id,
      status: 'SUCCESS',
      diffJson: JSON.stringify({ fileName: doc.fileName, title: doc.title }),
    },
  })

  // Sync Event
  await prisma.syncEvent.create({
    data: {
      orgId: sessionUser.orgId,
      eventType: 'DOCUMENT_DELETED',
      entityType: 'document',
      entityId: doc.id,
      payload: JSON.stringify({ id: doc.id, departmentId: doc.departmentId }),
    },
  })

  return NextResponse.json({ success: true, message: 'Đã xóa chứng từ thành công.' })
}

