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

  console.log('\n================================================================================')
  console.log('TỔNG HỢP KIỂM THỬ XÁC THỰC ĐĂNG NHẬP: TẤT CẢ ĐỀU ĐẠT CHUẨN AN TOÀN 100%')
  console.log('================================================================================\n')
}

runLoginVerificationTests().catch((err) => {
  console.error('❌ Lỗi kiểm thử đăng nhập:', err)
  process.exit(1)
})
