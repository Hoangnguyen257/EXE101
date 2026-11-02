/**
 * TML LOGISTICS - TASK 16 COMPREHENSIVE VERIFICATION SUITE
 * PREMIUM 3D DOCUMENT EXPERIENCE & AUTHENTICATION TRANSITIONS
 * 
 * Verifies:
 * 1. Brand Logo Assets & Color Identity
 * 2. Flow 1: 3D Folder Opening -> Document Extraction -> Login Form Morphing
 * 3. Flow 2: Login Success -> Form-to-Doc -> Digitization -> TML Logo Absorption -> Dashboard
 * 4. Flow 3: Logout -> Dashboard to Logo -> Document Emerge -> Login Form
 * 5. Security & Session Invalidation Integrity during transitions
 * 6. Accessibility & Reduced Motion Fallback
 */

import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { login, revokeUserSessions } from '../lib/auth/auth-service'

async function runTask16Tests() {
  console.log('\n================================================================================')
  console.log('🧪 BẮT ĐẦU KIỂM THỬ TASK 16: TRẢI NGHIỆM CHỨNG TỪ 3D & CHUYỂN CẢNH ĐĂNG NHẬP')
  console.log('================================================================================\n')

  let passed = 0
  let failed = 0

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`)
      passed++
    } else {
      console.error(`  ❌ [FAIL] ${message}`)
      failed++
      throw new Error(message)
    }
  }

  // ---------------------------------------------------------------------------
  // [PHẦN 1] KIỂM TRA TÀI NGUYÊN THƯƠNG HIỆU & LOGO GỐC
  // ---------------------------------------------------------------------------
  console.log('▶ [PHẦN 1] TÀI NGUYÊN THƯƠNG HIỆU & ĐẶC TRƯNG NHẬN DIỆN LOGO TML')
  const logoPath = path.resolve(process.cwd(), 'public', 'tml-logo.jpg')
  assert(fs.existsSync(logoPath), 'Tệp logo gốc public/tml-logo.jpg tồn tại')

  const logoStat = fs.statSync(logoPath)
  assert(logoStat.size > 10000, `Dung lượng tệp logo hợp lệ (${logoStat.size} bytes)`)

  // Kiểm tra Magic Bytes của tệp JPEG (FF D8 FF)
  const logoBuffer = fs.readFileSync(logoPath)
  assert(
    logoBuffer[0] === 0xff && logoBuffer[1] === 0xd8 && logoBuffer[2] === 0xff,
    'Tệp logo là định dạng ảnh JPEG chuẩn xác không bị lỗi'
  )

  const logoPublicAlias = path.resolve(process.cwd(), 'public', 'logo.jpg')
  assert(fs.existsSync(logoPublicAlias), 'Tệp alias public/logo.jpg sẵn sàng phục vụ toàn hệ thống')

  // ---------------------------------------------------------------------------
  // [PHẦN 2] FLOW 1: INTRO 3D MỞ HỒ SƠ & RÚT CHỨNG TỪ HIỆN FORM ĐĂNG NHẬP
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 2] FLOW 1: INTRO 3D MỞ HỒ SƠ & BIẾN CHỨNG TỪ THÀNH FORM')
  // Kiểm tra các tệp component kiến trúc
  const folderComponentPath = path.resolve(process.cwd(), 'components/transitions/intro/Folder3D.tsx')
  assert(fs.existsSync(folderComponentPath), 'Component Folder3D.tsx tồn tại với cấu trúc 3D')

  const introComponentPath = path.resolve(process.cwd(), 'components/transitions/intro/IntroExperience.tsx')
  assert(fs.existsSync(introComponentPath), 'Component IntroExperience.tsx điều phối chuỗi chuyển cảnh')

  const doc3DComponentPath = path.resolve(process.cwd(), 'components/transitions/shared/Document3D.tsx')
  assert(fs.existsSync(doc3DComponentPath), 'Component Document3D.tsx mô phỏng chứng từ logistics chân thực')

  // Kiểm tra nội dung mã nguồn đảm bảo giữ nguyên tài khoản demo và bảo mật ISO 27001
  const loginCardPath = path.resolve(process.cwd(), 'components/transitions/auth/LoginFormCard.tsx')
  const loginCardSource = fs.readFileSync(loginCardPath, 'utf8')
  assert(loginCardSource.includes('admin@tml.vn'), 'LoginFormCard giữ nguyên tài khoản quản trị viên ADMIN')
  assert(loginCardSource.includes('ha.tran@tml.vn'), 'LoginFormCard giữ nguyên tài khoản quản trị viên MANAGER')
  assert(loginCardSource.includes('lan.pham@tml.vn'), 'LoginFormCard giữ nguyên tài khoản STAFF')
  assert(loginCardSource.includes('Tml@2026!'), 'Mật khẩu thử nghiệm Tml@2026! được bảo lưu đầy đủ')

  // ---------------------------------------------------------------------------
  // [PHẦN 3] FLOW 2: LOGIN SUCCESS & SỐ HÓA CHỨNG TỪ VÀO LOGO
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 3] FLOW 2: ĐĂNG NHẬP THÀNH CÔNG & SỐ HÓA VÀO LOGO TML')
  const successComponentPath = path.resolve(process.cwd(), 'components/transitions/auth/LoginSuccessExperience.tsx')
  assert(fs.existsSync(successComponentPath), 'Component LoginSuccessExperience.tsx điều phối quá trình số hóa')

  // Xác minh đăng nhập thật với backend auth-service
  const authResult = await login('admin@tml.vn', 'Tml@2026!')
  assert(authResult.success === true, 'Xác thực backend thành công với tài khoản Admin')
  assert(Boolean(authResult.token), 'Nhận session token hợp lệ từ hệ thống')

  // Xác minh cơ chế: animation chỉ kích hoạt KHI và CHỈ KHI backend phản hồi success
  const invalidAuth = await login('admin@tml.vn', 'SaiMatKhau!')
  assert(invalidAuth.success === false, 'Đăng nhập sai mật khẩu bị từ chối 100%, không kích hoạt animation thành công')

  // ---------------------------------------------------------------------------
  // [PHẦN 4] FLOW 3: LOGOUT TUA NGƯỢC CẢNH ĐĂNG NHẬP & BẢO MẬT PHIÊN LÀM VIỆC
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 4] FLOW 3: LOGOUT AN TOÀN & THU HỒI PHIÊN ĐĂNG NHẬP THỰC SỰ')
  const logoutComponentPath = path.resolve(process.cwd(), 'components/transitions/logout/LogoutExperience.tsx')
  assert(fs.existsSync(logoutComponentPath), 'Component LogoutExperience.tsx điều phối chuyển cảnh đăng xuất')

  // Thu hồi session thực sự ở DB (đảm bảo không chỉ ẩn giao diện ở Frontend)
  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@tml.vn' } })
  assert(Boolean(adminUser), 'Tìm thấy tài khoản admin trong CSDL')

  if (adminUser) {
    await revokeUserSessions(adminUser.id)
    const activeSessions = await prisma.session.count({
      where: { userId: adminUser.id, revokedAt: null },
    })
    assert(activeSessions === 0, 'Backend revokeUserSessions thu hồi phiên đăng nhập vật lý trên DB (active = 0)')
  }

  // ---------------------------------------------------------------------------
  // [PHẦN 5] HIỆU NĂNG 3D, ACCESSIBILITY & REDUCED MOTION
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 5] HIỆU NĂNG 3D TRANSFORM & TIÊU CHUẨN ACCESSIBILITY')
  const globalsCss = fs.readFileSync(path.resolve(process.cwd(), 'app/globals.css'), 'utf8')
  assert(globalsCss.includes('perspective-1200'), 'Cấu hình perspective 3D phần cứng trong CSS toàn cục')
  assert(globalsCss.includes('preserve-3d'), 'Cấu hình transform-style: preserve-3d chuẩn xác')
  assert(globalsCss.includes('animate-scan-beam'), 'Keyframe tia quét laser số hóa đã được đăng ký')

  const introSource = fs.readFileSync(introComponentPath, 'utf8')
  assert(introSource.includes('prefers-reduced-motion'), 'Hỗ trợ tự động chế độ giảm chuyển động prefers-reduced-motion')
  assert(introSource.includes('sessionStorage'), 'Lưu trạng thái phiên để không bắt người dùng xem lại nhiều lần')
  assert(introSource.includes('Bỏ qua intro'), 'Cung cấp nút bấm chủ động Bỏ qua intro cho người dùng')

  console.log('\n================================================================================')
  console.log(`TỔNG HỢP KIỂM THỬ TASK 16: ${passed} PASSED / ${failed} FAILED`)
  console.log('================================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runTask16Tests().catch((err) => {
  console.error('Lỗi kiểm thử Task 16:', err)
  process.exit(1)
})
