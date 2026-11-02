import { prisma } from '@/lib/prisma'
import { PermissionService } from '@/lib/auth/permission-service'
import type { SearchScope, SearchHit } from '@/lib/search'
import { snippet } from '@/lib/search'

export interface DbSearchParams {
  query: string
  scope?: SearchScope
  docType?: string
  page?: number
  limit?: number
}

export interface DbSearchResult {
  query: string
  scope: SearchScope
  total: number
  page: number
  limit: number
  totalPages: number
  hits: SearchHit[]
}

/**
 * Truy vấn tìm kiếm trực tiếp trên Cơ sở dữ liệu (Database-driven Search)
 * Phân trang chuẩn xác và lọc quyền hạn theo sessionUser
 */
export async function dbSearch(
  sessionUser: any,
  params: DbSearchParams
): Promise<DbSearchResult> {
  const { query, scope = 'all', docType, page = 1, limit = 20 } = params
  const trimmed = query.trim()
  if (!trimmed) {
    return {
      query: '',
      scope,
      total: 0,
      page: 1,
      limit,
      totalPages: 0,
      hits: [],
    }
  }

  const includeShipments = scope === 'all' || scope === 'job' || scope === 'bill' || scope === 'customer'
  const includeDocs = scope === 'all' || scope === 'job' || scope === 'bill' || scope === 'customer' || scope === 'content'

  let shipmentHits: SearchHit[] = []
  let docHits: SearchHit[] = []
  let totalShipments = 0
  let totalDocs = 0

  if (includeShipments) {
    const shipmentScope = await PermissionService.buildShipmentWhereInput(sessionUser, 'VIEW')
    const orConds: any[] = []
    if (scope === 'all' || scope === 'job') {
      orConds.push({ jobNo: { contains: trimmed } })
    }
    if (scope === 'all' || scope === 'bill') {
      orConds.push({ blNo: { contains: trimmed } })
    }
    if (scope === 'all' || scope === 'customer') {
      orConds.push({
        customer: {
          OR: [
            { name: { contains: trimmed } },
            { shortName: { contains: trimmed } },
          ],
        },
      })
    }

    const where = {
      AND: [shipmentScope, { OR: orConds }],
    }

    const [count, rows] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        where,
        include: { customer: true },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    totalShipments = count
    shipmentHits = rows.map((s) => ({
      id: `sh_${s.id}`,
      kind: 'shipment' as const,
      href: `/shipments/${s.id}`,
      title: s.jobNo,
      subtitle: `B/L ${s.blNo || 'Chưa có'} · ${s.customer?.shortName || 'Khách hàng'}`,
      matchedIn: (s.jobNo.includes(trimmed) ? 'job' : s.blNo?.includes(trimmed) ? 'bill' : 'customer') as SearchScope,
      score: 10,
    }))
  }

  if (includeDocs) {
    const docScope = await PermissionService.buildDocumentWhereInput(sessionUser, 'VIEW')
    const orConds: any[] = []
    if (scope === 'all' || scope === 'job') {
      orConds.push({ title: { contains: trimmed } })
      orConds.push({ fileName: { contains: trimmed } })
      orConds.push({ shipment: { jobNo: { contains: trimmed } } })
    }
    if (scope === 'all' || scope === 'bill') {
      orConds.push({ shipment: { blNo: { contains: trimmed } } })
    }
    if (scope === 'all' || scope === 'customer') {
      orConds.push({
        customer: {
          OR: [
            { name: { contains: trimmed } },
            { shortName: { contains: trimmed } },
          ],
        },
      })
    }
    if (scope === 'all' || scope === 'content') {
      orConds.push({
        ocrResults: {
          some: {
            rawText: { contains: trimmed },
          },
        },
      })
    }

    const where: any = {
      AND: [
        docScope,
        { isDeleted: false },
        ...(docType && docType !== 'all' ? [{ type: docType }] : []),
        { OR: orConds },
      ],
    }

    const [count, rows] = await Promise.all([
      prisma.document.count({ where }),
      prisma.document.findMany({
        where,
        include: {
          customer: true,
          shipment: true,
          ocrResults: { take: 1, orderBy: { extractedAt: 'desc' } },
        },
        take: limit,
        skip: (page - 1) * limit,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    totalDocs = count
    docHits = rows.map((d) => {
      const ocrRaw = d.ocrResults[0]?.rawText || ''
      const idx = ocrRaw.toLowerCase().indexOf(trimmed.toLowerCase())
      const snip = idx >= 0 ? snippet(ocrRaw, idx, trimmed.length) : undefined
      const matchedField: SearchScope =
        idx >= 0
          ? 'content'
          : d.shipment?.jobNo?.includes(trimmed)
          ? 'job'
          : d.shipment?.blNo?.includes(trimmed)
          ? 'bill'
          : 'customer'

      return {
        id: d.id,
        kind: 'document' as const,
        href: `/documents/${d.id}`,
        title: d.title,
        subtitle: `${d.shipment?.jobNo || ''} · ${d.customer?.shortName || ''}`,
        snippet: snip,
        matchedIn: matchedField,
        score: idx >= 0 ? 5 : 8,
      }
    })
  }

  const total = totalShipments + totalDocs
  const combinedHits = [...shipmentHits, ...docHits].slice(0, limit)

  return {
    query: trimmed,
    scope,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hits: combinedHits,
  }
}
