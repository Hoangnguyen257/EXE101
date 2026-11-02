import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'

export const dynamic = 'force-dynamic'

/**
 * GET /api/shipments/[id]/participants
 * Lấy danh sách nhân viên được phân công vào lô hàng
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true, initials: true, roleCode: true },
          },
        },
      },
    },
  })

  if (!shipment) {
    return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
  }

  const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'VIEW', {
    id: shipment.id,
    departmentId: shipment.departmentId,
    ownerId: shipment.ownerId,
    assignedUserIds: shipment.participants.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem thông tin lô hàng này.' }, { status: 403 })
  }

  return NextResponse.json({
    shipmentId: shipment.id,
    participants: shipment.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      roleInShipment: p.roleInShipment,
      assignedAt: p.assignedAt.toISOString(),
      user: p.user,
    })),
  })
}

/**
 * POST /api/shipments/[id]/participants
 * Phân công nhân viên vào lô hàng
 */
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

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { participants: true },
  })

  if (!shipment) {
    return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
  }

  // Yêu cầu quyền ASSIGN hoặc EDIT trên SHIPMENTS
  const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'ASSIGN', {
    id: shipment.id,
    departmentId: shipment.departmentId,
    ownerId: shipment.ownerId,
    assignedUserIds: shipment.participants.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền phân công nhân sự cho lô hàng này.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { userId, roleInShipment = 'STAFF' } = body

    if (!userId) {
      return NextResponse.json({ error: 'Vui lòng cung cấp mã người dùng (userId).' }, { status: 400 })
    }

    // Xác thực người dùng được phân công thuộc cùng tổ chức
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, orgId: sessionUser.orgId, isActive: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'Người dùng không tồn tại hoặc đã bị vô hiệu hóa trong tổ chức.' }, { status: 400 })
    }

    const participant = await prisma.shipmentParticipant.upsert({
      where: { shipmentId_userId: { shipmentId: shipment.id, userId: targetUser.id } },
      update: { roleInShipment },
      create: {
        shipmentId: shipment.id,
        userId: targetUser.id,
        roleInShipment,
      },
      include: {
        user: { select: { id: true, name: true, email: true, roleCode: true, initials: true } },
      },
    })

    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'assign',
        resourceType: 'shipment',
        resourceId: shipment.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ assignedUserId: targetUser.id, roleInShipment }),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Đã phân công ${targetUser.name} vào lô hàng ${shipment.jobNo}.`,
      participant,
    })
  } catch (error: any) {
    console.error('Lỗi phân công nhân sự:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi phân công nhân sự.' }, { status: 500 })
  }
}

/**
 * DELETE /api/shipments/[id]/participants
 * Gỡ bỏ nhân viên khỏi lô hàng
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { participants: true },
  })

  if (!shipment) {
    return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
  }

  const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'ASSIGN', {
    id: shipment.id,
    departmentId: shipment.departmentId,
    ownerId: shipment.ownerId,
    assignedUserIds: shipment.participants.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền quản lý thành viên lô hàng này.' }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId')

    if (!userId) {
      return NextResponse.json({ error: 'Vui lòng chỉ định userId cần gỡ bỏ.' }, { status: 400 })
    }

    await prisma.shipmentParticipant.deleteMany({
      where: {
        shipmentId: shipment.id,
        userId,
      },
    })

    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'edit',
        resourceType: 'shipment',
        resourceId: shipment.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ unassignedUserId: userId }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Đã gỡ bỏ phân công nhân sự khỏi lô hàng.',
    })
  } catch (error: any) {
    console.error('Lỗi gỡ bỏ phân công:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi gỡ bỏ phân công.' }, { status: 500 })
  }
}

