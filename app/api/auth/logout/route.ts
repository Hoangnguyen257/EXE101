import { NextResponse } from 'next/server'
import { logout, SESSION_COOKIE_NAME } from '@/lib/auth/auth-service'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await logout()
    const response = NextResponse.json({ success: true, message: 'Đã đăng xuất an toàn.' })
    response.cookies.delete(SESSION_COOKIE_NAME)
    return response
  } catch (error: any) {
    console.error('API Logout Error:', error)
    return NextResponse.json({ error: 'Lỗi đăng xuất.' }, { status: 500 })
  }
}


