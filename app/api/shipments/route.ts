import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'
import { getRequiredDocTypes, type ShipmentStatus } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const customerId = searchParams.get('customerId')
  const status = searchParams.get('status')
  const q = searchParams.get('q')
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit')) || 20))
  const skip = (page - 1) * limit

  const whereClause: any = { orgId: sessionUser.orgId }

  if (sessionUser.role !== 'ADMIN') {
    const userDeptIds = sessionUser.departments.map((d) => d.id)
    whereClause.OR = [
      { departmentId: { in: userDeptIds } },
      { ownerId: sessionUser.id },
    ]
  }

  if (customerId && customerId !== 'all') whereClause.customerId = customerId
  if (status && status !== 'all') whereClause.status = status
  if (q && q.trim()) {
    const trimmed = q.trim()
    whereClause.OR = [
      ...(whereClause.OR || []),
      { jobNo: { contains: trimmed } },
      { blNo: { contains: trimmed } },
    ]
  }

  const [total, shipments] = await Promise.all([
    prisma.shipment.count({ where: whereClause }),
    prisma.shipment.findMany({
      where: whereClause,
      include: {
        customer: { select: { id: true, name: true, shortName: true } },
        owner: { select: { id: true, name: true } },
        documents: {
          where: { isDeleted: false },
          select: { id: true, type: true, title: true, fileName: true },
        },
        requirements: true,
      },
      orderBy: { etd: 'desc' },
      skip,
      take: limit,
    }),
  ])

  return NextResponse.json({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    shipments: shipments.map((s) => ({
      id: s.id,
      jobNo: s.jobNo,
      blNo: s.blNo,
      mode: s.mode,
      origin: s.origin,
      destination: s.destination,
      etd: s.etd,
      eta: s.eta,
      status: s.status,
      customer: s.customer,
      owner: s.owner,
      documentCount: s.documents.length,
      documents: s.documents,
      requirements: s.requirements,
      createdAt: s.createdAt.toISOString(),
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

  // Permission check: SHIPMENTS:CREATE
  const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'CREATE')
  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền tạo lô hàng mới.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const {
      jobNo,
      blNo,
      customerId,
      mode = 'sea',
      origin,
      destination,
      etd,
      eta,
      departmentId,
      goodsDesc,
    } = body

    if (!jobNo || !blNo || !customerId || !origin || !destination || !etd || !eta) {
      return NextResponse.json(
        { error: 'Vui lòng điền đầy đủ các thông tin bắt buộc (Số Job, B/L, Khách hàng, Cảng đi, Cảng đến, ETD, ETA).' },
        { status: 400 }
      )
    }

    // Kiểm tra trùng lặp Job Number
    const existingJob = await prisma.shipment.findUnique({
      where: { jobNo: jobNo.trim() },
    })

    if (existingJob) {
      return NextResponse.json(
        { error: `Số Job "${jobNo.trim()}" đã tồn tại trong hệ thống. Vui lòng chọn số Job khác.` },
        { status: 409 }
      )
    }

    const assignedDeptId = departmentId || sessionUser.departments[0]?.id || null

    // Tạo Shipment mới
    const newShipment = await prisma.shipment.create({
      data: {
        orgId: sessionUser.orgId,
        jobNo: jobNo.trim(),
        blNo: blNo.trim(),
        customerId,
        departmentId: assignedDeptId,
        mode,
        origin: origin.trim(),
        destination: destination.trim(),
        etd,
        eta,
        status: 'booking',
        ownerId: sessionUser.id,
        goodsDesc: goodsDesc ? goodsDesc.trim() : null,
      },
    })

    // Khởi tạo bảng kiểm chứng từ bắt buộc (Checklist Requirements) theo chiều hàng
    const requiredTypes = getRequiredDocTypes({ origin: newShipment.origin, destination: newShipment.destination })
    await prisma.shipmentRequirement.createMany({
      data: requiredTypes.map((t) => ({
        shipmentId: newShipment.id,
        docType: t,
        isMandatory: true,
        status: 'MISSING',
      })),
    })

    // Ghi Audit Log
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'upload',
        resourceType: 'shipment',
        resourceId: newShipment.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ jobNo: newShipment.jobNo, blNo: newShipment.blNo }),
      },
    })

    // Tạo Sync Event
    await prisma.syncEvent.create({
      data: {
        orgId: sessionUser.orgId,
        eventType: 'SHIPMENT_UPDATED',
        entityType: 'shipment',
        entityId: newShipment.id,
        payload: JSON.stringify({
          jobNo: newShipment.jobNo,
          action: 'created',
          departmentId: assignedDeptId,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Tạo lô hàng mới và thiết lập bộ checklist chứng từ thành công.',
      shipment: newShipment,
    })
  } catch (error: any) {
    console.error('Lỗi tạo lô hàng:', error)
    return NextResponse.json({ error: error.message || 'Lỗi xử lý tạo lô hàng.' }, { status: 500 })
  }
}

