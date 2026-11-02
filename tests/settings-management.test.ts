/**
 * TML LOGISTICS - TASK ACCEPTANCE TEST SUITE: SETTINGS & USER MANAGEMENT APIS
 * 
 * Nghiệm thu:
 * 1. ADMIN: tạo, sửa, khóa, mở khóa người dùng; gán role, phòng ban, chức danh
 * 2. Tạo user mới: sinh mật khẩu tạm ngẫu nhiên hiển thị một lần, mustChangePassword = true
 * 3. Đặt lại mật khẩu:
 *    - Mode 1: ADMIN cấp mật khẩu tạm mới
 *    - Mode 2: token dùng một lần có hạn lưu hash (dùng model PasswordResetToken), dùng lại bị từ chối
 * 4. Vô hiệu hóa user: thu hồi toàn bộ session ngay lập tức (token phiên đang mở mất hiệu lực ngay)
 * 5. ADMIN quản lý phòng ban: tạo, sửa, xóa (chặn xóa nếu có chứng từ/lô hàng)
 * 6. ADMIN quản lý hộp lưu trữ vật lý (ArchiveBox): tạo, sửa, xóa (chặn xóa nếu có chứng từ)
 * 7. Kiểm tra phân quyền: MANAGER và STAFF bị chặn các thao tác quản trị (403 Forbidden)
 * 8. Lối vào đổi mật khẩu /change-password từ menu người dùng
 */

import { prisma } from '../lib/prisma'
import { login, getSessionUser } from '../lib/auth/auth-service'
import { GET as getUsers, POST as postUsers } from '../app/api/users/route'
import { GET as getUserById, PATCH as patchUserById, DELETE as deleteUserById } from '../app/api/users/[id]/route'
import { POST as resetUserPassword } from '../app/api/users/[id]/reset-password/route'
import { POST as authResetPassword } from '../app/api/auth/reset-password/route'
import { GET as getDepartments, POST as postDepartments } from '../app/api/departments/route'
import { PATCH as patchDepartment, DELETE as deleteDepartment } from '../app/api/departments/[id]/route'
import { GET as getArchiveBoxes, POST as postArchiveBoxes } from '../app/api/archive-boxes/route'
import { PATCH as patchArchiveBox, DELETE as deleteArchiveBox } from '../app/api/archive-boxes/[id]/route'
import fs from 'fs'
import path from 'path'

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

