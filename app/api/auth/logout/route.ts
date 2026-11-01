import { NextResponse } from 'next/server'
import { logout } from '@/lib/auth/auth-service'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    await logout()
    return NextResponse.json({ success: true, message: 'Đã đăng xuất an toàn.' })
  } catch (error: any) {
    console.error('API Logout Error:', error)
    return NextResponse.json({ error: 'Lỗi đăng xuất.' }, { status: 500 })
  }
}

