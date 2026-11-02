import assert from 'node:assert'
import { prisma } from '../lib/prisma'
import { getShipment, getDashboard } from '../lib/data'
import { formatDate, formatDateTime, formatRelative } from '../lib/labels'
import { login } from '../lib/auth/auth-service'

async function runTest() {
  console.log('================================================================================')
  console.log('🧪 TEST: LỖI 2 - KHẮC PHỤC TRƯỜNG NULLABLE & ĐIỀU HƯỚNG LÔ DRAFT AN TOÀN')
  console.log('================================================================================')

  const adminAuth = await login('admin@tml.vn', 'Tml@2026!')
  assert(adminAuth && adminAuth.token, 'Đăng nhập admin thành công')

  const org = await prisma.organization.findFirst()
  assert(org, 'Cần Organization')
  const user = await prisma.user.findFirst({ where: { orgId: org.id } })
  assert(user, 'Cần User')
  const dept = await prisma.department.findFirst({ where: { orgId: org.id } })

  // ---------------------------------------------------------------------------
  // TRƯỜNG HỢP 1: LÔ ĐANG SOẠN DỞ (DRAFT)
  // ---------------------------------------------------------------------------
  console.log('\n[TRƯỜNG HỢP 1] LÔ ĐANG SOẠN DỞ (DRAFT - VÍ DỤ TML-SE2611-3483)')
  const draftShipment = await prisma.shipment.create({
    data: {
      orgId: org.id,
      jobNo: `TML-SE2611-${Math.floor(1000 + Math.random() * 9000)}`,
      mode: 'sea',
      origin: 'Cat Lai, Ho Chi Minh, VN',
      destination: 'Rotterdam, NL',
      status: 'draft',
      draftStep: 2,
      ownerId: user.id,
      departmentId: dept?.id || null,
      customerId: null,
      blNo: null,
      etd: null,
      eta: null,
    },
  })

  const draftData = await getShipment(draftShipment.id)
  assert(draftData !== null, 'getShipment phải nạp thành công lô nháp')
  assert.strictEqual(draftData.shipment.status, 'draft', 'Trạng thái lô là draft')
  assert.strictEqual(draftData.customer.name, 'Chưa xác định', 'Khách hàng chưa gán hiển thị "Chưa xác định"')
  assert.strictEqual(draftData.shipment.blNo, '', 'B/L rỗng an toàn')

  // Kiểm tra điều hướng: Lô draft phải mở lại Wizard đúng bước
  const expectedRedirect = `/shipments/new?id=${draftShipment.id}&step=2`
  const computedRedirect = `/shipments/new?id=${draftData.shipment.id}&step=${draftData.shipment.draftStep || 1}`
  assert.strictEqual(computedRedirect, expectedRedirect, 'Lô draft điều hướng chính xác về Wizard Bước 2')
  console.log(`✅ [PASS] Lô draft "${draftShipment.jobNo}" nạp thành công, xác nhận điều hướng: ${computedRedirect}`)

  // ---------------------------------------------------------------------------
  // TRƯỜNG HỢP 2: LÔ THIẾU B/L VÀ ETD/ETA (NULLABLE FIELDS)
  // ---------------------------------------------------------------------------
  console.log('\n[TRƯỜNG HỢP 2] LÔ HÀNG THIẾU B/L VÀ ETD/ETA (CÁC TRƯỜNG NULLABLE)')
  const nullableShipment = await prisma.shipment.create({
    data: {
      orgId: org.id,
      jobNo: `JOB-NULL-${Date.now()}`,
      mode: 'air',
      origin: 'Tan Son Nhat (SGN), VN',
      destination: 'Incheon (ICN), KR',
      status: 'booking',
      draftStep: 3,
      ownerId: user.id,
      departmentId: dept?.id || null,
      customerId: null,
      blNo: null,
      etd: null,
      eta: null,
    },
  })

  const nullData = await getShipment(nullableShipment.id)
  assert(nullData !== null, 'getShipment phải nạp thành công lô thiếu B/L, ETD, ETA')

  // Kiểm tra formatDate, formatDateTime, formatRelative không ném lỗi RangeError
  let dateFormattedEtd = ''
  let dateFormattedEta = ''
  assert.doesNotThrow(() => {
    dateFormattedEtd = formatDate(nullData.shipment.etd)
    dateFormattedEta = formatDate(nullData.shipment.eta)
    formatDateTime(nullData.shipment.etd)
    formatRelative(nullData.shipment.etd)
  }, 'formatDate / formatRelative không được ném lỗi Invalid time value')

  assert.strictEqual(dateFormattedEtd, '—', 'ETD null hiển thị fallback an toàn "—"')
  assert.strictEqual(dateFormattedEta, '—', 'ETA null hiển thị fallback an toàn "—"')
  console.log(`✅ [PASS] Lô thiếu B/L và ETD/ETA nạp mượt mà, định dạng ngày tháng an toàn không ném lỗi`)

  // ---------------------------------------------------------------------------
  // TRƯỜNG HỢP 3: LÔ HÀNG ĐẦY ĐỦ THÔNG TIN
  // ---------------------------------------------------------------------------
  console.log('\n[TRƯỜNG HỢP 3] LÔ HÀNG ĐẦY ĐỦ THÔNG TIN')
  const fullShipment = await prisma.shipment.create({
    data: {
      orgId: org.id,
      jobNo: `JOB-FULL-${Date.now()}`,
      mode: 'sea',
      origin: 'Hai Phong Port, VN',
      destination: 'Tokyo Port, JP',
      status: 'in_transit',
      draftStep: 3,
      ownerId: user.id,
      departmentId: dept?.id || null,
      blNo: 'MAEU99887766',
      etd: '2026-11-10T08:00:00Z',
      eta: '2026-11-25T17:00:00Z',
    },
  })

  const fullData = await getShipment(fullShipment.id)
  assert(fullData !== null, 'getShipment phải nạp thành công lô đầy đủ')
  assert.strictEqual(fullData.shipment.blNo, 'MAEU99887766')
  const formattedFullEtd = formatDate(fullData.shipment.etd)
  assert(formattedFullEtd !== '—', 'ETD đầy đủ phải được định dạng chính xác')
  console.log(`✅ [PASS] Lô đầy đủ "${fullShipment.jobNo}" hiển thị đúng B/L (${fullData.shipment.blNo}) và ngày (${formattedFullEtd})`)

  // ---------------------------------------------------------------------------
  // PHẦN 4: DASHBOARD TÁCH BIỆT DRAFT VÀ DANH SÁCH THIẾU CHỨNG TỪ
  // ---------------------------------------------------------------------------
  console.log('\n[PHẦN 4] KIỂM TRA DASHBOARD TÁCH BIỆT "LÔ SOẠN DỞ" VÀ "THIẾU CHỨNG TỪ"')
  const dashboard = await getDashboard(adminAuth.token)

  // Lô draft KHÔNG ĐƯỢC nằm trong attention (Lô hàng cần bổ sung chứng từ)
  const draftInAttention = dashboard.attention.some((s) => s.id === draftShipment.id)
  assert(!draftInAttention, 'Lô draft TUYỆT ĐỐI KHÔNG được tính vào danh sách attention (cần bổ sung chứng từ)')
  console.log('✅ [PASS] Lô draft không bị đưa vào danh sách attention')

  // Lô draft PHẢI nằm trong danh sách drafts (Lô đang soạn dở)
  const draftInDrafts = (dashboard as any).drafts?.some((s: any) => s.id === draftShipment.id)
  assert(draftInDrafts, 'Lô draft được hiển thị riêng trong danh mục drafts (Lô đang soạn dở)')
  console.log('✅ [PASS] Lô draft được hiển thị riêng trong mục "Lô đang soạn dở" trên Dashboard')

  // Dọn dẹp bản ghi kiểm thử
  await prisma.shipment.deleteMany({
    where: { id: { in: [draftShipment.id, nullableShipment.id, fullShipment.id] } },
  })
  console.log('🧹 Đã dọn dẹp các lô hàng kiểm thử.')

  console.log('\n================================================================================')
  console.log('🎉 TẤT CẢ CÁC MỤC NGHIỆM THU LỖI 2 ĐỀU ĐẠT CHUẨN 100% PASS!')
  console.log('================================================================================\n')
}

runTest().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err)
  process.exit(1)
})
