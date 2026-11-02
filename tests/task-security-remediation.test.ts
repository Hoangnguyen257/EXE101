/**
 * TML LOGISTICS - SECURITY REMEDIATION TEST SUITE
 * 
 * Nghiệm thu các biện pháp sửa lỗi bảo mật khẩn cấp:
 * 1. App không khởi động / ném lỗi rõ ràng khi thiếu JWT_SECRET hoặc < 32 ký tự (không có secret fallback)
 * 2. Token ký bằng secret cũ (hardcoded fallback đã lộ) bị từ chối 100%
 * 3. JWT hợp lệ nhưng không có session trong database BẮT BUỘC bị từ chối (bỏ serverless fallback)
 * 4. Cột mustChangePassword bắt buộc đổi mật khẩu ở lần đăng nhập đầu và cập nhật khi đổi mật khẩu
 */

import { prisma } from '../lib/prisma'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { getSessionUser, login, loginHardened } from '../lib/auth/auth-service'
import { verifySessionToken } from '../lib/auth/jwt'

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [] as { name: string; status: 'PASS' | 'FAIL'; error?: string }[],
}

function assert(condition: any, name: string, message?: string) {
  results.total++
  if (Boolean(condition)) {
    results.passed++
    results.tests.push({ name, status: 'PASS' })
    console.log(`  ✅ [PASS] ${name}`)
  } else {
    results.failed++
    results.tests.push({ name, status: 'FAIL', error: message || 'Assertion failed' })
    console.error(`  ❌ [FAIL] ${name} - ${message || 'Assertion failed'}`)
  }
}

