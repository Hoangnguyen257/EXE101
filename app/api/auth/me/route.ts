import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  const effectivePermissions = await PermissionService.getEffectivePermissions(user.id)

  return NextResponse.json({
    authenticated: true,
    user,
    permissions: effectivePermissions,
  })
}

