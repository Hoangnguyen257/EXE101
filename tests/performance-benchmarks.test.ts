/**
 * KIỂM THỬ HIỆU NĂNG & BENCHMARK THỜI GIAN ĐÁP ỨNG HỆ THỐNG (LỖI 7)
 * Đo lường trước vs sau tối ưu Layout, và thời gian nạp của 5 trang chính:
 * 1. Layout Data Loading (Trước: Full SearchIndex vs Sau: Minimal)
 * 2. Trang /dashboard (< 2000ms)
 * 3. Trang /shipments (< 2000ms)
 * 4. Trang /documents (< 2000ms)
 * 5. Trang /audit (< 2000ms)
 * 6. API Tìm kiếm On-Demand (dbSearch) (< 1000ms)
 */

import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import {
  getDashboard,
  getShipments,
  getDocuments,
  getAuditLogs,
  getCurrentUser,
  getUsers,
  getSearchIndex,
  getAlerts,
  getCustomers,
} from '../lib/data'
import { dbSearch } from '../lib/db-search'
import bcrypt from 'bcryptjs'

async function runPerformanceBenchmarks() {
  console.log('\n=================================================================')
  console.log('   BẮT ĐẦU ĐO LƯỜNG HIỆU NĂNG HỆ THỐNG - BENCHMARK REPORT')
  console.log('=================================================================\n')

  const results: { test: string; status: 'PASS' | 'FAIL'; timeMs: number; target: string; note?: string }[] = []

  // 1. Lấy tài khoản admin hệ thống
  const adminUser = await prisma.user.findFirst({
    where: { email: 'admin@tml.vn' },
    include: { departments: { include: { department: true } } },
  })
  if (!adminUser) {
    throw new Error('Không tìm thấy tài khoản ADMIN trong cơ sở dữ liệu')
  }

  const sessionToken = `bench-session-${Date.now()}`
  const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex')
  await prisma.session.create({
    data: {
      id: sessionToken,
      tokenHash,
      userId: adminUser.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  })

  try {
    // --- 1. Đo lường Layout: Trước vs Sau tối ưu ---
    console.log('--- 1. ĐO HIỆU NĂNG NẠP DỮ LIỆU LAYOUT ---')
    // Layout cũ nạp đồng thời: getSearchIndex, getShipments, getCustomers, getCurrentUser, getUsers, getAlerts
    const startBefore = performance.now()
    await Promise.all([
      getSearchIndex(),
      getShipments(sessionToken),
      getCustomers(),
      getCurrentUser(sessionToken),
      getUsers(),
      getAlerts(undefined, sessionToken),
    ])
    const timeBefore = performance.now() - startBefore

    // Layout mới chỉ nạp: getCurrentUser, getUsers, count alerts
    const startAfter = performance.now()
    await Promise.all([
      getCurrentUser(sessionToken),
      getUsers(),
      prisma.notification.count({
        where: {
          userId: adminUser.id,
          isRead: false,
        },
      }),
    ])
    const timeAfter = performance.now() - startAfter
    const speedup = (timeBefore / Math.max(timeAfter, 0.1)).toFixed(1)

    console.log(`- Layout cũ (Nạp toàn bộ SearchIndex + Shipments + Alerts): ${timeBefore.toFixed(2)} ms`)
    console.log(`- Layout mới (Chỉ currentUser + users + alertCount)     : ${timeAfter.toFixed(2)} ms`)
    console.log(`=> Tốc độ nạp Layout nhanh hơn gấp ${speedup} lần!\n`)

    results.push({
      test: 'Layout Data Loading Optimization',
      status: timeAfter < timeBefore ? 'PASS' : 'FAIL',
      timeMs: Number(timeAfter.toFixed(2)),
      target: `< ${timeBefore.toFixed(0)} ms (cải thiện ${speedup}x)`,
      note: `Giảm từ ${timeBefore.toFixed(1)}ms xuống ${timeAfter.toFixed(1)}ms`,
    })

    // --- 2. Đo trang /dashboard ---
    console.log('--- 2. ĐO THỜI GIAN TRUY VẤN TRANG /dashboard ---')
    const startDash = performance.now()
    const dashData = await getDashboard(sessionToken)
    const timeDash = performance.now() - startDash
    console.log(`- Thời gian truy vấn /dashboard: ${timeDash.toFixed(2)} ms (Drafts: ${dashData.drafts.length}, Attention: ${dashData.attention.length})`)

    results.push({
      test: 'Trang /dashboard Query Latency',
      status: timeDash < 2000 ? 'PASS' : 'FAIL',
      timeMs: Number(timeDash.toFixed(2)),
      target: '< 2000 ms',
    })

    // --- 3. Đo trang /shipments ---
    console.log('--- 3. ĐO THỜI GIAN TRUY VẤN TRANG /shipments ---')
    const startShip = performance.now()
    const [ships, custs] = await Promise.all([
      getShipments(sessionToken),
      getCustomers(),
    ])
    const timeShip = performance.now() - startShip
    console.log(`- Thời gian truy vấn /shipments: ${timeShip.toFixed(2)} ms (Tổng lô: ${ships.length}, Khách: ${custs.length})`)

    results.push({
      test: 'Trang /shipments Query Latency',
      status: timeShip < 2000 ? 'PASS' : 'FAIL',
      timeMs: Number(timeShip.toFixed(2)),
      target: '< 2000 ms',
    })

    // --- 4. Đo trang /documents ---
    console.log('--- 4. ĐO THỜI GIAN TRUY VẤN TRANG /documents ---')
    const startDoc = performance.now()
    const [docs] = await Promise.all([
      getDocuments(sessionToken),
      getShipments(sessionToken),
      getCustomers(),
    ])
    const timeDoc = performance.now() - startDoc
    console.log(`- Thời gian truy vấn /documents: ${timeDoc.toFixed(2)} ms (Tổng chứng từ: ${docs.length})`)

    results.push({
      test: 'Trang /documents Query Latency',
      status: timeDoc < 2000 ? 'PASS' : 'FAIL',
      timeMs: Number(timeDoc.toFixed(2)),
      target: '< 2000 ms',
    })

    // --- 5. Đo trang /audit ---
    console.log('--- 5. ĐO THỜI GIAN TRUY VẤN TRANG /audit ---')
    const startAudit = performance.now()
    const auditLogs = await getAuditLogs(sessionToken)
    const timeAudit = performance.now() - startAudit
    console.log(`- Thời gian truy vấn /audit: ${timeAudit.toFixed(2)} ms (Tổng nhật ký: ${auditLogs.length})`)

    results.push({
      test: 'Trang /audit Query Latency',
      status: timeAudit < 2000 ? 'PASS' : 'FAIL',
      timeMs: Number(timeAudit.toFixed(2)),
      target: '< 2000 ms',
    })

    // --- 6. Đo API Tìm kiếm On-Demand (dbSearch) ---
    console.log('--- 6. ĐO THỜI GIAN API TÌM KIẾM ON-DEMAND (/api/search) ---')
    const startSearch = performance.now()
    const searchRes = await dbSearch(adminUser, {
      query: 'TML',
      scope: 'all',
      page: 1,
      limit: 20,
    })
    const timeSearch = performance.now() - startSearch
    console.log(`- Thời gian tìm kiếm dbSearch: ${timeSearch.toFixed(2)} ms (Kết quả: ${searchRes.total} mục)`)

    results.push({
      test: 'API Search On-Demand Latency',
      status: timeSearch < 1000 ? 'PASS' : 'FAIL',
      timeMs: Number(timeSearch.toFixed(2)),
      target: '< 1000 ms',
    })

    console.log('\n=================================================================')
    console.log('                BẢNG TỔNG HỢP HIỆU NĂNG ĐO ĐẠC')
    console.log('=================================================================')
    console.table(results)

    const allPassed = results.every((r) => r.status === 'PASS')
    if (allPassed) {
      console.log('🎉 TẤT CẢ CÁC MỤC TIÊU HIỆU NĂNG ĐÃ ĐẠT CHUẨN XUẤT SẮC (100% PASS)!')
    } else {
      console.error('❌ MỘT SỐ CHỈ TIÊU HIỆU NĂNG CHƯA ĐẠT')
      process.exit(1)
    }
  } finally {
    await prisma.session.delete({ where: { id: sessionToken } }).catch(() => {})
  }
}

runPerformanceBenchmarks().catch((err) => {
  console.error('Fatal benchmark error:', err)
  process.exit(1)
})
