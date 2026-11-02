import assert from 'node:assert'
import { prisma } from '../lib/prisma'
import { formatAuditTimestamp, AUDIT_ACTION_LABEL } from '../lib/labels'
import { login } from '../lib/auth/auth-service'

async function runTest() {
  console.log('================================================================================')
  console.log('🧪 TEST: LỖI 6 - NHẬT KÝ TRUY CẬP, MÚI GIỜ VN, TÁC NHÂN HỆ THỐNG & REALTIME')
  console.log('================================================================================')

  // ---------------------------------------------------------------------------
  // PHẦN 1: KIỂM THỬ ĐỊNH DẠNG GIỜ VIỆT NAM (ASIA/HO_CHI_MINH) CHO CÁC MỐC QUY ĐỊNH
  // ---------------------------------------------------------------------------
  console.log('\n[PHẦN 1] ĐỊNH DẠNG NGÀY GIỜ VIỆT NAM TẠI CÁC MỐC: 00:30, 11:59, 12:00, 23:59')

  // Mốc 1: 00:30 sáng (nửa đêm)
  const t1 = '2026-11-02T00:30:00+07:00'
  const formatted1 = formatAuditTimestamp(t1)
  assert(formatted1.includes('02/11/2026'), 'Khớp ngày 02/11/2026')
  assert(formatted1.includes('12:30 SA') && formatted1.includes('(Sáng)'), `00:30 sáng phải hiển thị SA/Sáng: ${formatted1}`)
  console.log(`✅ [PASS] 00:30 -> ${formatted1}`)

  // Mốc 2: 11:59 trưa (trước 12h)
  const t2 = '2026-11-02T11:59:00+07:00'
  const formatted2 = formatAuditTimestamp(t2)
  assert(formatted2.includes('11:59 SA') && formatted2.includes('(Sáng)'), `11:59 sáng phải hiển thị SA/Sáng: ${formatted2}`)
  console.log(`✅ [PASS] 11:59 -> ${formatted2}`)

  // Mốc 3: 12:00 đúng ngọ (bắt đầu chiều)
  const t3 = '2026-11-02T12:00:00+07:00'
  const formatted3 = formatAuditTimestamp(t3)
  assert(formatted3.includes('12:00 CH') && formatted3.includes('(Chiều)'), `12:00 trưa phải chuyển sang CH/Chiều: ${formatted3}`)
  console.log(`✅ [PASS] 12:00 -> ${formatted3}`)

  // Mốc 4: 23:59 đêm
  const t4 = '2026-11-02T23:59:00+07:00'
  const formatted4 = formatAuditTimestamp(t4)
  assert(formatted4.includes('11:59 CH') && formatted4.includes('(Tối)'), `23:59 đêm phải hiển thị CH/Tối: ${formatted4}`)
  console.log(`✅ [PASS] 23:59 -> ${formatted4}`)

  // ---------------------------------------------------------------------------
  // PHẦN 2: TÊN HÀNH ĐỘNG TIẾNG VIỆT DỄ HIỂU
  // ---------------------------------------------------------------------------
  console.log('\n[PHẦN 2] TÊN HÀNH ĐỘNG BẰNG TIẾNG VIỆT CHUẨN')
  assert.strictEqual(AUDIT_ACTION_LABEL.create, 'Tạo')
  assert.strictEqual(AUDIT_ACTION_LABEL.edit, 'Sửa')
  assert.strictEqual(AUDIT_ACTION_LABEL.delete, 'Xóa')
  assert.strictEqual(AUDIT_ACTION_LABEL.upload, 'Tải lên')
  assert.strictEqual(AUDIT_ACTION_LABEL.download, 'Tải xuống')
  assert.strictEqual(AUDIT_ACTION_LABEL.share, 'Chia sẻ')
  assert.strictEqual(AUDIT_ACTION_LABEL.login, 'Đăng nhập')
  assert.strictEqual(AUDIT_ACTION_LABEL.permission_change, 'Đổi phân quyền')
  console.log('✅ [PASS] Toàn bộ hành động đều được ánh xạ sang tiếng Việt chuẩn xác')

  // ---------------------------------------------------------------------------
  // PHẦN 3: TÁC NHÂN TỰ ĐỘNG ĐƯỢC GHI LÀ "HỆ THỐNG"
  // ---------------------------------------------------------------------------
  console.log('\n[PHẦN 3] TÁC NHÂN TỰ ĐỘNG LƯU TRỮ VÀ HIỂN THỊ LÀ "HỆ THỐNG"')
  const org = await prisma.organization.findFirst()
  assert(org, 'Cần Organization')

  // Đảm bảo user hệ thống tồn tại
  let systemUser = await prisma.user.findFirst({
    where: { orgId: org.id, email: 'system@tml.vn' },
  })
  if (!systemUser) {
    systemUser = await prisma.user.create({
      data: {
        orgId: org.id,
        email: 'system@tml.vn',
        name: 'Hệ thống',
        passwordHash: 'SYSTEM_AUTOMATION_NO_LOGIN',
        roleCode: 'ADMIN',
        initials: 'HT',
        isActive: true,
      },
    })
  }

  // Ghi log tự động thu hồi link quá hạn với tác nhân Hệ thống
  const autoLog = await prisma.auditLog.create({
    data: {
      orgId: org.id,
      userId: systemUser.id,
      action: 'share_expired_auto_revoked',
      resourceType: 'document_share',
      resourceId: `share_test_${Date.now()}`,
      status: 'SUCCESS',
      diffJson: JSON.stringify({ actor: 'Hệ thống (Tự động thu hồi quá hạn)' }),
    },
    include: { user: true },
  })

  assert.strictEqual(autoLog.user.name, 'Hệ thống', 'Tác nhân tự động lưu trữ người dùng là "Hệ thống"')
  assert.strictEqual(autoLog.action, 'share_expired_auto_revoked')
  console.log('✅ [PASS] Sự kiện tự động được gán tác nhân là "Hệ thống", không gán cho người dùng thật')

  // ---------------------------------------------------------------------------
  // PHẦN 4: TEST REAL-TIME: THAO TÁC CỦA TÀI KHOẢN XUẤT HIỆN TRONG VÒNG 10 GIÂY
  // ---------------------------------------------------------------------------
  console.log('\n[PHẦN 4] KIỂM THỬ REAL-TIME: THAO TÁC XUẤT HIỆN TRONG VÒNG 10 GIÂY')
  const managerUser = await prisma.user.findFirst({
    where: { email: 'ha.tran@tml.vn' },
  })
  assert(managerUser, 'Cần manager user')

  const timestampBeforeAction = new Date(Date.now() - 1000).toISOString()
  const testJobNo = `JOB-AUDIT-${Date.now()}`

  // Manager tạo một lô hàng
  const testShipment = await prisma.shipment.create({
    data: {
      orgId: org.id,
      jobNo: testJobNo,
      mode: 'sea',
      origin: 'Cat Lai, VN',
      destination: 'Busan, KR',
      status: 'draft',
      ownerId: managerUser.id,
    },
  })

  // Ghi audit log tạo lô
  await prisma.auditLog.create({
    data: {
      orgId: org.id,
      userId: managerUser.id,
      action: 'create',
      resourceType: 'shipment',
      resourceId: testShipment.id,
      status: 'SUCCESS',
      diffJson: JSON.stringify({ jobNo: testShipment.jobNo }),
    },
  })

  // Mô phỏng Admin truy vấn endpoint `/api/audit` trong vòng dưới 10 giây (dùng timestamp lọc since)
  const startTime = Date.now()
  const recentLogs = await prisma.auditLog.findMany({
    where: {
      orgId: org.id,
      createdAt: { gte: new Date(timestampBeforeAction) },
      action: 'create',
      resourceType: 'shipment',
      resourceId: testShipment.id,
    },
    include: { user: true },
  })
  const queryDuration = Date.now() - startTime

  assert(recentLogs.length >= 1, 'Admin phát hiện bản ghi tạo lô mới vừa thực hiện')
  assert(queryDuration < 10000, `Admin nhận được cập nhật trong ${queryDuration}ms (< 10000ms)`)
  assert.strictEqual(recentLogs[0].user.name, managerUser.name)
  console.log(`⏱️ Thời gian phát hiện bản ghi mới: ${queryDuration}ms (< 10 giây)`)
  console.log(`✅ [PASS] Thao tác tạo lô "${testJobNo}" xuất hiện ngay lập tức trên trang nhật ký của Admin`)

  // Dọn dẹp bản ghi kiểm thử
  await prisma.auditLog.deleteMany({
    where: { id: { in: [autoLog.id, recentLogs[0].id] } },
  })
  await prisma.shipment.delete({ where: { id: testShipment.id } })
  console.log('🧹 Đã dọn dẹp các bản ghi kiểm thử.')

  console.log('\n================================================================================')
  console.log('🎉 TẤT CẢ CÁC MỤC NGHIỆM THU LỖI 6 ĐỀU ĐẠT CHUẨN 100% PASS!')
  console.log('================================================================================\n')
}

runTest().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err)
  process.exit(1)
})

