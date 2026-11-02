import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { revokeUserSessions } from '@/lib/auth/auth-service'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

/**
 * POST /api/auth/reset-password
 * Đặt lại mật khẩu sử dụng token đặt lại mật khẩu một lần
 */
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { token, newPassword } = body

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Mã xác nhận (token) không hợp lệ.' }, { status: 400 })
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' }, { status: 400 })
    }

    // Băm token đầu vào để đối chiếu với hash trong cơ sở dữ liệu
    const tokenHash = crypto.createHash('sha256').update(token.trim()).digest('hex')

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    })

    if (!resetRecord) {
      return NextResponse.json(
        { error: 'Liên kết đặt lại mật khẩu không hợp lệ, đã được sử dụng hoặc đã hết hạn.' },
        { status: 400 }
      )
    }

    if (!resetRecord.user.isActive) {
      return NextResponse.json(
        { error: 'Tài khoản người dùng đã bị vô hiệu hóa. Vui lòng liên hệ Admin.' },
        { status: 403 }
      )
    }

    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Đánh dấu token đã sử dụng, cập nhật mật khẩu mới và thu hồi mọi phiên đăng nhập
    await prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: { usedAt: new Date() },
      })

      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash,
          mustChangePassword: false,
          failedAttempts: 0,
          lockedUntil: null,
        },
      })

      await tx.auditLog.create({
        data: {
          orgId: resetRecord.user.orgId,
          userId: resetRecord.userId,
          action: 'edit',
          resourceType: 'user',
          resourceId: resetRecord.userId,
          status: 'SUCCESS',
          diffJson: JSON.stringify({ action: 'consume_password_reset_token' }),
        },
      })
    })

    await revokeUserSessions(resetRecord.userId)

    return NextResponse.json({
      success: true,
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.',
    })
  } catch (error: any) {
    console.error('Lỗi POST /api/auth/reset-password:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi đặt lại mật khẩu.' }, { status: 500 })
  }
}

