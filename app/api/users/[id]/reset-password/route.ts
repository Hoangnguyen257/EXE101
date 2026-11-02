import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, revokeUserSessions } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

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
 * POST /api/users/[id]/reset-password
 * Quản trị viên cấp lại mật khẩu tạm thời hoặc tạo token đặt lại mật khẩu một lần
 */
export async function POST(
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
      return NextResponse.json({ error: perm.reason || 'Chỉ Quản trị viên (ADMIN) mới có quyền đặt lại mật khẩu người dùng.' }, { status: 403 })
    }

    const targetUser = await prisma.user.findFirst({
      where: { id, orgId: sessionUser.orgId },
    })
    if (!targetUser) {
      return NextResponse.json({ error: 'Không tìm thấy người dùng.' }, { status: 404 })
    }

    let body: any = {}
    try {
      body = await req.json()
    } catch {
      // Body rỗng mặc định dùng mode temp_password
    }

    const mode = body.mode === 'reset_token' ? 'reset_token' : 'temp_password'

    if (mode === 'temp_password') {
      // 1. Cấp mật khẩu tạm mới
      const temporaryPassword = generateSecureTemporaryPassword(16)
      const passwordHash = await bcrypt.hash(temporaryPassword, 10)

      await prisma.user.update({
        where: { id },
        data: {
          passwordHash,
          mustChangePassword: true,
          failedAttempts: 0,
          lockedUntil: null,
        },
      })

      // Bắt buộc thu hồi mọi phiên đăng nhập cũ
      await revokeUserSessions(id)

      await prisma.auditLog.create({
        data: {
          orgId: sessionUser.orgId,
          userId: sessionUser.id,
          action: 'edit',
          resourceType: 'user',
          resourceId: id,
          status: 'SUCCESS',
          diffJson: JSON.stringify({ action: 'reset_temp_password' }),
        },
      })

      return NextResponse.json({
        success: true,
        mode: 'temp_password',
        temporaryPassword,
        message: 'Đã cấp mật khẩu tạm thời mới thành công. Hãy gửi mật khẩu này cho nhân viên.',
      })
    } else {
      // 2. Tạo token đặt lại mật khẩu dùng một lần có hạn lưu hash
      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 giờ

      await prisma.passwordResetToken.create({
        data: {
          userId: id,
          tokenHash,
          expiresAt,
        },
      })

      await prisma.auditLog.create({
        data: {
          orgId: sessionUser.orgId,
          userId: sessionUser.id,
          action: 'edit',
          resourceType: 'user',
          resourceId: id,
          status: 'SUCCESS',
          diffJson: JSON.stringify({ action: 'create_password_reset_token', expiresAt }),
        },
      })

      const resetUrl = `/reset-password?token=${rawToken}`

      return NextResponse.json({
        success: true,
        mode: 'reset_token',
        resetToken: rawToken,
        resetUrl,
        expiresAt: expiresAt.toISOString(),
        message: 'Đã tạo liên kết đặt lại mật khẩu thành công. Liên kết có hiệu lực trong 24 giờ.',
      })
    }
  } catch (error: any) {
    console.error('Lỗi POST /api/users/[id]/reset-password:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi đặt lại mật khẩu người dùng.' }, { status: 500 })
  }
}
