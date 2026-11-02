import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, revokeUserSessions } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'

function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  const first = parts[0][0]
  const last = parts[parts.length - 1][0]
  return (first + last).toUpperCase()
}

/**
 * GET /api/users/[id]
 * Lấy thông tin chi tiết một người dùng
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

    const perm = await PermissionService.check(sessionUser, 'USERS', 'VIEW')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem thông tin người dùng.' }, { status: 403 })
    }

    const user = await prisma.user.findFirst({
      where: { id, orgId: sessionUser.orgId },
      select: {
        id: true,
        email: true,
        name: true,
        initials: true,
        roleCode: true,
        isActive: true,
        mustChangePassword: true,
        failedAttempts: true,
        lockedUntil: true,
        lastActiveAt: true,
        createdAt: true,
        updatedAt: true,
        departments: {
          select: {
            id: true,
            departmentId: true,
            isPrimary: true,
            isManager: true,
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        positions: {
          select: {
            id: true,
            positionId: true,
            position: {
              select: { id: true, name: true, level: true },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng.' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error: any) {
    console.error('Lỗi GET /api/users/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi lấy thông tin người dùng.' }, { status: 500 })
  }
}

/**
 * PATCH /api/users/[id]
 * Cập nhật thông tin, vai trò, phòng ban, hoặc trạng thái khóa/mở khóa người dùng
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

    const perm = await PermissionService.check(sessionUser, 'USERS', 'EDIT')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Chỉ Quản trị viên (ADMIN) mới có quyền chỉnh sửa người dùng.' }, { status: 403 })
    }

    const targetUser = await prisma.user.findFirst({
      where: { id, orgId: sessionUser.orgId },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng cần cập nhật.' }, { status: 404 })
    }

    const body = await req.json()
    const { name, roleCode, departmentId, positionId, isManager, isActive } = body

    // Chặn người dùng tự khóa tài khoản của chính mình
    if (id === sessionUser.id && isActive === false) {
      return NextResponse.json({ error: 'Bạn không thể tự vô hiệu hóa tài khoản của chính mình.' }, { status: 400 })
    }

    // Nếu tài khoản bị vô hiệu hóa (isActive = false), BẮT BUỘC thu hồi toàn bộ phiên đăng nhập ngay lập tức
    if (isActive === false) {
      await revokeUserSessions(id)
    }

    const validRoles = ['ADMIN', 'MANAGER', 'STAFF']
    if (roleCode && !validRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Vai trò (roleCode) không hợp lệ.' }, { status: 400 })
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {}

      if (typeof name === 'string' && name.trim().length >= 2) {
        dataToUpdate.name = name.trim()
        dataToUpdate.initials = generateInitials(name)
      }

      if (roleCode) {
        dataToUpdate.roleCode = roleCode
      }

      if (typeof isActive === 'boolean') {
        dataToUpdate.isActive = isActive
        if (isActive === true) {
          // Mở khóa: xóa số lần thử sai và gỡ hạn khóa
          dataToUpdate.failedAttempts = 0
          dataToUpdate.lockedUntil = null
        }
      }

      const u = await tx.user.update({
        where: { id },
        data: dataToUpdate,
      })

      // Cập nhật phòng ban nếu có
      if (departmentId !== undefined) {
        if (departmentId) {
          // Gỡ bỏ primary cũ
          await tx.userDepartment.updateMany({
            where: { userId: id, isPrimary: true },
            data: { isPrimary: false },
          })

          // Upsert phòng ban mới làm primary
          await tx.userDepartment.upsert({
            where: { userId_departmentId: { userId: id, departmentId } },
            update: { isPrimary: true, isManager: Boolean(isManager) },
            create: {
              userId: id,
              departmentId,
              isPrimary: true,
              isManager: Boolean(isManager),
            },
          })
        } else {
          // Xóa liên kết phòng ban nếu truyền null/empty
          await tx.userDepartment.deleteMany({
            where: { userId: id },
          })
        }
      }

      // Cập nhật chức danh nếu có
      if (positionId !== undefined) {
        if (positionId) {
          await tx.userPosition.deleteMany({ where: { userId: id } })
          await tx.userPosition.create({
            data: { userId: id, positionId },
          })
        } else {
          await tx.userPosition.deleteMany({ where: { userId: id } })
        }
      }

      await tx.auditLog.create({
        data: {
          orgId: sessionUser.orgId,
          userId: sessionUser.id,
          action: 'edit',
          resourceType: 'user',
          resourceId: id,
          status: 'SUCCESS',
          diffJson: JSON.stringify({
            name: dataToUpdate.name,
            roleCode: dataToUpdate.roleCode,
            isActive: dataToUpdate.isActive,
            departmentId,
            positionId,
          }),
        },
      })

      return u
    })

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        roleCode: updatedUser.roleCode,
        isActive: updatedUser.isActive,
        mustChangePassword: updatedUser.mustChangePassword,
      },
      message: 'Cập nhật thông tin người dùng thành công.',
    })
  } catch (error: any) {
    console.error('Lỗi PATCH /api/users/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi cập nhật người dùng.' }, { status: 500 })
  }
}

/**
 * DELETE /api/users/[id]
 * Xóa người dùng hoặc chuyển sang trạng thái vô hiệu hóa nếu đã có dữ liệu liên kết
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

    const perm = await PermissionService.check(sessionUser, 'USERS', 'DELETE')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Chỉ Quản trị viên (ADMIN) mới có quyền xóa người dùng.' }, { status: 403 })
    }

    if (id === sessionUser.id) {
      return NextResponse.json({ error: 'Không thể xóa tài khoản của chính mình.' }, { status: 400 })
    }

    const targetUser = await prisma.user.findFirst({
      where: { id, orgId: sessionUser.orgId },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng cần xóa.' }, { status: 404 })
    }

    // Thu hồi toàn bộ phiên trước khi thao tác
    await revokeUserSessions(id)

    try {
      await prisma.user.delete({ where: { id } })
      return NextResponse.json({
        success: true,
        message: 'Đã xóa người dùng thành công khỏi hệ thống.',
      })
    } catch {
      // Nếu có ràng buộc khóa ngoại với chứng từ/lô hàng cũ, chuyển sang vô hiệu hóa an toàn
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      })
      return NextResponse.json({
        success: true,
        message: 'Tài khoản đã có lịch sử chứng từ/lô hàng, hệ thống đã tự động vô hiệu hóa an toàn thay vì xóa vật lý.',
      })
    }
  } catch (error: any) {
    console.error('Lỗi DELETE /api/users/[id]:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi xóa người dùng.' }, { status: 500 })
  }
}
