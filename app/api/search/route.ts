import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { dbSearch } from '@/lib/db-search'
import type { SearchScope } from '@/lib/search'

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
      scope,
      total: 0,
      page: 1,
      limit,
      totalPages: 0,
      hits: [],
    })
  }

  // TÌM KIẾM TRỰC TIẾP TRÊN CƠ SỞ DỮ LIỆU CÓ PHÂN TRANG:
  // Không nạp toàn bộ danh sách chứng từ và text OCR vào RAM nữa.
  // Áp dụng bộ lọc phân quyền dữ liệu theo vai trò và phòng ban của sessionUser.
  const searchResult = await dbSearch(sessionUser, {
    query: q,
    scope,
    docType: docType || undefined,
    page,
    limit,
  })

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
        diffJson: JSON.stringify({ query: q.trim(), scope, totalHits: searchResult.total }),
      },
    }).catch(() => {})
  }

  return NextResponse.json(searchResult)
}

