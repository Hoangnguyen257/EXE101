import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

function generateInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'TM'
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
  const first = parts[0][0]
  const last = parts[parts.length - 1][0]
  return (first + last).toUpperCase()
}

function generateSecureTemporaryPassword(length = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const numbers = '23456789'
  const special = '!@#$%^&*'
  const all = upper + lower + numbers + special

  const bytes = crypto.randomBytes(length)
  const result: string[] = [
    upper[bytes[0] % upper.length],
    lower[bytes[1] % lower.length],
    numbers[bytes[2] % numbers.length],
    special[bytes[3] % special.length],
  ]
  for (let i = 4; i < length; i++) {
    result.push(all[bytes[i] % all.length])
  }
  for (let i = result.length - 1; i > 0; i--) {
    const j = bytes[i] % (i + 1)
    const temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result.join('')
}

/**
 * GET /api/users
 * Lấy danh sách người dùng trong tổ chức (Yêu cầu quyền USERS:VIEW)
 */
export async function GET(req: Request) {
  try {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'USERS', 'VIEW')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Bạn không có quyền xem danh sách người dùng.' }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: { orgId: sessionUser.orgId },
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
        departments: {
          select: {
            id: true,
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
            position: {
              select: { id: true, name: true, level: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ users })
  } catch (error: any) {
    console.error('Lỗi GET /api/users:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi lấy danh sách người dùng.' }, { status: 500 })
  }
}

/**
 * POST /api/users
 * Tạo tài khoản người dùng mới (Yêu cầu quyền USERS:CREATE - Chỉ ADMIN)
 * Sinh mật khẩu tạm thời ngẫu nhiên hiển thị một lần duy nhất, mustChangePassword = true
 */
export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) {
      return NextResponse.json({ error: 'Chưa đăng nhập (Unauthenticated).' }, { status: 401 })
    }

    const perm = await PermissionService.check(sessionUser, 'USERS', 'CREATE')
    if (!perm.allowed) {
      return NextResponse.json({ error: perm.reason || 'Chỉ Quản trị viên (ADMIN) mới có quyền tạo tài khoản người dùng.' }, { status: 403 })
    }

    const body = await req.json()
    const { email, name, roleCode, departmentId, positionId, isManager } = body

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email không hợp lệ.' }, { status: 400 })
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Họ và tên phải có ít nhất 2 ký tự.' }, { status: 400 })
    }

    const validRoles = ['ADMIN', 'MANAGER', 'STAFF']
    if (!roleCode || !validRoles.includes(roleCode)) {
      return NextResponse.json({ error: 'Vai trò (roleCode) không hợp lệ (ADMIN, MANAGER, STAFF).' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Kiểm tra trùng lặp email
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    })
    if (existing) {
      return NextResponse.json({ error: 'Địa chỉ email này đã tồn tại trong hệ thống.' }, { status: 409 })
    }

    // Xác minh phòng ban nếu có
    if (departmentId) {
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, orgId: sessionUser.orgId },
      })
      if (!dept) {
        return NextResponse.json({ error: 'Phòng ban được chọn không tồn tại.' }, { status: 400 })
      }
    }

    // Xác minh chức danh nếu có
    if (positionId) {
      const pos = await prisma.position.findFirst({
        where: { id: positionId, orgId: sessionUser.orgId },
      })
      if (!pos) {
        return NextResponse.json({ error: 'Chức danh được chọn không tồn tại.' }, { status: 400 })
      }
    }

    // Sinh mật khẩu tạm ngẫu nhiên bảo mật cao và mã hóa Bcrypt
    const temporaryPassword = generateSecureTemporaryPassword(16)
    const passwordHash = await bcrypt.hash(temporaryPassword, 10)
    const initials = generateInitials(name)

    // Tạo bản ghi User + Department Link + Position Link trong một transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          orgId: sessionUser.orgId,
          email: normalizedEmail,
          passwordHash,
          name: name.trim(),
          initials,
          roleCode,
          isActive: true,
          mustChangePassword: true,
        },
      })

      if (departmentId) {
        await tx.userDepartment.create({
          data: {
            userId: user.id,
            departmentId,
            isPrimary: true,
            isManager: Boolean(isManager),
          },
        })
      }

      if (positionId) {
        await tx.userPosition.create({
          data: {
            userId: user.id,
            positionId,
          },
        })
      }

      await tx.auditLog.create({
        data: {
          orgId: sessionUser.orgId,
          userId: sessionUser.id,
          action: 'create',
          resourceType: 'user',
          resourceId: user.id,
          status: 'SUCCESS',
          diffJson: JSON.stringify({
            email: user.email,
            name: user.name,
            roleCode: user.roleCode,
            departmentId,
            positionId,
          }),
        },
      })

      return user
    })

    return NextResponse.json(
      {
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          roleCode: newUser.roleCode,
          isActive: newUser.isActive,
          mustChangePassword: newUser.mustChangePassword,
        },
        temporaryPassword,
        message: 'Tạo tài khoản người dùng thành công. Mật khẩu tạm thời chỉ được hiển thị một lần.',
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Lỗi POST /api/users:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi tạo tài khoản người dùng.' }, { status: 500 })
  }
}
