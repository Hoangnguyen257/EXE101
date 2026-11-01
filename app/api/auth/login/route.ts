import { NextResponse } from 'next/server'
import { loginHardened, UNIFIED_AUTH_ERROR_MESSAGE } from '@/lib/auth/auth-service'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, captchaToken } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'Vui lòng nhập đầy đủ email và mật khẩu.' }, { status: 400 })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || '127.0.0.1'
    const userAgent = req.headers.get('user-agent') || 'Unknown'

    const result = await loginHardened(email, password, ip, userAgent, captchaToken)

    if (!result.success) {
      if ((result as any).isIpBlocked) {
        return NextResponse.json(
          { error: result.error, retryAfter: (result as any).retryAfterSeconds },
          { status: 429 }
        )
      }
      return NextResponse.json({ error: UNIFIED_AUTH_ERROR_MESSAGE }, { status: 401 })
    }

    return NextResponse.json({ success: true, message: 'Đăng nhập thành công.' })
  } catch (error: any) {
    console.error('API Login Error:', error)
    return NextResponse.json(
      {
        error: 'Đã xảy ra lỗi máy chủ nội bộ.',
        detail: process.env.NODE_ENV !== 'production' || process.env.VERCEL ? error?.message : undefined,
      },
      { status: 500 }
    )
  }
}

