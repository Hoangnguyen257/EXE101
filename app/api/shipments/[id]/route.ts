import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'
import { SHIPMENT_STATUS_LABEL } from '@/lib/labels'

export const dynamic = 'force-dynamic'

export const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  draft: ['booking', 'in_transit', 'arrived', 'closed'],
  booking: ['in_transit', 'customs', 'arrived', 'closed'],
  in_transit: ['arrived', 'customs', 'on_yard', 'delivered', 'closed'],
  arrived: ['on_yard', 'customs', 'delivered', 'closed'],
  on_yard: ['customs', 'delivered', 'closed'],
  customs: ['delivered', 'on_yard', 'closed'],
  delivered: ['closed'],
  closed: [], // Đã đóng hồ sơ, không thể chuyển sang trạng thái khác
}

const patchShipmentSchema = z.object({
  status: z.enum([
    'draft',
    'booking',
    'in_transit',
    'arrived',
    'on_yard',
    'customs',
    'delivered',
    'closed',
  ], {
    error: 'Trạng thái lô hàng không hợp lệ.',
  }).optional(),
  blNo: z.string({
    error: 'Số vận đơn (blNo) phải là chuỗi ký tự.',
  }).trim().optional(),
  etd: z.string({
    error: 'Ngày khởi hành (etd) phải là chuỗi ký tự.',
  }).optional(),
  eta: z.string({
    error: 'Ngày đến dự kiến (eta) phải là chuỗi ký tự.',
  }).optional(),
  goodsDesc: z.string({
    error: 'Mô tả hàng hóa phải là chuỗi ký tự.',
  }).optional(),
  destination: z.string({
    error: 'Cảng đến phải là chuỗi ký tự.',
  }).optional(),
  origin: z.string({
    error: 'Cảng đi phải là chuỗi ký tự.',
  }).optional(),
})

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      customer: true,
      owner: { select: { id: true, name: true, email: true } },
      department: true,
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true, roleCode: true, initials: true } },
        },
      },
      documents: {
        where: { isDeleted: false },
        include: { versions: true, ocrResults: { take: 1, orderBy: { extractedAt: 'desc' } } },
      },
      goods: {
        orderBy: { orderIndex: 'asc' },
      },
      requirements: true,
    },
  })

  if (!shipment) {
    return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
  }

  // Permission check: SHIPMENTS:VIEW
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
    shipment,
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

  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: { participants: true },
  })

  if (!shipment) {
    return NextResponse.json({ error: 'Lô hàng không tồn tại.' }, { status: 404 })
  }

  // Permission check: SHIPMENTS:EDIT
  const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'EDIT', {
    id: shipment.id,
    departmentId: shipment.departmentId,
    ownerId: shipment.ownerId,
    assignedUserIds: shipment.participants.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền chỉnh sửa lô hàng này.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { status, blNo, etd, eta, goodsDesc, destination, origin } = body

    const updateData: any = {}
    if (status !== undefined) updateData.status = status
    if (blNo !== undefined) updateData.blNo = blNo.trim()
    if (etd !== undefined) updateData.etd = etd
    if (eta !== undefined) updateData.eta = eta
    if (goodsDesc !== undefined) updateData.goodsDesc = goodsDesc
    if (destination !== undefined) updateData.destination = destination
    if (origin !== undefined) updateData.origin = origin

    const updatedShipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: updateData,
    })

    // Ghi nhận lịch sử trạng thái nếu có thay đổi status
    if (status && status !== shipment.status) {
      await prisma.shipmentStatusHistory.create({
        data: {
          shipmentId: shipment.id,
          oldStatus: shipment.status,
          newStatus: status,
          changedBy: sessionUser.id,
        },
      })
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'edit',
        resourceType: 'shipment',
        resourceId: shipment.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify(updateData),
      },
    })

    // Sync Event
    await prisma.syncEvent.create({
      data: {
        orgId: sessionUser.orgId,
        eventType: 'SHIPMENT_UPDATED',
        entityType: 'shipment',
        entityId: shipment.id,
        payload: JSON.stringify({
          jobNo: shipment.jobNo,
          updatedFields: Object.keys(updateData),
          departmentId: shipment.departmentId,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Cập nhật lô hàng thành công.',
      shipment: updatedShipment,
    })
  } catch (error: any) {
    console.error('Lỗi cập nhật lô hàng:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi cập nhật lô hàng.' }, { status: 500 })
  }
}
