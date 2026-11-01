import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { validateCsrf } from '@/lib/security/csrf'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  // Check admin/manager permission
  if (user.role !== 'ADMIN' && user.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Bạn không có quyền quản lý phân quyền.' }, { status: 403 })
  }

  const [roles, departments, users, permissions, rolePermissions, userPermissions, deptPermissions] = await Promise.all([
    prisma.role.findMany(),
    prisma.department.findMany(),
    prisma.user.findMany({ select: { id: true, name: true, email: true, roleCode: true } }),
    prisma.permission.findMany(),
    prisma.rolePermission.findMany(),
    prisma.userPermission.findMany({ include: { permission: true } }),
    prisma.departmentPermission.findMany({ include: { permission: true } }),
  ])

  return NextResponse.json({
    roles,
    departments,
    users,
    permissions,
    rolePermissions,
    userPermissions,
    deptPermissions,
  })
}

export async function POST(req: Request) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Chỉ Quản trị viên (ADMIN) mới có quyền sửa đổi ma trận phân quyền.' }, { status: 403 })
  }

  try {
    const body = await req.json()
    const { targetType, targetId, permissionCode, isGranted, scope } = body

    const perm = await prisma.permission.findUnique({
      where: { code: permissionCode },
    })

    if (!perm) {
      return NextResponse.json({ error: 'Mã quyền không tồn tại.' }, { status: 400 })
    }

    if (targetType === 'ROLE') {
      if (isGranted) {
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: targetId, permissionId: perm.id } },
          update: {},
          create: { roleId: targetId, permissionId: perm.id },
        })
      } else {
        await prisma.rolePermission.deleteMany({
          where: { roleId: targetId, permissionId: perm.id },
        })
      }
    } else if (targetType === 'USER') {
      await prisma.userPermission.upsert({
        where: { userId_permissionId: { userId: targetId, permissionId: perm.id } },
        update: { isGranted, scope: scope || 'DEPARTMENT' },
        create: { userId: targetId, permissionId: perm.id, isGranted, scope: scope || 'DEPARTMENT' },
      })
    } else if (targetType === 'DEPARTMENT') {
      if (isGranted) {
        await prisma.departmentPermission.upsert({
          where: { departmentId_permissionId: { departmentId: targetId, permissionId: perm.id } },
          update: { scope: scope || 'DEPARTMENT' },
          create: { departmentId: targetId, permissionId: perm.id, scope: scope || 'DEPARTMENT' },
        })
      } else {
        await prisma.departmentPermission.deleteMany({
          where: { departmentId: targetId, permissionId: perm.id },
        })
      }
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        orgId: user.orgId,
        userId: user.id,
        action: 'permission_change',
        resourceType: 'permission',
        resourceId: `${targetType}:${targetId}:${permissionCode}`,
        diffJson: JSON.stringify({ isGranted, scope }),
        status: 'SUCCESS',
      },
    })

    return NextResponse.json({ success: true, message: 'Cập nhật quyền thành công.' })
  } catch (error: any) {
    console.error('Lỗi cập nhật quyền:', error)
    return NextResponse.json({ error: 'Lỗi cập nhật quyền.' }, { status: 500 })
  }
}