function createMockRequest(url: string, method: string, token: string, body?: any): Request {
  const headers = new Headers()
  headers.set('authorization', `Bearer ${token}`)
  headers.set('content-type', 'application/json')
  return new Request(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function runSettingsManagementTests() {
  console.log('='.repeat(80))
  console.log('🛡️  BẮT ĐẦU KIỂM THỬ QUẢN LÝ NGƯỜI DÙNG, PHÒNG BAN & HỘP LƯU TRỮ (SETTINGS APIS)')
  console.log('='.repeat(80))

  // ---------------------------------------------------------------------------
  // PHẦN 1: THIẾT LẬP TÀI KHOẢN ADMIN, MANAGER, STAFF
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 1] THIẾT LẬP PHIÊN ĐĂNG NHẬP CHO 3 VAI TRÒ (ADMIN, MANAGER, STAFF)')

  const adminDb = await prisma.user.findFirst({ where: { roleCode: 'ADMIN' } })
  const managerDb = await prisma.user.findFirst({ where: { roleCode: 'MANAGER' } })
  const staffDb = await prisma.user.findFirst({ where: { roleCode: 'STAFF' } })

  if (!adminDb || !managerDb || !staffDb) {
    throw new Error('Thiếu dữ liệu người dùng test ADMIN, MANAGER hoặc STAFF.')
  }

  let adminLogin = await login(adminDb.email, 'TestOnly@2026!', '127.0.0.1')
  if (!adminLogin.success) adminLogin = await login(adminDb.email, 'Tml@2026!', '127.0.0.1')

  let managerLogin = await login(managerDb.email, 'TestOnly@2026!', '127.0.0.1')
  if (!managerLogin.success) managerLogin = await login(managerDb.email, 'Tml@2026!', '127.0.0.1')

  let staffLogin = await login(staffDb.email, 'TestOnly@2026!', '127.0.0.1')
  if (!staffLogin.success) staffLogin = await login(staffDb.email, 'Tml@2026!', '127.0.0.1')

  const adminToken = adminLogin.token!
  const managerToken = managerLogin.token!
  const staffToken = staffLogin.token!

  assert(Boolean(adminToken), 'Phiên đăng nhập ADMIN sẵn sàng')
  assert(Boolean(managerToken), 'Phiên đăng nhập MANAGER sẵn sàng')
  assert(Boolean(staffToken), 'Phiên đăng nhập STAFF sẵn sàng')

  const docDept = await prisma.department.findFirst({ where: { code: 'DOC' } })
  const expDept = await prisma.department.findFirst({ where: { code: 'EXP' } })
  const testPos = await prisma.position.findFirst()
  if (!docDept || !expDept) {
    throw new Error('Thiếu phòng ban DOC hoặc EXP.')
  }

  // ---------------------------------------------------------------------------
  // PHẦN 2: ADMIN TẠO USER MỚI & SINH MẬT KHẨU TẠM (mustChangePassword = true)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 2] ADMIN TẠO USER MỚI VÀ SINH MẬT KHẨU TẠM THỜI MỘT LẦN')

  const uniqueSuffix = Date.now().toString().slice(-6)
  const testEmail = `nhanvien.${uniqueSuffix}@tml.vn`
  const testName = `Nguyễn Văn Thử Nghiệm ${uniqueSuffix}`

  // Xóa nếu đã tồn tại
  await prisma.user.deleteMany({ where: { email: testEmail } })

  const createReq = createMockRequest('http://localhost:3000/api/users', 'POST', adminToken, {
    email: testEmail,
    name: testName,
    roleCode: 'STAFF',
    departmentId: docDept.id,
    positionId: testPos?.id,
    isManager: false,
  })

  const createRes = await postUsers(createReq)
  const createData = await createRes.json()

  assert(createRes.status === 201, 'ADMIN tạo tài khoản người dùng mới thành công (HTTP 201)')
  assert(Boolean(createData.temporaryPassword && createData.temporaryPassword.length >= 16), 'Hệ thống sinh mật khẩu tạm thời ngẫu nhiên độ dài >= 16 ký tự')
  assert(createData.user.mustChangePassword === true, 'Tài khoản mới tạo mang cờ mustChangePassword = true')
  assert(createData.user.isActive === true, 'Tài khoản mới tạo mang trạng thái isActive = true')

  const createdUserId = createData.user.id
  const tempPassword = createData.temporaryPassword

  // Kiểm tra đăng nhập bằng mật khẩu tạm
  const testUserLogin = await login(testEmail, tempPassword, '127.0.0.1')
  assert(testUserLogin.success === true, 'Nhân viên mới đăng nhập thành công bằng mật khẩu tạm thời')
  assert((testUserLogin as any).mustChangePassword === true, 'Đăng nhập trả về cờ mustChangePassword = true')

  // Lấy token phiên của nhân viên mới để kiểm tra thu hồi phiên
  const testUserSessionToken = testUserLogin.token!
  const activeSessionUser = await getSessionUser(testUserSessionToken)
  assert(Boolean(activeSessionUser && activeSessionUser.id === createdUserId), 'Phiên đăng nhập của nhân viên mới đang hoạt động hợp lệ')

  // ---------------------------------------------------------------------------
  // PHẦN 3: ADMIN SỬA THÔNG TIN NGƯỜI DÙNG
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 3] ADMIN CHỈNH SỬA THÔNG TIN NGƯỜI DÙNG')

  const updatedName = `Nguyễn Văn Đã Cập Nhật ${uniqueSuffix}`
  const patchReq = createMockRequest(`http://localhost:3000/api/users/${createdUserId}`, 'PATCH', adminToken, {
    name: updatedName,
    roleCode: 'STAFF',
    departmentId: expDept.id,
  })

  const patchRes = await patchUserById(patchReq, { params: Promise.resolve({ id: createdUserId }) })
  const patchData = await patchRes.json()

  assert(patchRes.status === 200, 'ADMIN chỉnh sửa thông tin người dùng thành công (HTTP 200)')
  assert(patchData.user.name === updatedName, 'Họ tên người dùng được cập nhật chính xác')

  // Kiểm tra phòng ban chuyển sang EXP trong CSDL
  const userDeptLink = await prisma.userDepartment.findFirst({
    where: { userId: createdUserId, isPrimary: true },
  })
  assert(userDeptLink?.departmentId === expDept.id, 'Phòng ban của nhân viên đã chuyển sang phòng EXP thành công')

  // ---------------------------------------------------------------------------
  // PHẦN 4: VÔ HIỆU HÓA NGƯỜI DÙNG -> THU HỒI PHIÊN ĐANG MỞ NGAY LẬP TỨC
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 4] VÔ HIỆU HÓA NGƯỜI DÙNG & THU HỒI PHIÊN ĐANG MỞ NGAY LẬP TỨC')

  const lockReq = createMockRequest(`http://localhost:3000/api/users/${createdUserId}`, 'PATCH', adminToken, {
    isActive: false,
  })
  const lockRes = await patchUserById(lockReq, { params: Promise.resolve({ id: createdUserId }) })
  assert(lockRes.status === 200, 'ADMIN khóa tài khoản nhân viên thành công (HTTP 200)')

  // BẰNG CHỨNG THEN CHỐT: Phiên đang mở của nhân viên BỊ MẤT HIỆU LỰC NGAY LẬP TỨC
  const revokedSession = await getSessionUser(testUserSessionToken)
  assert(revokedSession === null, 'Phiên đăng nhập đang mở của nhân viên BỊ MẤT HIỆU LỰC NGAY LẬP TỨC (getSessionUser trả về null)')

  // Thử đăng nhập lại khi tài khoản đang bị khóa
  const tryLoginWhileLocked = await login(testEmail, tempPassword, '127.0.0.1')
  assert(tryLoginWhileLocked.success === false, 'Đăng nhập tài khoản bị khóa bị từ chối 100%')

  // ---------------------------------------------------------------------------
  // PHẦN 5: MỞ KHÓA TÀI KHOẢN NGƯỜI DÙNG
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 5] MỞ KHÓA TÀI KHOẢN NGƯỜI DÙNG')

  const unlockReq = createMockRequest(`http://localhost:3000/api/users/${createdUserId}`, 'PATCH', adminToken, {
    isActive: true,
  })
  const unlockRes = await patchUserById(unlockReq, { params: Promise.resolve({ id: createdUserId }) })
  assert(unlockRes.status === 200, 'ADMIN mở khóa tài khoản nhân viên thành công (HTTP 200)')

  const reLoginAfterUnlock = await login(testEmail, tempPassword, '127.0.0.1')
  assert(reLoginAfterUnlock.success === true, 'Nhân viên đăng nhập lại thành công sau khi được mở khóa')

  // ---------------------------------------------------------------------------
  // PHẦN 6: ĐẶT LẠI MẬT KHẨU: CẤP MẬT KHẨU TẠM & TOKEN DÙNG MỘT LẦN
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 6] ĐẶT LẠI MẬT KHẨU (MẬT KHẨU TẠM & TOKEN DÙNG 1 LẦN CÓ HẠN LƯU HASH)')

  // 1. Mode 1: Admin cấp mật khẩu tạm mới
  const resetTempReq = createMockRequest(`http://localhost:3000/api/users/${createdUserId}/reset-password`, 'POST', adminToken, {
    mode: 'temp_password',
  })
  const resetTempRes = await resetUserPassword(resetTempReq, { params: Promise.resolve({ id: createdUserId }) })
  const resetTempData = await resetTempRes.json()

  assert(resetTempRes.status === 200, 'ADMIN cấp mật khẩu tạm mới thành công (HTTP 200)')
  assert(Boolean(resetTempData.temporaryPassword), 'Trả về mật khẩu tạm mới')
  const newTempPass = resetTempData.temporaryPassword

  // Mật khẩu cũ tempPassword không còn dùng được
  const oldPassLogin = await login(testEmail, tempPassword, '127.0.0.1')
  assert(oldPassLogin.success === false, 'Mật khẩu cũ trước đó bị vô hiệu hóa hoàn toàn')

  // Mật khẩu tạm mới đăng nhập thành công
  const newPassLogin = await login(testEmail, newTempPass, '127.0.0.1')
  assert(newPassLogin.success === true, 'Đăng nhập thành công với mật khẩu tạm mới được cấp')

  // 2. Mode 2: Admin tạo token đặt lại mật khẩu một lần
  const resetTokenReq = createMockRequest(`http://localhost:3000/api/users/${createdUserId}/reset-password`, 'POST', adminToken, {
    mode: 'reset_token',
  })
  const resetTokenRes = await resetUserPassword(resetTokenReq, { params: Promise.resolve({ id: createdUserId }) })
  const resetTokenData = await resetTokenRes.json()

  assert(resetTokenRes.status === 200, 'ADMIN tạo token đặt lại mật khẩu một lần thành công (HTTP 200)')
  assert(Boolean(resetTokenData.resetToken), 'Trả về resetToken ngẫu nhiên')
  assert(Boolean(resetTokenData.resetUrl), 'Trả về resetUrl dẫn đến trang đặt lại mật khẩu')

  const rawResetToken = resetTokenData.resetToken

  // Kiểm tra token đã lưu dạng hash trong bảng PasswordResetToken
  const tokenInDb = await prisma.passwordResetToken.findFirst({
    where: { userId: createdUserId },
    orderBy: { createdAt: 'desc' },
  })
  assert(tokenInDb !== null, 'Bản ghi PasswordResetToken tồn tại trong CSDL')
  assert(tokenInDb?.tokenHash !== rawResetToken, 'Token được bảo mật: lưu dạng mã băm (Hash), không lưu plaintext')
  assert(tokenInDb?.usedAt === null, 'Token ban đầu có usedAt = null')

  // Sử dụng token để đặt mật khẩu mới qua /api/auth/reset-password
  const userChosenPassword = 'UserChosenPass@2026!'
  const consumeTokenReq = new Request('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token: rawResetToken,
      newPassword: userChosenPassword,
    }),
  })
  const consumeRes = await authResetPassword(consumeTokenReq)
  assert(consumeRes.status === 200, 'Người dùng đặt lại mật khẩu thành công bằng token (HTTP 200)')

  // Token trong DB đã được đánh dấu usedAt
  const usedTokenDb = await prisma.passwordResetToken.findUnique({
    where: { id: tokenInDb!.id },
  })
  assert(usedTokenDb?.usedAt !== null, 'Token được đánh dấu usedAt sau khi sử dụng')

  // Dùng lại token lần 2 BỊ TỪ CHỐI
  const reuseTokenReq = new Request('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      token: rawResetToken,
      newPassword: 'AnotherPassword@2026!',
    }),
  })
  const reuseRes = await authResetPassword(reuseTokenReq)
  assert(reuseRes.status === 400, 'Tái sử dụng token đã dùng bị từ chối 100% (HTTP 400)')

  // Đăng nhập bằng mật khẩu người dùng vừa tự đặt thành công
  const finalLogin = await login(testEmail, userChosenPassword, '127.0.0.1')
  assert(finalLogin.success === true, 'Đăng nhập thành công với mật khẩu tự đặt')
  assert((finalLogin as any).mustChangePassword === false, 'Sau khi tự đặt lại mật khẩu, mustChangePassword = false')

  // ---------------------------------------------------------------------------
  // PHẦN 7: ADMIN QUẢN LÝ PHÒNG BAN (TẠO, SỬA, XÓA, CHẶN XÓA NẾU CÓ DỮ LIỆU)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 7] ADMIN QUẢN LÝ PHÒNG BAN (TẠO, SỬA, XÓA, CHẶN XÓA NẾU CÓ DỮ LIỆU)')

  const newDeptCode = `TEST_${uniqueSuffix}`
  const postDeptReq = createMockRequest('http://localhost:3000/api/departments', 'POST', adminToken, {
    code: newDeptCode,
    name: `Phòng Test ${uniqueSuffix}`,
  })
  const postDeptRes = await postDepartments(postDeptReq)
  const postDeptData = await postDeptRes.json()

  assert(postDeptRes.status === 201, 'ADMIN tạo phòng ban mới thành công (HTTP 201)')
  const createdDeptId = postDeptData.department.id

  // Sửa phòng ban
  const patchDeptReq = createMockRequest(`http://localhost:3000/api/departments/${createdDeptId}`, 'PATCH', adminToken, {
    name: `Phòng Test Đã Đổi Tên ${uniqueSuffix}`,
  })
  const patchDeptRes = await patchDepartment(patchDeptReq, { params: Promise.resolve({ id: createdDeptId }) })
  assert(patchDeptRes.status === 200, 'ADMIN sửa tên phòng ban thành công (HTTP 200)')

  // Xóa phòng ban trống -> Thành công
  const deleteDeptReq = createMockRequest(`http://localhost:3000/api/departments/${createdDeptId}`, 'DELETE', adminToken)
  const deleteDeptRes = await deleteDepartment(deleteDeptReq, { params: Promise.resolve({ id: createdDeptId }) })
  assert(deleteDeptRes.status === 200, 'ADMIN xóa phòng ban trống thành công (HTTP 200)')

  // Thử xóa phòng ban đang có chứng từ/lô hàng (DOC) -> BỊ CHẶN
  const deleteDocDeptReq = createMockRequest(`http://localhost:3000/api/departments/${docDept.id}`, 'DELETE', adminToken)
  const deleteDocDeptRes = await deleteDepartment(deleteDocDeptReq, { params: Promise.resolve({ id: docDept.id }) })
  assert(deleteDocDeptRes.status === 400, 'Hệ thống chặn xóa phòng ban đang có chứng từ/lô hàng/nhân sự liên kết (HTTP 400)')

  // ---------------------------------------------------------------------------
  // PHẦN 8: ADMIN QUẢN LÝ HỘP LƯU TRỮ VẬT LÝ (ArchiveBox)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 8] ADMIN QUẢN LÝ HỘP LƯU TRỮ VẬT LÝ (ArchiveBox)')

  const newBoxCode = `BOX-TEST-${uniqueSuffix}`
  const postBoxReq = createMockRequest('http://localhost:3000/api/archive-boxes', 'POST', adminToken, {
    code: newBoxCode,
    warehouse: 'Kho Cát Lái 2',
    shelf: 'Kệ B-04',
    box: 'Ô 12',
    period: '2026',
  })
  const postBoxRes = await postArchiveBoxes(postBoxReq)
  const postBoxData = await postBoxRes.json()

  assert(postBoxRes.status === 201, 'ADMIN tạo hộp lưu trữ vật lý mới thành công (HTTP 201)')
  const createdBoxId = postBoxData.box.id

  // Sửa hộp lưu trữ
  const patchBoxReq = createMockRequest(`http://localhost:3000/api/archive-boxes/${createdBoxId}`, 'PATCH', adminToken, {
    warehouse: 'Kho Cát Lái 3 Đã Chuyển',
  })
  const patchBoxRes = await patchArchiveBox(patchBoxReq, { params: Promise.resolve({ id: createdBoxId }) })
  assert(patchBoxRes.status === 200, 'ADMIN sửa vị trí hộp lưu trữ thành công (HTTP 200)')

  // Xóa hộp trống -> Thành công
  const deleteBoxReq = createMockRequest(`http://localhost:3000/api/archive-boxes/${createdBoxId}`, 'DELETE', adminToken)
  const deleteBoxRes = await deleteArchiveBox(deleteBoxReq, { params: Promise.resolve({ id: createdBoxId }) })
  assert(deleteBoxRes.status === 200, 'ADMIN xóa hộp lưu trữ trống thành công (HTTP 200)')

  // ---------------------------------------------------------------------------
  // PHẦN 9: KIỂM CHỨNG BẢO MẬT PHÂN QUYỀN (MANAGER VÀ STAFF BỊ CHẶN 403)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 9] KIỂM TRA PHÂN QUYỀN RBAC (MANAGER VÀ STAFF BỊ CHẶN 403 TRÊN THAO TÁC QUẢN TRỊ)')

  // 1. MANAGER thử tạo user -> 403
  const mgrCreateUserReq = createMockRequest('http://localhost:3000/api/users', 'POST', managerToken, {
    email: 'hacker@tml.vn',
    name: 'Hacker User',
    roleCode: 'STAFF',
  })
  const mgrCreateUserRes = await postUsers(mgrCreateUserReq)
  assert(mgrCreateUserRes.status === 403, 'MANAGER bị chặn tạo người dùng (HTTP 403 Forbidden)')

  // 2. MANAGER thử sửa user -> 403
  const mgrPatchUserReq = createMockRequest(`http://localhost:3000/api/users/${staffDb.id}`, 'PATCH', managerToken, {
    roleCode: 'ADMIN',
  })
  const mgrPatchUserRes = await patchUserById(mgrPatchUserReq, { params: Promise.resolve({ id: staffDb.id }) })
  assert(mgrPatchUserRes.status === 403, 'MANAGER bị chặn nâng quyền/sửa người dùng (HTTP 403 Forbidden)')

  // 3. MANAGER thử cấp lại mật khẩu -> 403
  const mgrResetPassReq = createMockRequest(`http://localhost:3000/api/users/${staffDb.id}/reset-password`, 'POST', managerToken, {})
  const mgrResetPassRes = await resetUserPassword(mgrResetPassReq, { params: Promise.resolve({ id: staffDb.id }) })
  assert(mgrResetPassRes.status === 403, 'MANAGER bị chặn cấp lại mật khẩu người dùng (HTTP 403 Forbidden)')

  // 4. MANAGER thử tạo phòng ban -> 403
  const mgrCreateDeptReq = createMockRequest('http://localhost:3000/api/departments', 'POST', managerToken, {
    code: 'MGR_DEPT',
    name: 'Phòng do Manager tạo',
  })
  const mgrCreateDeptRes = await postDepartments(mgrCreateDeptReq)
  assert(mgrCreateDeptRes.status === 403, 'MANAGER bị chặn tạo phòng ban (HTTP 403 Forbidden)')

  // 5. STAFF thử xem danh sách user -> 403
  const staffGetUsersReq = createMockRequest('http://localhost:3000/api/users', 'GET', staffToken)
  const staffGetUsersRes = await getUsers(staffGetUsersReq)
  assert(staffGetUsersRes.status === 403, 'STAFF bị chặn xem danh sách người dùng hệ thống (HTTP 403 Forbidden)')

  // 6. STAFF thử tạo user -> 403
  const staffCreateUserReq = createMockRequest('http://localhost:3000/api/users', 'POST', staffToken, {
    email: 'staff_cheat@tml.vn',
    name: 'Staff Cheat',
    roleCode: 'STAFF',
  })
  const staffCreateUserRes = await postUsers(staffCreateUserReq)
  assert(staffCreateUserRes.status === 403, 'STAFF bị chặn tạo người dùng (HTTP 403 Forbidden)')

  // 7. STAFF thử tạo phòng ban -> 403
  const staffCreateDeptReq = createMockRequest('http://localhost:3000/api/departments', 'POST', staffToken, {
    code: 'STAFF_DEPT',
    name: 'Phòng do Staff tạo',
  })
  const staffCreateDeptRes = await postDepartments(staffCreateDeptReq)
  assert(staffCreateDeptRes.status === 403, 'STAFF bị chặn tạo phòng ban (HTTP 403 Forbidden)')

  // 8. STAFF thử tạo hộp lưu trữ -> 403
  const staffCreateBoxReq = createMockRequest('http://localhost:3000/api/archive-boxes', 'POST', staffToken, {
    code: 'STAFF_BOX',
    warehouse: 'Kho',
    shelf: 'Kệ',
    box: 'Ô',
    period: '2026',
  })
  const staffCreateBoxRes = await postArchiveBoxes(staffCreateBoxReq)
  assert(staffCreateBoxRes.status === 403, 'STAFF bị chặn tạo hộp lưu trữ vật lý (HTTP 403 Forbidden)')

  // ---------------------------------------------------------------------------
  // PHẦN 10: KIỂM TRA LỐI VÀO ĐỔI MẬT KHẨU TỪ MENU NGƯỜI DÙNG
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 10] KIỂM TRA MENU NGƯỜI DÙNG CÓ LỐI VÀO /change-password')

  const headerFilePath = path.join(process.cwd(), 'components/app/app-header.tsx')
  const headerContent = fs.readFileSync(headerFilePath, 'utf-8')

  const hasChangePasswordLink = headerContent.includes('/change-password') && headerContent.includes('Đổi mật khẩu')
  assert(hasChangePasswordLink, 'Menu người dùng (AppHeader) có nút "Đổi mật khẩu" dẫn trực tiếp đến /change-password')

  // Dọn dẹp tài khoản test đã tạo
  const userToClean = await prisma.user.findUnique({ where: { email: testEmail } })
  if (userToClean) {
    await prisma.loginHistory.deleteMany({ where: { userId: userToClean.id } })
    await prisma.auditLog.deleteMany({ where: { userId: userToClean.id } })
    await prisma.passwordResetToken.deleteMany({ where: { userId: userToClean.id } })
    await prisma.userDepartment.deleteMany({ where: { userId: userToClean.id } })
    await prisma.userPosition.deleteMany({ where: { userId: userToClean.id } })
    await prisma.session.deleteMany({ where: { userId: userToClean.id } })
    await prisma.user.delete({ where: { id: userToClean.id } })
  }

  // ============================================================================
  // TỔNG KẾT
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('KẾT QUẢ KIỂM THỬ QUẢN LÝ CÀI ĐẶT & BẢO MẬT:')
  console.log(`TỔNG CỘNG:  ${results.total} BÀI KIỂM THỬ`)
  console.log(`THÀNH CÔNG: ${results.passed} PASSED`)
  console.log(`THẤT BẠI:   ${results.failed} FAILED`)
  console.log('='.repeat(80))

  if (results.failed > 0) {
    throw new Error(`${results.failed} bài kiểm thử thất bại!`)
  }
}

runSettingsManagementTests()
  .catch((err) => {
    console.error('Lỗi ngoại lệ trong quá trình chạy kiểm thử:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
