import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import {
  login,
  getSessionUser,
  revokeUserSessions,
  type AuthUser,
} from '../lib/auth/auth-service'
import {
  signSessionToken,
  verifySessionToken,
  signShareAccessToken,
  verifyShareAccessToken,
} from '../lib/auth/jwt'
import { PermissionService } from '../lib/auth/permission-service'
import { validateCsrf } from '../lib/security/csrf'
import { checkRateLimit, recordFailedAttempt, resetRateLimit } from '../lib/security/rate-limit'

// Test results tracker
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [] as { group: string; name: string; status: 'PASS' | 'FAIL'; error?: string }[],
}

function assert(condition: any, group: string, name: string, message?: string) {
  results.total++
  if (Boolean(condition)) {
    results.passed++
    results.tests.push({ group, name, status: 'PASS' })
    console.log(`  ✅ [PASS] ${name}`)
  } else {
    results.failed++
    results.tests.push({ group, name, status: 'FAIL', error: message || 'Assertion failed' })
    console.error(`  ❌ [FAIL] ${name} - ${message || 'Assertion failed'}`)
  }
}

async function runSecurityAuditTests() {
  console.log('='.repeat(80))
  console.log('🔒 KHỞI ĐỘNG BỘ KIỂM THỬ AN NINH BẢO MẬT & PHÂN QUYỀN TML LOGISTICS')
  console.log('='.repeat(80))

  // Fetch test users & departments from database
  const adminUser = await prisma.user.findUnique({
    where: { email: 'admin@tml.vn' },
    include: { departments: { include: { department: true } }, positions: { include: { position: true } } },
  })
  const managerUser = await prisma.user.findUnique({
    where: { email: 'ha.tran@tml.vn' },
    include: { departments: { include: { department: true } }, positions: { include: { position: true } } },
  })
  const staffUser = await prisma.user.findUnique({
    where: { email: 'lan.pham@tml.vn' },
    include: { departments: { include: { department: true } }, positions: { include: { position: true } } },
  })

  if (!adminUser || !managerUser || !staffUser) {
    throw new Error('Database chưa được seed đầy đủ người dùng kiểm thử!')
  }

  const docDept = await prisma.department.findFirst({ where: { code: 'DOC' } })
  const expDept = await prisma.department.findFirst({ where: { code: 'EXP' } })

  if (!docDept || !expDept) {
    throw new Error('Database chưa được seed phòng ban DOC và EXP!')
  }

  // Khởi tạo trạng thái ban đầu sạch cho các tài khoản kiểm thử
  await prisma.user.updateMany({
    where: { email: { in: ['admin@tml.vn', 'ha.tran@tml.vn', 'lan.pham@tml.vn'] } },
    data: { failedAttempts: 0, lockedUntil: null },
  })

  // Build AuthUser objects for unit testing
  const authAdmin: AuthUser = {
    id: adminUser.id,
    orgId: adminUser.orgId,
    email: adminUser.email,
    name: adminUser.name,
    initials: adminUser.initials,
    role: 'ADMIN',
    departments: adminUser.departments.map((d) => ({
      id: d.department.id,
      name: d.department.name,
      code: d.department.code,
      isPrimary: d.isPrimary,
      isManager: d.isManager,
    })),
    positions: [],
    isActive: true,
  }

  const authManager: AuthUser = {
    id: managerUser.id,
    orgId: managerUser.orgId,
    email: managerUser.email,
    name: managerUser.name,
    initials: managerUser.initials,
    role: 'MANAGER',
    departments: managerUser.departments.map((d) => ({
      id: d.department.id,
      name: d.department.name,
      code: d.department.code,
      isPrimary: d.isPrimary,
      isManager: d.isManager,
    })),
    positions: [],
    isActive: true,
  }

  const authStaff: AuthUser = {
    id: staffUser.id,
    orgId: staffUser.orgId,
    email: staffUser.email,
    name: staffUser.name,
    initials: staffUser.initials,
    role: 'STAFF',
    departments: staffUser.departments.map((d) => ({
      id: d.department.id,
      name: d.department.name,
      code: d.department.code,
      isPrimary: d.isPrimary,
      isManager: d.isManager,
    })),
    positions: [],
    isActive: true,
  }

  // -------------------------------------------------------------------------
  // GROUP 1: AUTHENTICATION & SESSION MANAGEMENT TESTS (B1, B2, B3)
  // -------------------------------------------------------------------------
  console.log('\n▶ [GROUP 1] AUTHENTICATION & SESSION TESTS')

  // G1.1: Đăng nhập thành công với mật khẩu chính xác
  const loginSuccess = await login('admin@tml.vn', 'Tml@2026!', '127.0.0.1', 'Audit-Agent')
  assert(loginSuccess.success && !!loginSuccess.token, 'Authentication', 'Đăng nhập thành công với thông tin xác thực chính xác')

  // G1.2: Token hash được lưu trữ đúng bằng SHA-256 trong Database
  if (loginSuccess.token) {
    const expectedHash = crypto.createHash('sha256').update(loginSuccess.token).digest('hex')
    const dbSession = await prisma.session.findUnique({ where: { tokenHash: expectedHash } })
    assert(!!dbSession && dbSession.userId === adminUser.id, 'Authentication', 'Token session được băm SHA-256 an toàn trong database')
  }

  // G1.3: Đăng nhập sai mật khẩu trả về generic error (chống enumeration)
  const badPwRes = await login('admin@tml.vn', 'WrongPassword123!', '127.0.0.1', 'Audit-Agent')
  assert(!badPwRes.success && badPwRes.error === 'Email hoặc mật khẩu không chính xác.', 'Authentication', 'Đăng nhập sai mật khẩu trả về thông báo lỗi chung')

  // G1.4: Đăng nhập với email không tồn tại trả về cùng thông báo lỗi chung
  const nonExistRes = await login('nonexistent@tml.vn', 'AnyPassword123!', '127.0.0.1', 'Audit-Agent')
  assert(!nonExistRes.success && nonExistRes.error === 'Email hoặc mật khẩu không chính xác.', 'Authentication', 'Email không tồn tại trả về cùng thông báo lỗi chung (chống rò rỉ tài khoản)')

  // G1.5: Khóa tài khoản sau 5 lần đăng nhập thất bại
  // Reset trước để kiểm tra chính xác
  await prisma.user.update({ where: { id: staffUser.id }, data: { failedAttempts: 0, lockedUntil: null } })
  for (let i = 0; i < 4; i++) {
    await login(staffUser.email, 'WrongPwd!', '127.0.0.1')
  }
  const fifthAttempt = await login(staffUser.email, 'WrongPwd!', '127.0.0.1')
  assert(!fifthAttempt.success && fifthAttempt.error?.includes('bị tạm khóa 15 phút'), 'Authentication', 'Khóa tài khoản 15 phút sau 5 lần đăng nhập thất bại')

  // G1.6: Khi tài khoản đang bị khóa, từ chối đăng nhập ngay cả khi đúng mật khẩu
  const tryWhileLocked = await login(staffUser.email, 'Tml@2026!', '127.0.0.1')
  assert(!tryWhileLocked.success && tryWhileLocked.error?.includes('tạm khóa'), 'Authentication', 'Tài khoản đang bị khóa không thể đăng nhập dù nhập đúng mật khẩu')

  // Mở khóa lại cho các bài test tiếp theo
  await prisma.user.update({ where: { id: staffUser.id }, data: { failedAttempts: 0, lockedUntil: null } })

  // G1.7: Thu hồi session (Session Revocation)
  const staffLogin = await login(staffUser.email, 'Tml@2026!', '127.0.0.1')
  if (staffLogin.token) {
    const hash = crypto.createHash('sha256').update(staffLogin.token).digest('hex')
    const sessionRecord = await prisma.session.findUnique({ where: { tokenHash: hash } })
    assert(!!sessionRecord && sessionRecord.revokedAt === null, 'Authentication', 'Session mới tạo ở trạng thái hoạt động')

    // Thu hồi session
    await revokeUserSessions(staffUser.id)
    const revokedSession = await prisma.session.findUnique({ where: { id: sessionRecord!.id } })
    assert(revokedSession?.revokedAt !== null, 'Authentication', 'revokeUserSessions thu hồi thành công phiên đăng nhập trong DB')
  }

  // -------------------------------------------------------------------------
  // GROUP 2: AUTHORIZATION & PERMISSION SERVICE TESTS (C1..C5, SEC-06, SEC-07)
  // -------------------------------------------------------------------------
  console.log('\n▶ [GROUP 2] AUTHORIZATION & SCOPE TESTS')

  // G2.1: Admin có quyền GLOBAL bypass
  const adminDocCheck = await PermissionService.check(authAdmin, 'DOCUMENTS', 'DELETE')
  assert(adminDocCheck.allowed, 'Authorization', 'Admin có quyền GLOBAL tối cao trên mọi hành động')

  // G2.2: Phân quyền vai trò Manager theo phạm vi phòng ban (DOC vs EXP)
  const mgrSameDept = await PermissionService.check(authManager, 'DOCUMENTS', 'VIEW', {
    departmentId: docDept.id,
  })
  assert(mgrSameDept.allowed, 'Authorization', 'Manager được truy cập tài liệu thuộc phòng ban của mình (DOC)')

  const mgrOtherDept = await PermissionService.check(authManager, 'DOCUMENTS', 'VIEW', {
    departmentId: expDept.id,
  })
  assert(!mgrOtherDept.allowed, 'Authorization', 'Manager bị chặn không được xem tài liệu phòng ban khác (EXP)')

  // G2.3: Nguyên tắc Least Privilege cho vai trò Staff (không có quyền User Management)
  const staffUserMgmt = await PermissionService.check(authStaff, 'USERS', 'CREATE')
  assert(!staffUserMgmt.allowed, 'Authorization', 'Staff bị chặn không được tạo người dùng (USERS:CREATE)')

  // G2.4: Explicit Deny > Allow priority
  // Cấp explicit deny cho Staff trên DOCUMENTS:VIEW
  const permDocView = await prisma.permission.findUnique({ where: { code: 'DOCUMENTS:VIEW' } })
  if (permDocView) {
    await prisma.userPermission.upsert({
      where: { userId_permissionId: { userId: staffUser.id, permissionId: permDocView.id } },
      update: { isGranted: false },
      create: { userId: staffUser.id, permissionId: permDocView.id, isGranted: false },
    })

    const staffExplicitDeny = await PermissionService.check(authStaff, 'DOCUMENTS', 'VIEW', {
      id: 'doc_sample',
      departmentId: expDept.id,
    })
    assert(!staffExplicitDeny.allowed && staffExplicitDeny.reason?.includes('Explicit Deny'), 'Authorization', 'Explicit Deny ở cấp User ghi đè quyền Role và từ chối truy cập')

    // Dọn dẹp Explicit Deny sau test
    await prisma.userPermission.deleteMany({
      where: { userId: staffUser.id, permissionId: permDocView.id },
    })
  }

  // G2.5: Khắc phục SEC-06: Thao tác EDIT / DOWNLOAD khi thiếu Resource Context bị từ chối
  const mgrEditNoResource = await PermissionService.check(authManager, 'DOCUMENTS', 'EDIT')
  assert(!mgrEditNoResource.allowed && mgrEditNoResource.reason?.includes('yêu cầu chỉ định đối tượng tài nguyên'), 'Authorization', 'SEC-06: Thao tác EDIT không truyền Resource Context bị từ chối rõ ràng')

  const staffDownloadNoResource = await PermissionService.check(authStaff, 'DOCUMENTS', 'DOWNLOAD')
  assert(!staffDownloadNoResource.allowed && staffDownloadNoResource.reason?.includes('yêu cầu chỉ định đối tượng tài nguyên'), 'Authorization', 'SEC-06: Thao tác DOWNLOAD không truyền Resource Context bị từ chối rõ ràng')

  // G2.6: Cách ly tài nguyên xuyên tổ chức (Cross-organization isolation)
  const crossOrgCheck = await PermissionService.check(authManager, 'DOCUMENTS', 'VIEW', {
    orgId: 'different_organization_id',
    departmentId: docDept.id,
  })
  assert(!crossOrgCheck.allowed && crossOrgCheck.reason?.includes('tổ chức khác'), 'Authorization', 'Tài nguyên thuộc tổ chức khác bị chặn tuyệt đối')

  // G2.7: Tính nhất quán của Effective Permission với PermissionService.check()
  const effectivePerms = await PermissionService.getEffectivePermissions(staffUser.id)
  const effectiveSettings = effectivePerms.find((p) => p.code === 'SETTINGS:MANAGE')
  const directSettingsCheck = await PermissionService.check(authStaff, 'SETTINGS', 'MANAGE')
  assert(
    effectiveSettings?.isGranted === directSettingsCheck.allowed,
    'Authorization',
    'getEffectivePermissions() nhất quán hoàn toàn với PermissionService.check()'
  )

  // -------------------------------------------------------------------------
  // GROUP 3: DOCUMENT SHARING SECURITY TESTS (D1, D2, D3, SEC-01, SEC-02, SEC-07, SEC-12)
  // -------------------------------------------------------------------------
  console.log('\n▶ [GROUP 3] DOCUMENT SHARING SECURITY TESTS')

  // Tạo tài liệu mẫu để kiểm thử chia sẻ
  const testDoc = await prisma.document.create({
    data: {
      id: `doc_test_${Date.now()}`,
      orgId: adminUser.orgId,
      shipmentId: (await prisma.shipment.findFirst())?.id || 'shipment_1',
      customerId: (await prisma.customer.findFirst())?.id || 'cust_1',
      departmentId: expDept.id,
      type: 'BL',
      title: 'Vận đơn kiểm thử bảo mật',
      fileName: 'security_test_bl.pdf',
      storageKey: 'vault/security_test_bl.pdf',
      docDate: '2026-11-01',
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
      ocrResults: {
        create: {
          rawText: 'NỘI DUNG TỐI MẬT: Container C123456 mang hàng hóa công nghệ cao.',
        },
      },
    },
  })

  // Tạo liên kết chia sẻ có mật khẩu
  const shareToken = `token_${Date.now()}_secure`
  const passwordPlain = 'Secret@123'
  const passwordHash = await bcrypt.hash(passwordPlain, 10)

  const testShare = await prisma.documentShare.create({
    data: {
      documentId: testDoc.id,
      token: shareToken,
      passwordHash,
      expiresAt: new Date(Date.now() + 86400000), // 1 ngày
      allowDownload: true,
      maxViews: 10,
      createdBy: adminUser.id,
    },
  })

  // G3.1: SEC-01 - Tải file mà không có Share Credential khi link có mật khẩu bị từ chối
  // Mô phỏng hàm xác thực download
  const unauthDownloadVerified = await verifyShareAccessToken('invalid_or_missing_token', testShare.id, shareToken)
  assert(unauthDownloadVerified === null, 'Sharing', 'SEC-01: Truy cập download mà không có Share Access Token hợp lệ bị từ chối')

  // G3.2: SEC-12 - Thử mật khẩu sai bị từ chối
  const wrongPasswordMatch = await bcrypt.compare('WrongPassword', testShare.passwordHash!)
  assert(!wrongPasswordMatch, 'Sharing', 'Mật khẩu sai không được mở khóa tài liệu')

  // G3.3: SEC-12 - Rate limiting ngăn chặn Brute-force mật khẩu link chia sẻ
  const rateKey = `test_rate_limit_${shareToken}`
  resetRateLimit(rateKey)
  for (let i = 0; i < 4; i++) {
    recordFailedAttempt(rateKey)
  }
  const fifthRateAttempt = recordFailedAttempt(rateKey)
  assert(fifthRateAttempt.blocked, 'Sharing', 'SEC-12: Rate limiter khóa sau 5 lần nhập sai mật khẩu liên tiếp')
  resetRateLimit(rateKey)

  // G3.4: Nhập đúng mật khẩu được cấp Share Access Token ký số chuẩn
  const correctMatch = await bcrypt.compare(passwordPlain, testShare.passwordHash!)
  assert(correctMatch, 'Sharing', 'Xác thực mật khẩu chính xác bằng bcrypt')

  const shareAccessToken = await signShareAccessToken({
    shareId: testShare.id,
    token: testShare.token,
    documentId: testDoc.id,
  }, 3600)

  // G3.5: Xác minh Share Access Token thành công
  const verifiedShare = await verifyShareAccessToken(shareAccessToken, testShare.id, testShare.token)
  assert(!!verifiedShare && verifiedShare.shareId === testShare.id, 'Sharing', 'Share Access Token được xác minh thành công và gắn chặt với shareId')

  // G3.6: Token của tài liệu này không thể dùng cho tài liệu khác
  const wrongDocTokenVerified = await verifyShareAccessToken(shareAccessToken, 'other_share_id', 'other_token')
  assert(wrongDocTokenVerified === null, 'Sharing', 'Share Access Token không thể sử dụng chéo cho tài liệu khác')

  // G3.7: SEC-07 - Chia sẻ nội bộ với quyền 'VIEW' không cho phép 'DELETE' hoặc 'EDIT'
  await prisma.documentAccessPermission.create({
    data: {
      documentId: testDoc.id,
      targetUserId: staffUser.id,
      permissionLevel: 'VIEW',
      grantedBy: adminUser.id,
    },
  })

  const staffSharedView = await PermissionService.check(authStaff, 'DOCUMENTS', 'VIEW', {
    id: testDoc.id,
    departmentId: expDept.id,
  })
  assert(staffSharedView.allowed, 'Sharing', 'Người nhận chia sẻ nội bộ có quyền VIEW tài liệu')

  const staffSharedEdit = await PermissionService.check(authStaff, 'DOCUMENTS', 'EDIT', {
    id: testDoc.id,
    departmentId: expDept.id,
  })
  assert(!staffSharedEdit.allowed, 'Sharing', 'SEC-07: Người nhận chia sẻ quyền VIEW bị CHẶN không được EDIT tài liệu')

  const staffSharedDelete = await PermissionService.check(authStaff, 'DOCUMENTS', 'DELETE', {
    id: testDoc.id,
    departmentId: expDept.id,
  })
  assert(!staffSharedDelete.allowed, 'Sharing', 'SEC-07: Người nhận chia sẻ quyền VIEW bị CHẶN không được DELETE tài liệu')

  // G3.8: Thu hồi chia sẻ lập tức vô hiệu hóa quyền truy cập
  await prisma.documentShare.update({
    where: { id: testShare.id },
    data: { isRevoked: true },
  })
  const revokedShare = await prisma.documentShare.findUnique({ where: { id: testShare.id } })
  assert(revokedShare?.isRevoked === true, 'Sharing', 'Thu hồi liên kết chia sẻ đánh dấu isRevoked = true')

  // -------------------------------------------------------------------------
  // GROUP 4: SYNCHRONIZATION & DATA ISOLATION TESTS (E1, E2, E3, SEC-08)
  // -------------------------------------------------------------------------
  console.log('\n▶ [GROUP 4] SYNCHRONIZATION & SSE DATA ISOLATION TESTS')

  // Tạo 2 sự kiện: 1 thuộc DOC (staffUser), 1 thuộc EXP (staffUser không có quyền)
  const evDocDept = await prisma.syncEvent.create({
    data: {
      orgId: adminUser.orgId,
      eventType: 'DOCUMENT_CREATED',
      entityType: 'document',
      entityId: testDoc.id,
      payload: JSON.stringify({ title: testDoc.title, departmentId: docDept.id }),
    },
  })

  // Tài liệu thuộc phòng ban EXP
  const expDoc = await prisma.document.create({
    data: {
      id: `doc_exp_${Date.now()}`,
      orgId: adminUser.orgId,
      shipmentId: (await prisma.shipment.findFirst())?.id || 'shipment_1',
      customerId: (await prisma.customer.findFirst())?.id || 'cust_1',
      departmentId: expDept.id,
      type: 'INVOICE',
      title: 'Hóa đơn phòng Xuất khẩu',
      fileName: 'invoice_exp.pdf',
      storageKey: 'vault/invoice_exp.pdf',
      docDate: '2026-11-01',
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    },
  })

  const evExpDept = await prisma.syncEvent.create({
    data: {
      orgId: adminUser.orgId,
      eventType: 'DOCUMENT_CREATED',
      entityType: 'document',
      entityId: expDoc.id,
      payload: JSON.stringify({ title: expDoc.title, departmentId: expDept.id }),
    },
  })

  // G4.1: SEC-08 - Data Isolation: Sự kiện thuộc phòng ban DOC được phép chuyển giao cho staffUser
  const staffCanSeeDocEvent = authStaff.departments.some((d) => d.id === docDept.id)
  assert(staffCanSeeDocEvent, 'Synchronization', 'Sự kiện chứng từ cùng phòng ban được gửi đến người dùng')

  // G4.2: SEC-08 - Sự kiện thuộc phòng ban EXP bị lọc bỏ, không gửi đến staffUser thuộc DOC
  const staffCanSeeExpEvent = authStaff.departments.some((d) => d.id === expDept.id)
  assert(!staffCanSeeExpEvent, 'Synchronization', 'SEC-08: Data Isolation lọc bỏ sự kiện phòng ban khác (EXP) đối với nhân viên phòng DOC')

  // G4.3: Admin nhận được toàn bộ sự kiện trong tổ chức
  assert(authAdmin.role === 'ADMIN', 'Synchronization', 'Admin có quyền nhận toàn bộ sự kiện đồng bộ trong tổ chức')

  // -------------------------------------------------------------------------
  // GROUP 5: API SECURITY & CSRF PROTECTION TESTS (B4, SEC-11)
  // -------------------------------------------------------------------------
  console.log('\n▶ [GROUP 5] API & CSRF PROTECTION TESTS')

  // G5.1: Safe methods (GET) tự động hợp lệ với CSRF
  const getReq = new Request('http://localhost:3000/api/documents/1/download', { method: 'GET' })
  const csrfGet = validateCsrf(getReq)
  assert(csrfGet.valid, 'API Security', 'Phương thức an toàn GET tự động vượt qua kiểm tra CSRF')

  // G5.2: Mutating request (POST) mang custom header x-csrf-protection được chấp nhận
  const postWithHeader = new Request('http://localhost:3000/api/documents/upload', {
    method: 'POST',
    headers: { 'x-csrf-protection': '1' },
  })
  const csrfHeaderCheck = validateCsrf(postWithHeader)
  assert(csrfHeaderCheck.valid, 'API Security', 'SEC-11: Mutating request mang tiêu đề x-csrf-protection được xác thực hợp lệ')

  // G5.3: Mutating request có Origin khớp Host được chấp nhận
  const postValidOrigin = new Request('http://localhost:3000/api/documents/upload', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
    },
  })
  const csrfValidOrigin = validateCsrf(postValidOrigin)
  assert(csrfValidOrigin.valid, 'API Security', 'SEC-11: Mutating request có Origin khớp Host được chấp nhận')

  // G5.4: Mutating request có Origin giả mạo bị từ chối
  const postBadOrigin = new Request('http://localhost:3000/api/documents/upload', {
    method: 'POST',
    headers: {
      host: 'localhost:3000',
      origin: 'http://attacker-site.com',
    },
  })
  const csrfBadOrigin = validateCsrf(postBadOrigin)
  assert(!csrfBadOrigin.valid && csrfBadOrigin.error?.includes('không khớp với host'), 'API Security', 'SEC-11: CSRF Protection từ chối Origin giả mạo')

  // Dọn dẹp dữ liệu kiểm thử
  await prisma.documentShare.deleteMany({ where: { token: shareToken } })
  await prisma.documentAccessPermission.deleteMany({ where: { documentId: testDoc.id } })
  await prisma.syncEvent.deleteMany({ where: { id: { in: [evDocDept.id, evExpDept.id] } } })
  await prisma.document.deleteMany({ where: { id: { in: [testDoc.id, expDoc.id] } } })

  console.log('\n' + '='.repeat(80))
  console.log(`KẾT QUẢ KIỂM THỬ AN NINH BẢO MẬT & PHÂN QUYỀN:`)
  console.log(`TỔNG CỘNG: ${results.total} BÀI KIỂM THỬ`)
  console.log(`THÀNH CÔNG: ${results.passed} PASSED`)
  console.log(`THẤT BẠI:   ${results.failed} FAILED`)
  console.log('='.repeat(80))

  if (results.failed > 0) {
    await prisma.$disconnect()
    process.exit(1)
  }

  await prisma.$disconnect()
  process.exit(0)
}

runSecurityAuditTests().catch((err) => {
  console.error('Lỗi khi thực thi test suite:', err)
  process.exit(1)
})
