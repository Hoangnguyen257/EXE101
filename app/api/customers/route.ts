import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const customers = await prisma.customer.findMany({
    where: { orgId: sessionUser.orgId },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      orgId: true,
      name: true,
      shortName: true,
      taxCode: true,
    },
  })

  return NextResponse.json({ customers })
}

