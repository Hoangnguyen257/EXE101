import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { search, type SearchScope } from '@/lib/search'
import { getDocuments, getShipments, getCustomers } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const scope = (searchParams.get('scope') || 'all') as SearchScope
  const docType = searchParams.get('type')
  const page = Math.max(1, Number(searchParams.get('page')) || 1)
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit')) || 20))

  if (!q.trim()) {
    return NextResponse.json({
      query: '',
      total: 0,
      page: 1,
      limit,
      hits: [],
    })
  }

  // BẢO MẬT BẮT BUỘC (Section 5.3):
  // Nạp dữ liệu qua getDocuments(), getShipments() - vốn đã được lọc quyền nghiêm ngặt
  // theo vai trò và phòng ban của sessionUser. Không bao giờ tìm kiếm trên dữ liệu ngoài quyền.
  const [docs, shipments, customers] = await Promise.all([
    getDocuments(),
    getShipments(),
    getCustomers(),
  ])

  // Lọc theo docType nếu có
  const filteredDocs = docType && docType !== 'all' ? docs.filter((d) => d.type === docType) : docs

  const searchIndex = {
    documents: filteredDocs.map(({ versions: _v, ...d }) => d),
    shipments,
    customers,
  }

  // Thực hiện tìm kiếm thông minh: Levenshtein + chuẩn hóa tiếng Việt + OCR matching
  const allHits = search(searchIndex as any, q.trim(), scope)

  // Phân trang kết quả
  const total = allHits.length
  const startIndex = (page - 1) * limit
  const paginatedHits = allHits.slice(startIndex, startIndex + limit)

  // Ghi Audit Log cho hành vi tìm kiếm (không log rầm rộ nếu query quá ngắn)
  if (q.trim().length >= 3) {
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'view',
        resourceType: 'search',
        resourceId: `search:${scope}:${q.trim().slice(0, 30)}`,
        status: 'SUCCESS',
        diffJson: JSON.stringify({ query: q.trim(), scope, totalHits: total }),
      },
    }).catch(() => {})
  }

  return NextResponse.json({
    query: q,
    scope,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    hits: paginatedHits,
  })
}

