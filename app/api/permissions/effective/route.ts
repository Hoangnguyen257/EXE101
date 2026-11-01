import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const userId = searchParams.get('userId') || sessionUser.id

  // Non-admins can only view their own permissions
  if (sessionUser.role !== 'ADMIN' && sessionUser.id !== userId) {
    return NextResponse.json({ error: 'Không được phép xem quyền của người khác.' }, { status: 403 })
  }

  const effective = await PermissionService.getEffectivePermissions(userId)

  return NextResponse.json({
    userId,
    effective,
  })
}

