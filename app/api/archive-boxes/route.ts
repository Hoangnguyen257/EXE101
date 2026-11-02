import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'

/**
 * GET /api/archive-boxes
 * Lấy danh sách thùng/hộp lưu trữ vật lý
 */
export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'ARCHIVE', 'VIEW')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem danh sách hộp lưu trữ.' }, { status: 403 })
    }

    const boxes = await prisma.archiveBox.findMany({
      where: { orgId: sessionUser.orgId },
      include: {
        documents: { select: { id: true, title: true, fileName: true } },
        customer: { select: { id: true, name: true, shortName: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ boxes })
  } catch (error: any) {
    console.error('Lỗi GET /api/archive-boxes:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi lấy danh sách hộp lưu trữ.' }, { status: 500 })
  }
}

/**
 * POST /api/archive-boxes
 * Tạo mới hộp lưu trữ vật lý (Yêu cầu ARCHIVE:CREATE - ADMIN)
 */
export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'ARCHIVE', 'CREATE')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền tạo hộp lưu trữ vật lý.' }, { status: 403 })
    }

    const body = await req.json()
    const { code, warehouse, shelf, box, customerId, period } = body

    if (!code || typeof code !== 'string' || code.trim().length < 2) {
      return NextResponse.json({ error: 'Mã hộp lưu trữ phải có ít nhất 2 ký tự.' }, { status: 400 })
    }

    if (!warehouse || !shelf || !box || !period) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ: kho lưu trữ, kệ, vị trí ô hộp và niên độ/kỳ.' }, { status: 400 })
    }

    const normalizedCode = code.trim().toUpperCase()

    // Kiểm tra trùng mã hộp
    const existing = await prisma.archiveBox.findUnique({
      where: { code: normalizedCode },
    })
    if (existing) {
      return NextResponse.json({ error: `Mã hộp "${normalizedCode}" đã tồn tại trên hệ thống.` }, { status: 409 })
    }

    if (customerId) {
      const cust = await prisma.customer.findFirst({
        where: { id: customerId, orgId: sessionUser.orgId },
      })
      if (!cust) {
        return NextResponse.json({ error: 'Khách hàng liên kết không tồn tại.' }, { status: 400 })
      }
    }

    const newBox = await prisma.archiveBox.create({
      data: {
        orgId: sessionUser.orgId,
        code: normalizedCode,
        warehouse: warehouse.trim(),
        shelf: shelf.trim(),
        box: box.trim(),
        customerId: customerId || null,
        period: period.trim(),
        createdBy: sessionUser.id,
      },
    })

    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'create',
        resourceType: 'archive_box',
        resourceId: newBox.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ code: newBox.code, warehouse, shelf, box, period }),
      },
    })

    return NextResponse.json(
      {
        success: true,
        box: newBox,
        message: 'Tạo hộp lưu trữ vật lý thành công.',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Lỗi POST /api/archive-boxes:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi tạo hộp lưu trữ.' }, { status: 500 })
  }
}
