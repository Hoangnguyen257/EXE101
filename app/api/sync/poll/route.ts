import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import type { AuthUser } from '@/lib/auth/auth-service'

async function canUserSeeEvent(user: AuthUser, ev: any): Promise<boolean> {
  if (user.role === 'ADMIN') return true

  const userDeptIds = new Set(user.departments.map((d) => d.id))

  if (ev.entityType === 'document') {
    let payloadDeptId: string | undefined
    try {
      const parsed = JSON.parse(ev.payload || '{}')
      payloadDeptId = parsed.departmentId
    } catch {}

    const doc = await prisma.document.findUnique({
      where: { id: ev.entityId },
      select: { departmentId: true, createdBy: true, orgId: true },
    })

    if (!doc) {
      if (payloadDeptId && userDeptIds.has(payloadDeptId)) return true
      return false
    }

    if (doc.orgId !== user.orgId) return false
    if (doc.createdBy === user.id) return true
    if (doc.departmentId && userDeptIds.has(doc.departmentId)) return true

    const share = await prisma.documentAccessPermission.findFirst({
      where: {
        documentId: ev.entityId,
        OR: [
          { targetUserId: user.id },
          { targetDeptId: { in: Array.from(userDeptIds) } },
        ],
        AND: [
          {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: new Date() } },
            ],
          },
        ],
      },
    })
    return !!share
  }

  if (ev.entityType === 'shipment') {
    const shipment = await prisma.shipment.findUnique({
      where: { id: ev.entityId },
      select: { departmentId: true, ownerId: true, orgId: true },
    })
    if (!shipment) return false
    if (shipment.orgId !== user.orgId) return false
    if (shipment.ownerId === user.id) return true
    if (shipment.departmentId && userDeptIds.has(shipment.departmentId)) return true
    return false
  }

  if (ev.entityType === 'permission' || ev.entityType === 'user') {
    return user.role === 'MANAGER'
  }

  return false
}

function sanitizePayload(rawPayload: string): any {
  try {
    const data = JSON.parse(rawPayload || '{}')
    const { token, secret, passwordHash, ...safeData } = data
    return safeData
  } catch {
    return {}
  }
}

export async function GET(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since')
  const cursor = searchParams.get('cursor')
  const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000)

  let events = await prisma.syncEvent.findMany({
    where: {
      orgId: sessionUser.orgId,
      occurredAt: { gt: sinceDate },
    },
    orderBy: { occurredAt: 'asc' },
    take: 50,
  })

  if (cursor) {
    const idx = events.findIndex((e) => e.id === cursor)
    if (idx !== -1) {
      events = events.slice(idx + 1)
    }
  }

  // Lọc Data Isolation giữa các phòng ban (E1)
  const filteredEvents = []
  for (const ev of events) {
    if (await canUserSeeEvent(sessionUser, ev)) {
      filteredEvents.push(ev)
    }
  }

  const lastId = filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1].id : cursor

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    cursor: lastId,
    events: filteredEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      entityType: e.entityType,
      entityId: e.entityId,
      payload: sanitizePayload(e.payload),
      occurredAt: e.occurredAt.toISOString(),
    })),
  })
}