async function runRemediationTests() {
  console.log('='.repeat(80))
  console.log('🛡️ BẮT ĐẦU KIỂM THỬ XÁC NHẬN SỬA LỖI BẢO MẬT KHẨN CẤP (SECURITY REMEDIATION)')
  console.log('='.repeat(80))

  const originalJwtSecret = process.env.JWT_SECRET
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET

  // ---------------------------------------------------------------------------
  // TEST 1: THIẾU JWT_SECRET HOẶC < 32 KÝ TỰ PHẢI THROW LỖI VÀ KHÔNG CHẠY
  // ---------------------------------------------------------------------------
  console.log('\n▶ [TEST 1] THIẾU JWT_SECRET HOẶC < 32 KÝ TỰ BẮT BUỘC THROW LỖI RÕ RÀNG')
  try {
    delete process.env.JWT_SECRET
    delete process.env.NEXTAUTH_SECRET

    let threwWhenMissing = false
    try {
      // Gọi verifySessionToken khi không có secret nào trong môi trường
      await verifySessionToken('invalid.dummy.token')
    } catch (err: any) {
      if (err.message && err.message.includes('FATAL SECURITY CONFIGURATION ERROR')) {
        threwWhenMissing = true
      }
    }
    assert(threwWhenMissing, 'App throw lỗi rõ ràng khi thiếu JWT_SECRET (không dùng fallback)')

    // Thử với secret ngắn hơn 32 ký tự
    process.env.JWT_SECRET = 'short-secret-under-32-chars'
    let threwWhenShort = false
    try {
      await verifySessionToken('invalid.dummy.token')
    } catch (err: any) {
      if (err.message && err.message.includes('FATAL SECURITY CONFIGURATION ERROR')) {
        threwWhenShort = true
      }
    }
    assert(threwWhenShort, 'App throw lỗi rõ ràng khi JWT_SECRET ngắn hơn 32 ký tự')
  } finally {
    // Khôi phục secret hợp lệ cho các bài test tiếp theo
    process.env.JWT_SECRET = originalJwtSecret || 'new-super-secure-production-jwt-key-minimum-32-characters-2026'
  }

  // ---------------------------------------------------------------------------
  // TEST 2: TOKEN KÝ BẰNG SECRET CŨ ĐÃ LỘ BỊ TỪ CHỐI 100%
  // ---------------------------------------------------------------------------
  console.log('\n▶ [TEST 2] TOKEN KÝ BẰNG SECRET CŨ ĐÃ LỘ BỊ TỪ CHỐI 100%')
  const OLD_EXPOSED_SECRET = 'tml-enterprise-super-secure-jwt-secret-key-min-32-chars-2026'
  const NEW_ROTATED_SECRET = 'new-rotated-super-secure-jwt-key-minimum-32-characters-2026-fresh'

  // Ký một token bằng secret cũ đã bị lộ
  const oldSecretEncoded = new TextEncoder().encode(OLD_EXPOSED_SECRET)
  const tokenSignedWithOldSecret = await new SignJWT({
    userId: 'u1',
    email: 'admin@tml.vn',
    role: 'ADMIN',
    sessionId: 'session_old_test',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('tml-logistics')
    .setAudience('tml-web')
    .setSubject('u1')
    .setJti('session_old_test')
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(oldSecretEncoded)

  // Đổi secret hệ thống sang secret mới
  process.env.JWT_SECRET = NEW_ROTATED_SECRET

  // Thử xác thực token cũ với secret mới
  const verifyOldTokenResult = await verifySessionToken(tokenSignedWithOldSecret)
  assert(
    verifyOldTokenResult === null,
    'Token ký bằng secret cũ đã lộ bị hệ thống từ chối hoàn toàn (verifySessionToken trả về null)'
  )

  // ---------------------------------------------------------------------------
  // TEST 3: JWT HỢP LỆ NHƯNG KHÔNG CÓ SESSION TRONG DATABASE BỊ TỪ CHỐI
  // (ĐÃ BỎ NHÁNH SERVERLESS FALLBACK)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [TEST 3] JWT HỢP LỆ NHƯNG KHÔNG CÓ SESSION DB BẮT BUỘC BỊ TỪ CHỐI')
  // Ký một token hợp lệ với secret mới, nhưng sessionId không hề tồn tại trong bảng Session
  const newSecretEncoded = new TextEncoder().encode(NEW_ROTATED_SECRET)
  const fakeSessionId = 'non_existent_session_id_99999'

  // Đảm bảo không có session nào mang id này
  await prisma.session.deleteMany({ where: { id: fakeSessionId } })

  const orphanToken = await new SignJWT({
    userId: 'u1',
    email: 'admin@tml.vn',
    role: 'ADMIN',
    sessionId: fakeSessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('tml-logistics')
    .setAudience('tml-web')
    .setSubject('u1')
    .setJti(fakeSessionId)
    .setIssuedAt()
    .setExpirationTime('1d')
    .sign(newSecretEncoded)

  // Thử xác thực kể cả khi giả lập môi trường Vercel/Serverless
  const prevVercelEnv = process.env.VERCEL
  try {
    process.env.VERCEL = '1'
    const orphanSessionUser = await getSessionUser(orphanToken)
    assert(
      orphanSessionUser === null,
      'JWT hợp lệ nhưng không có session trong DB bị từ chối 100% (bỏ serverless fallback)'
    )
  } finally {
    if (prevVercelEnv !== undefined) {
      process.env.VERCEL = prevVercelEnv
    } else {
      delete process.env.VERCEL
    }
  }

  // ---------------------------------------------------------------------------
  // TEST 4: CỘT mustChangePassword VÀ QUY TRÌNH ĐỔI MẬT KHẨU LẦN ĐẦU
  // ---------------------------------------------------------------------------
  console.log('\n▶ [TEST 4] CỘT mustChangePassword VÀ BẮT BUỘC ĐỔI MẬT KHẨU')
  // 1. Tạo một tài khoản test với mustChangePassword = true
  const testEmail = 'mustchange.test@tml.vn'
  const tempPassword = 'TempPassword123!'
  const tempHash = await bcrypt.hash(tempPassword, 10)

  const adminOrg = await prisma.organization.findFirst()
  const staffRole = await prisma.role.findFirst({ where: { code: 'STAFF' } })

  const existingUser = await prisma.user.findUnique({ where: { email: testEmail } })
  if (existingUser) {
    await prisma.loginHistory.deleteMany({ where: { userId: existingUser.id } })
    await prisma.auditLog.deleteMany({ where: { userId: existingUser.id } })
    await prisma.session.deleteMany({ where: { userId: existingUser.id } })
    await prisma.user.delete({ where: { id: existingUser.id } })
  }
  const createdUser = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'User Must Change',
      initials: 'MC',
      passwordHash: tempHash,
      orgId: adminOrg!.id,
      roleCode: staffRole!.code,
      mustChangePassword: true,
      isActive: true,
    },
  })

  assert(createdUser.mustChangePassword === true, 'Cột mustChangePassword tồn tại trong DB và lưu giá trị true')

  // Đăng nhập tài khoản
  const loginRes = await login(testEmail, tempPassword, '127.0.0.1')
  assert(loginRes.success === true, 'Đăng nhập thành công với mật khẩu ban đầu')
  assert((loginRes as any).mustChangePassword === true, 'Kết quả đăng nhập báo hiệu mustChangePassword = true')

  // getSessionUser cũng phải phản ánh mustChangePassword = true
  const sessionUser = await getSessionUser(loginRes.token!)
  assert(sessionUser !== null, 'Lấy session user thành công')
  assert((sessionUser as any)?.mustChangePassword === true, 'SessionUser mang thuộc tính mustChangePassword = true')

  // Dọn dẹp tài khoản test
  await prisma.loginHistory.deleteMany({ where: { userId: createdUser.id } })
  await prisma.auditLog.deleteMany({ where: { userId: createdUser.id } })
  await prisma.session.deleteMany({ where: { userId: createdUser.id } })
  await prisma.user.delete({ where: { id: createdUser.id } })

  // ---------------------------------------------------------------------------
  // TỔNG KẾT
  // ---------------------------------------------------------------------------
  console.log('\n' + '='.repeat(80))
  console.log(`KẾT QUẢ KIỂM THỬ SỬA LỖI BẢO MẬT:`)
  console.log(`TỔNG CỘNG:  ${results.total} BÀI KIỂM THỬ`)
  console.log(`THÀNH CÔNG: ${results.passed} PASSED`)
  console.log(`THẤT BẠI:   ${results.failed} FAILED`)
  console.log('='.repeat(80))

  if (results.failed > 0) {
    process.exit(1)
  }
}

runRemediationTests().catch((err) => {
  console.error('Lỗi thực thi kiểm thử remediation:', err)
  process.exit(1)
})
