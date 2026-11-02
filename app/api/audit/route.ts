import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const perm = await PermissionService.check(sessionUser, 'AUDIT', 'VIEW')
  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Không có quyền truy cập nhật ký.' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 25))
  const skip = (page - 1) * limit

  const userId = searchParams.get('userId')
  const action = searchParams.get('action')
  const dateFrom = searchParams.get('dateFrom')
  const dateTo = searchParams.get('dateTo')
  const q = searchParams.get('q')
  const since = searchParams.get('since') // Cho Polling near-realtime (lấy các bản ghi mới hơn timestamp này)

  const whereClause: any = {
    orgId: sessionUser.orgId,
  }

  if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'MANAGER') {
    whereClause.userId = sessionUser.id
  } else if (userId && userId !== 'all') {
    whereClause.userId = userId
  }

  if (action && action !== 'all') {
    whereClause.action = action
  }

  if (since) {
    whereClause.createdAt = { gt: new Date(since) }
  } else if (dateFrom || dateTo) {
    whereClause.createdAt = {}
    if (dateFrom) whereClause.createdAt.gte = new Date(dateFrom)
    if (dateTo) whereClause.createdAt.lte = new Date(`${dateTo}T23:59:59.999Z`)
  }

  if (q && q.trim()) {
    const term = q.trim()
    whereClause.OR = [
      { resourceId: { contains: term } },
      { ipAddress: { contains: term } },
      { device: { contains: term } },
      { user: { name: { contains: term } } },
    ]
  }

  const [total, rawLogs] = await Promise.all([
    prisma.auditLog.count({ where: whereClause }),
    prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, name: true, email: true, initials: true, roleCode: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: since ? 0 : skip,
      take: since ? 20 : limit,
    }),
  ])

  // Thu thập danh sách ID để truy vấn tên thân thiện (Human-readable resource names)
  const docIds = rawLogs.filter((l) => l.resourceType === 'document' || !l.resourceType).map((l) => l.resourceId)
  const shipmentIds = rawLogs.filter((l) => l.resourceType === 'shipment').map((l) => l.resourceId)

  const [docs, shipments] = await Promise.all([
    docIds.length > 0
      ? prisma.document.findMany({
          where: { id: { in: docIds } },
          select: { id: true, title: true, fileName: true, isDeleted: true },
        })
      : [],
    shipmentIds.length > 0
      ? prisma.shipment.findMany({
          where: { id: { in: shipmentIds } },
          select: { id: true, jobNo: true, blNo: true },
        })
      : [],
  ])

  const docMap = new Map(docs.map((d) => [d.id, d]))
  const shipmentMap = new Map(shipments.map((s) => [s.id, s]))

  const logs = rawLogs.map((l) => {
    let resourceName = l.resourceId
    let resourceLink: string | null = null
    const isSystemAction = l.action === 'share_expired_auto_revoked' || l.user?.email === 'system@tml.vn'

    if (l.resourceType === 'document' || !l.resourceType) {
      const doc = docMap.get(l.resourceId)
      if (doc) {
        resourceName = doc.title || doc.fileName
        if (!doc.isDeleted) {
          resourceLink = `/documents/${doc.id}`
        }
      } else {
        resourceName = `Chứng từ #${l.resourceId.slice(0, 8)}`
      }
    } else if (l.resourceType === 'shipment') {
      const s = shipmentMap.get(l.resourceId)
      if (s) {
        resourceName = `Lô ${s.jobNo}${s.blNo ? ` (${s.blNo})` : ''}`
        resourceLink = `/shipments/${s.id}`
      } else {
        resourceName = `Lô hàng #${l.resourceId.slice(0, 8)}`
      }
    } else if (l.resourceType === 'user') {
      resourceName = `Tài khoản #${l.resourceId.slice(0, 8)}`
      resourceLink = '/settings?tab=users'
    }

    return {
      id: l.id,
      userId: isSystemAction ? 'system' : l.userId,
      userName: isSystemAction ? 'Hệ thống' : l.user?.name ?? 'Không xác định',
      userInitials: isSystemAction ? 'HT' : l.user?.initials ?? '??',
      userRole: l.user?.roleCode ?? 'STAFF',
      isSystem: isSystemAction,
      action: l.action,
      resourceType: l.resourceType,
      resourceId: l.resourceId,
      resourceName,
      resourceLink,
      documentId: l.resourceId,
      ip: l.ipAddress ?? '127.0.0.1',
      device: l.device ?? 'Trình duyệt Web',
      at: l.createdAt.toISOString(),
    }
  })

  return NextResponse.json({
    data: logs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
}

