import assert from 'assert'
import { NextRequest } from 'next/server'
import { POST as loginPost } from '@/app/api/auth/login/route'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth/auth-service'

async function runLoginVerificationTests() {
  console.log('\n================================================================================')
  console.log('🔑 KIỂM THỬ XÁC THỰC ĐĂNG NHẬP, CẤU HÌNH COOKIE & CHUYỂN HƯỚNG AN TOÀN')
  console.log('================================================================================')

  // TEST 1: Đăng nhập từ localhost/HTTP môi trường phát triển
  console.log('\n▶ [TEST 1] ĐĂNG NHẬP TRÊN LOCALHOST: COOKIE KHÔNG BỊ GẮN CỜ SECURE (TRÁNH BỊ REJECT TRÊN HTTP)')
  {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'host': 'localhost:3000',
        'user-agent': 'Mozilla/5.0 Test Chrome',
      },
      body: JSON.stringify({ email: 'admin@tml.vn', password: 'Tml@2026!' }),
    })

    const res = await loginPost(req)
    assert.strictEqual(res.status, 200, 'HTTP Status phải là 200')
    const body = await res.json()
    assert.strictEqual(body.success, true, 'Body phải trả về success: true')

    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME)
    assert.ok(sessionCookie, 'Cookie phiên phải tồn tại trong response')
    assert.strictEqual(sessionCookie.httpOnly, true, 'Cookie phải có cờ HttpOnly')
    assert.strictEqual(sessionCookie.secure, false, 'Trên localhost HTTP, cờ secure phải là false')
    assert.strictEqual(String(sessionCookie.sameSite).toLowerCase(), 'lax', 'Cờ SameSite phải là lax')
    assert.strictEqual(sessionCookie.path, '/', 'Path phải là /')

    console.log('  ✅ [PASS] Cookie phiên trên localhost được cấp phát chính xác không có cờ secure')
  }

  // TEST 2: Đăng nhập từ kết nối HTTPS sản xuất
  console.log('\n▶ [TEST 2] ĐĂNG NHẬP TRÊN KẾT NỐI HTTPS: COOKIE TỰ ĐỘNG BẬT CỜ SECURE AN TOÀN')
  {
    const req = new NextRequest('https://tml.production.vn/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'host': 'tml.production.vn',
        'x-forwarded-proto': 'https',
        'user-agent': 'Mozilla/5.0 Production Browser',
      },
      body: JSON.stringify({ email: 'admin@tml.vn', password: 'Tml@2026!' }),
    })

    const res = await loginPost(req)
    assert.strictEqual(res.status, 200, 'HTTP Status phải là 200')
    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME)
    assert.ok(sessionCookie, 'Cookie phiên phải tồn tại')
    assert.strictEqual(sessionCookie.secure, true, 'Trên HTTPS, cờ secure phải tự động được bật true')

    console.log('  ✅ [PASS] Cookie phiên trên HTTPS được bảo vệ với cờ secure: true')
  }

  // TEST 3: Đối soát tính hợp lệ của token thông qua getSessionUser
  console.log('\n▶ [TEST 3] THẨM ĐỊNH PHIÊN LÀM VIỆC TỪ COOKIE BẰNG GETSESSIONUSER')
  {
    const req = new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'host': 'localhost:3000',
      },
      body: JSON.stringify({ email: 'ha.tran@tml.vn', password: 'Tml@2026!' }),
    })

    const res = await loginPost(req)
    const token = res.cookies.get(SESSION_COOKIE_NAME)?.value
    assert.ok(token, 'Token phải tồn tại trong cookie')

    const user = await getSessionUser(token)
    assert.ok(user, 'getSessionUser phải giải mã và xác thực được người dùng')
    assert.strictEqual(user.email, 'ha.tran@tml.vn', 'Email người dùng phải khớp')
    assert.strictEqual(user.role, 'MANAGER', 'Vai trò người dùng phải là MANAGER')

    console.log('  ✅ [PASS] getSessionUser xác minh chính xác phiên đăng nhập của người dùng')
  }

  // TEST 4: Tự động khởi tạo đầy đủ tài khoản thử nghiệm và phòng ban qua ensureDatabaseInitialized
  console.log('\n▶ [TEST 4] TỰ ĐỘNG KHỞI TẠO CƠ SỞ DỮ LIỆU & TÀI KHOẢN MẪU (SELF-HEALING)')
  {
    const { ensureDatabaseInitialized } = await import('@/lib/prisma')
    await ensureDatabaseInitialized()
    const { prisma } = await import('@/lib/prisma')
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@tml.vn' },
      include: { departments: true, positions: true },
    })
    assert.ok(adminUser, 'Admin phải tồn tại')
    assert.ok(adminUser.departments.length > 0, 'Admin phải được gán phòng ban')
    console.log('  ✅ [PASS] ensureDatabaseInitialized thiết lập đầy đủ quan hệ phòng ban và chức vụ')
  }

  // TEST 5: Phiên đăng nhập bị xóa hoặc chưa lưu trong DB bắt buộc phải bị từ chối 100%
  console.log('\n▶ [TEST 5] KIỂM TRA TÍNH TOÀN VẸN: SESSION BẮT BUỘC TỒN TẠI TRONG DB')
  {
    const req = new NextRequest('https://tml.production.vn/api/auth/login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'host': 'tml.production.vn',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ email: 'admin@tml.vn', password: 'Tml@2026!' }),
    })

    const res = await loginPost(req)
    const token = res.cookies.get(SESSION_COOKIE_NAME)?.value
    assert.ok(token, 'Token phải tồn tại')

    // Xóa session khỏi DB
    const { prisma } = await import('@/lib/prisma')
    const { verifySessionToken } = await import('@/lib/auth/jwt')
    const payload = await verifySessionToken(token)
    assert.ok(payload?.sessionId)

    await prisma.session.delete({ where: { id: payload.sessionId } })

    // getSessionUser bắt buộc trả về null vì session không còn trong DB
    const sessionUser = await getSessionUser(token)
    assert.strictEqual(sessionUser, null, 'Khi session không có trong DB, getSessionUser bắt buộc từ chối')
    console.log('  ✅ [PASS] Session bắt buộc phải tồn tại trong DB, không có ngoại lệ')
  }

  console.log('\n================================================================================')
  console.log('TỔNG HỢP KIỂM THỬ XÁC THỰC ĐĂNG NHẬP: TẤT CẢ ĐỀU ĐẠT CHUẨN AN TOÀN 100%')
  console.log('================================================================================\n')
}

runLoginVerificationTests().catch((err) => {
  console.error('❌ Lỗi kiểm thử đăng nhập:', err)
  process.exit(1)
})
