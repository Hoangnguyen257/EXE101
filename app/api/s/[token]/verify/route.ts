import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signShareAccessToken } from '@/lib/auth/jwt'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '@/lib/security/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // 1. Rate limiting chống brute-force mật khẩu link chia sẻ
  const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rateLimitKey = `share_pw_${token}_${clientIp}`
  const limitStatus = checkRateLimit(rateLimitKey, { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 })

  if (!limitStatus.allowed) {
    return NextResponse.json(
      {
        error: `Quá số lần thử mật khẩu cho phép. Vui lòng thử lại sau ${limitStatus.retryAfterSeconds} giây.`,
        retryAfter: limitStatus.retryAfterSeconds,
      },
      { status: 429 }
    )
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  const { password } = body

  const share = await prisma.documentShare.findUnique({
    where: { token },
  })

  if (!share || share.isRevoked) {
    return NextResponse.json({ error: 'Liên kết không tồn tại hoặc đã bị thu hồi.' }, { status: 404 })
  }

  if (share.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Liên kết chia sẻ đã hết hạn.' }, { status: 410 })
  }

  if (share.maxViews && share.viewCount >= share.maxViews) {
    return NextResponse.json({ error: 'Liên kết này đã đạt giới hạn số lượt xem cho phép.' }, { status: 403 })
  }

  // Nếu link không có mật khẩu, tự động cấp credential
  if (!share.passwordHash) {
    const shareAccessToken = await signShareAccessToken(
      {
        shareId: share.id,
        token: share.token,
        documentId: share.documentId,
      },
      3600
    )

    const response = NextResponse.json({ success: true, shareAccessToken })
    response.cookies.set(`tml_share_access_${token}`, shareAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 3600,
    })
    return response
  }

  // Kiểm tra mật khẩu
  const isValid = await bcrypt.compare(password || '', share.passwordHash)

  if (!isValid) {
    const record = recordFailedAttempt(rateLimitKey, { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 })
    if (record.blocked) {
      return NextResponse.json(
        {
          error: `Bạn đã nhập sai mật khẩu 5 lần. Liên kết tạm thời bị khóa trong ${record.retryAfterSeconds} giây.`,
        },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: 'Mật khẩu truy cập không chính xác.' }, { status: 401 })
  }

  // Mật khẩu chính xác -> reset rate limit
  resetRateLimit(rateLimitKey)

  // Cấp signed share credential có thời hạn 1 giờ
  const shareAccessToken = await signShareAccessToken(
    {
      shareId: share.id,
      token: share.token,
      documentId: share.documentId,
    },
    3600
  )

  const response = NextResponse.json({ success: true, shareAccessToken })
  response.cookies.set(`tml_share_access_${token}`, shareAccessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 3600,
  })

  return response
}
