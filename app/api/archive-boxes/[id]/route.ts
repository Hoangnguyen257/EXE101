import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'

/**
 * GET /api/archive-boxes/[id]
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'ARCHIVE', 'VIEW')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem thông tin hộp lưu trữ.' }, { status: 403 })
    }

    const box = await prisma.archiveBox.findFirst({
      where: { id, orgId: sessionUser.orgId },
      include: {
        documents: {
          select: {
            id: true,
            title: true,
            fileName: true,
            type: true,
            shipment: { select: { id: true, jobNo: true } },
          },
        },
        customer: { select: { id: true, name: true, shortName: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    })

    if (!box) {
      return NextResponse.json({ error: 'Không tìm thấy hộp lưu trữ.' }, { status: 404 })
    }

    return NextResponse.json({ box })
  } catch (error: any) {
    console.error('Lỗi GET /api/archive-boxes/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi lấy thông tin hộp lưu trữ.' }, { status: 500 })
  }
}

/**
 * PATCH /api/archive-boxes/[id]
 * Cập nhật vị trí hoặc thông tin hộp lưu trữ (ARCHIVE:EDIT)
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'ARCHIVE', 'EDIT')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền chỉnh sửa hộp lưu trữ.' }, { status: 403 })
    }

    const existingBox = await prisma.archiveBox.findFirst({
      where: { id, orgId: sessionUser.orgId },
    })
    if (!existingBox) {
      return NextResponse.json({ error: 'Không tìm thấy hộp lưu trữ cần cập nhật.' }, { status: 404 })
    }

    const body = await req.json()
    const { warehouse, shelf, box, period, customerId } = body

    const dataToUpdate: any = {}
    if (typeof warehouse === 'string' && warehouse.trim()) dataToUpdate.warehouse = warehouse.trim()
    if (typeof shelf === 'string' && shelf.trim()) dataToUpdate.shelf = shelf.trim()
    if (typeof box === 'string' && box.trim()) dataToUpdate.box = box.trim()
    if (typeof period === 'string' && period.trim()) dataToUpdate.period = period.trim()
    if (customerId !== undefined) dataToUpdate.customerId = customerId || null

    const updatedBox = await prisma.archiveBox.update({
      where: { id },
      data: dataToUpdate,
    })

    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'edit',
        resourceType: 'archive_box',
        resourceId: id,
        status: 'SUCCESS',
        diffJson: JSON.stringify(dataToUpdate),
      },
    })

    return NextResponse.json({
      success: true,
      box: updatedBox,
      message: 'Cập nhật hộp lưu trữ thành công.',
    })
  } catch (error: any) {
    console.error('Lỗi PATCH /api/archive-boxes/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi cập nhật hộp lưu trữ.' }, { status: 500 })
  }
}

/**
 * DELETE /api/archive-boxes/[id]
 * Xóa hộp lưu trữ (ARCHIVE:DELETE - ADMIN)
 */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'ARCHIVE', 'DELETE')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Chỉ Quản trị viên (ADMIN) mới có quyền xóa hộp lưu trữ.' }, { status: 403 })
    }

    const existingBox = await prisma.archiveBox.findFirst({
      where: { id, orgId: sessionUser.orgId },
    })
    if (!existingBox) {
      return NextResponse.json({ error: 'Không tìm thấy hộp lưu trữ cần xóa.' }, { status: 404 })
    }

    // Chặn xóa nếu bên trong hộp còn chứng từ
    const docCount = await prisma.document.count({
      where: { archiveBoxId: id },
    })
    if (docCount > 0) {
      return NextResponse.json(
        {
          error: `Không thể xóa hộp lưu trữ đang chứa ${docCount} chứng từ. Vui lòng di chuyển hoặc đưa chứng từ ra khỏi hộp trước khi xóa.`,
        },
        { status: 400 }
      )
    }

    await prisma.archiveBox.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'delete',
        resourceType: 'archive_box',
        resourceId: id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ code: existingBox.code }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Đã xóa hộp lưu trữ thành công.',
    })
  } catch (error: any) {
    console.error('Lỗi DELETE /api/archive-boxes/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi xóa hộp lưu trữ.' }, { status: 500 })
  }
}
