import { getSessionUser } from '@/lib/auth/auth-service'
import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth/auth-service'

export const dynamic = 'force-dynamic'

/**
 * Kiểm tra phân quyền cách ly dữ liệu phòng ban cho từng sự kiện đồng bộ
 * Khắc phục SEC-08: Data Isolation trong SSE
 */
async function canUserSeeEvent(user: AuthUser, ev: any): Promise<boolean> {
  // ADMIN có quyền nhận toàn bộ sự kiện trong tổ chức
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

    // Kiểm tra nếu được chia sẻ nội bộ
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
    // Chỉ quản lý phòng ban mới nhận được thông báo cấu hình
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
    return new Response('Unauthorized', { status: 401 })
  }

  const url = new URL(req.url)
  const lastEventIdHeader = req.headers.get('last-event-id')
  const cursorParam = url.searchParams.get('cursor')
  let lastEventId = lastEventIdHeader || cursorParam || null
  let lastCheckedAt = new Date()

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const safeEnqueue = (data: string) => {
        if (!isClosed) {
          try {
            controller.enqueue(encoder.encode(data))
          } catch {
            isClosed = true
          }
        }
      }

      // Initial connection packet
      safeEnqueue(`event: connected\ndata: ${JSON.stringify({ status: 'ok', userId: sessionUser.id })}\n\n`)

      const interval = setInterval(async () => {
        if (isClosed) {
          clearInterval(interval)
          return
        }

        try {
          // Định kỳ kiểm tra tính hợp lệ của session và user trong lúc stream đang mở (E3)
          if (sessionUser.sessionId) {
            const dbSession = await prisma.session.findUnique({
              where: { id: sessionUser.sessionId },
              include: { user: { select: { isActive: true, lockedUntil: true } } },
            })

            if (!dbSession || dbSession.revokedAt || dbSession.expiresAt < new Date() || !dbSession.user.isActive) {
              safeEnqueue(`event: error\ndata: ${JSON.stringify({ error: 'Session invalidated' })}\n\n`)
              isClosed = true
              clearInterval(interval)
              try { controller.close() } catch {}
              return
            }
          }

          // Truy vấn sự kiện mới dựa trên cursor (E2)
          let events = []
          if (lastEventId) {
            events = await prisma.syncEvent.findMany({
              where: {
                orgId: sessionUser.orgId,
                occurredAt: { gte: new Date(Date.now() - 300000) }, // 5 mins window
              },
              orderBy: { occurredAt: 'asc' },
              take: 50,
            })
            // Filter out events <= lastEventId if known
            const lastIdx = events.findIndex((e) => e.id === lastEventId)
            if (lastIdx !== -1) {
              events = events.slice(lastIdx + 1)
            }
          } else {
            events = await prisma.syncEvent.findMany({
              where: {
                orgId: sessionUser.orgId,
                occurredAt: { gt: lastCheckedAt },
              },
              orderBy: { occurredAt: 'asc' },
              take: 50,
            })
          }

          if (events.length > 0) {
            lastCheckedAt = new Date()
            lastEventId = events[events.length - 1].id

            for (const ev of events) {
              // Lọc quyền truy cập theo từng người dùng (E1: Data Isolation)
              const canSee = await canUserSeeEvent(sessionUser, ev)
              if (!canSee) continue

              safeEnqueue(
                `id: ${ev.id}\nevent: sync\ndata: ${JSON.stringify({
                  id: ev.id,
                  eventType: ev.eventType,
                  entityType: ev.entityType,
                  entityId: ev.entityId,
                  payload: sanitizePayload(ev.payload),
                  occurredAt: ev.occurredAt.toISOString(),
                })}\n\n`
              )
            }
          } else {
            // Heartbeat
            safeEnqueue(`event: ping\ndata: ${Date.now()}\n\n`)
          }
        } catch {
          isClosed = true
          clearInterval(interval)
          try { controller.close() } catch {}
        }
      }, 3000)

      req.signal.addEventListener('abort', () => {
        isClosed = true
        clearInterval(interval)
        try { controller.close() } catch {}
      })
    },
    cancel() {
      isClosed = true
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
