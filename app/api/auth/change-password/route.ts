import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { getSessionUser, revokeUserSessions } from '@/lib/auth/auth-service'
import { validateCsrf } from '@/lib/security/csrf'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const csrf = validateCsrf(req)
  if (!csrf.valid) {
    return NextResponse.json({ error: csrf.error }, { status: 403 })
  }

  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  try {
    const { currentPassword, newPassword } = await req.json()

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Vui lòng điền đầy đủ mật khẩu hiện tại và mật khẩu mới.' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Mật khẩu mới phải có ít nhất 8 ký tự.' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
    })

    if (!user) {
      return NextResponse.json({ error: 'Người dùng không tồn tại.' }, { status: 404 })
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isMatch) {
      return NextResponse.json({ error: 'Mật khẩu hiện tại không chính xác.' }, { status: 400 })
    }

    const newHash = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        mustChangePassword: false,
      },
    })

    // Thu hồi các phiên đăng nhập khác của người dùng để bảo mật (B2)
    await revokeUserSessions(user.id)

    // Audit Log
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: user.id,
        action: 'permission_change',
        resourceType: 'user',
        resourceId: user.id,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ action: 'change_password' }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Đổi mật khẩu thành công. Các phiên đăng nhập trên thiết bị khác đã được thu hồi.',
    })
  } catch (error: any) {
    console.error('Lỗi đổi mật khẩu:', error)
    return NextResponse.json({ error: 'Lỗi máy chủ khi đổi mật khẩu.' }, { status: 500 })
  }
}

