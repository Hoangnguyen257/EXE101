import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'

/**
 * GET /api/departments/[id]
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

    const perm = await PermissionService.check(sessionUser, 'DEPARTMENTS', 'VIEW')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem thông tin phòng ban.' }, { status: 403 })
    }

    const dept = await prisma.department.findFirst({
      where: { id, orgId: sessionUser.orgId },
      include: {
        userLinks: {
          include: {
            user: { select: { id: true, name: true, email: true, roleCode: true } },
          },
        },
        _count: {
          select: {
            shipments: true,
            documents: true,
          },
        },
      },
    })

    if (!dept) {
      return NextResponse.json({ error: 'Không tìm thấy phòng ban.' }, { status: 404 })
    }

    return NextResponse.json({ department: dept })
  } catch (error: any) {
    console.error('Lỗi GET /api/departments/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi lấy thông tin phòng ban.' }, { status: 500 })
  }
}

/**
 * PATCH /api/departments/[id]
 * Cập nhật phòng ban (Chỉ ADMIN)
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

    const perm = await PermissionService.check(sessionUser, 'DEPARTMENTS', 'EDIT')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Chỉ Quản trị viên (ADMIN) mới có quyền chỉnh sửa phòng ban.' }, { status: 403 })
    }

    const existingDept = await prisma.department.findFirst({
      where: { id, orgId: sessionUser.orgId },
    })
    if (!existingDept) {
      return NextResponse.json({ error: 'Không tìm thấy phòng ban cần cập nhật.' }, { status: 404 })
    }

    const body = await req.json()
    const { name, code, headUserId, isActive } = body

    const dataToUpdate: any = {}

    if (typeof name === 'string' && name.trim().length >= 2) {
      dataToUpdate.name = name.trim()
    }

    if (typeof code === 'string' && code.trim().length >= 2) {
      const normalizedCode = code.trim().toUpperCase()
      if (normalizedCode !== existingDept.code) {
        const duplicate = await prisma.department.findUnique({
          where: {
            orgId_code: { orgId: sessionUser.orgId, code: normalizedCode },
          },
        })
        if (duplicate) {
          return NextResponse.json({ error: `Mã phòng ban "${normalizedCode}" đã tồn tại.` }, { status: 409 })
        }
        dataToUpdate.code = normalizedCode
      }
    }

    if (headUserId !== undefined) {
      if (headUserId) {
        const head = await prisma.user.findFirst({
          where: { id: headUserId, orgId: sessionUser.orgId },
        })
        if (!head) {
          return NextResponse.json({ error: 'Trưởng phòng được chỉ định không tồn tại.' }, { status: 400 })
        }
        dataToUpdate.headUserId = headUserId
      } else {
        dataToUpdate.headUserId = null
      }
    }

    if (typeof isActive === 'boolean') {
      dataToUpdate.isActive = isActive
    }

    const updatedDept = await prisma.department.update({
      where: { id },
      data: dataToUpdate,
    })

    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'edit',
        resourceType: 'department',
        resourceId: id,
        status: 'SUCCESS',
        diffJson: JSON.stringify(dataToUpdate),
      },
    })

    return NextResponse.json({
      success: true,
      department: updatedDept,
      message: 'Cập nhật phòng ban thành công.',
    })
  } catch (error: any) {
    console.error('Lỗi PATCH /api/departments/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi cập nhật phòng ban.' }, { status: 500 })
  }
}

/**
 * DELETE /api/departments/[id]
 * Xóa phòng ban (Chỉ ADMIN)
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

    const perm = await PermissionService.check(sessionUser, 'DEPARTMENTS', 'DELETE')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Chỉ Quản trị viên (ADMIN) mới có quyền xóa phòng ban.' }, { status: 403 })
    }

    const existingDept = await prisma.department.findFirst({
      where: { id, orgId: sessionUser.orgId },
    })
    if (!existingDept) {
      return NextResponse.json({ error: 'Không tìm thấy phòng ban cần xóa.' }, { status: 404 })
    }

    // Kiểm tra liên kết dữ liệu
    const linkedShipments = await prisma.shipment.count({ where: { departmentId: id } })
    const linkedDocs = await prisma.document.count({ where: { departmentId: id } })
    const linkedUsers = await prisma.userDepartment.count({ where: { departmentId: id } })

    if (linkedShipments > 0 || linkedDocs > 0) {
      return NextResponse.json(
        {
          error: `Không thể xóa phòng ban đang có ${linkedShipments} lô hàng và ${linkedDocs} chứng từ liên kết. Vui lòng di chuyển tài nguyên trước khi xóa.`,
        },
        { status: 400 }
      )
    }

    if (linkedUsers > 0) {
      return NextResponse.json(
        {
          error: `Không thể xóa phòng ban đang có ${linkedUsers} nhân viên trực thuộc. Vui lòng điều chuyển nhân sự trước khi xóa.`,
        },
        { status: 400 }
      )
    }

    await prisma.department.delete({ where: { id } })

    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'delete',
        resourceType: 'department',
        resourceId: id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ code: existingDept.code, name: existingDept.name }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Đã xóa phòng ban thành công.',
    })
  } catch (error: any) {
    console.error('Lỗi DELETE /api/departments/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi xóa phòng ban.' }, { status: 500 })
  }
}
