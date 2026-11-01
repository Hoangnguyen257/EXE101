import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/auth-service'
import { getAlerts } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const kind = searchParams.get('kind') // 'missing' | 'retention'
  const severity = searchParams.get('severity') // 'high' | 'medium' | 'low'

  const allAlerts = await getAlerts()

  let filtered = allAlerts
  if (kind) {
    filtered = filtered.filter((a) => a.kind === kind)
  }
  if (severity) {
    filtered = filtered.filter((a) => a.severity === severity)
  }

  return NextResponse.json({
    total: filtered.length,
    highPriorityCount: filtered.filter((a) => a.severity === 'high').length,
    alerts: filtered,
  })
}

