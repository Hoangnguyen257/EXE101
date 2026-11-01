import { prisma } from '../lib/prisma'
import { login } from '../lib/auth/auth-service'
import { PermissionService } from '../lib/auth/permission-service'
import bcrypt from 'bcryptjs'

async function runTests() {
  console.log('🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TỰ ĐỘNG CHO HỆ THỐNG TML LOGISTICS...\n')
  let passed = 0
  let failed = 0

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`)
      passed++
    } else {
      console.error(`  ❌ FAIL: ${testName}`)
      failed++
    }
  }

  try {
    // TEST 1: Password Hash verification
    console.log('▶ [TEST GROUP 1] XÁC THỰC MẬT KHẨU & BẢO MẬT BCRYPT')
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@tml.vn' } })
    assert(!!adminUser, 'Tìm thấy tài khoản Quản trị viên (admin@tml.vn)')
    const isPasswordMatch = await bcrypt.compare('Tml@2026!', adminUser?.passwordHash || '')
    assert(isPasswordMatch, 'Mật khẩu quản trị viên được mã hóa bcrypt và xác thực chính xác')

    // TEST 2: Invalid password handling
    const invalidLogin = await login('admin@tml.vn', 'WrongPassword123!', '127.0.0.1', 'TestRunner')
    assert(!invalidLogin.success, 'Đăng nhập sai mật khẩu bị từ chối chính xác')

    // TEST 3: Admin Global Permissions
    console.log('\n▶ [TEST GROUP 2] PHÂN QUYỀN VAI TRÒ ADMIN (TỐI CAO)')
    const adminAuthUser = {
      id: adminUser!.id,
      orgId: adminUser!.orgId,
      email: adminUser!.email,
      name: adminUser!.name,
      initials: adminUser!.initials,
      role: 'ADMIN' as const,
      departments: [{ id: 'd6', name: 'Ban Giám Đốc', code: 'MGMT', isPrimary: true, isManager: true }],
      positions: [{ id: 'p1', name: 'Giám đốc', level: 5 }],
      isActive: true,
    }

    const adminCheckDocs = await PermissionService.check(adminAuthUser, 'DOCUMENTS', 'DELETE')
    assert(adminCheckDocs.allowed, 'Admin có quyền DELETE trên phân hệ DOCUMENTS')

    const adminCheckUsers = await PermissionService.check(adminAuthUser, 'USERS', 'CREATE')
    assert(adminCheckUsers.allowed, 'Admin có quyền CREATE trên phân hệ USERS')

    const adminCheckAudit = await PermissionService.check(adminAuthUser, 'AUDIT', 'VIEW')
    assert(adminCheckAudit.allowed, 'Admin có quyền VIEW toàn bộ nhật ký AUDIT')

    // TEST 4: Staff Least Privilege Permissions
    console.log('\n▶ [TEST GROUP 3] NGUYÊN TẮC LEAST PRIVILEGE CHO VAI TRÒ STAFF')
    const staffUser = await prisma.user.findUnique({ where: { email: 'lan.pham@tml.vn' } })
    const staffAuthUser = {
      id: staffUser!.id,
      orgId: staffUser!.orgId,
      email: staffUser!.email,
      name: staffUser!.name,
      initials: staffUser!.initials,
      role: 'STAFF' as const,
      departments: [{ id: 'd1', name: 'Phòng Chứng từ', code: 'DOC', isPrimary: true, isManager: false }],
      positions: [{ id: 'p4', name: 'Chuyên viên Chứng từ', level: 2 }],
      isActive: true,
    }

    const staffCheckUserMgmt = await PermissionService.check(staffAuthUser, 'USERS', 'CREATE')
    assert(!staffCheckUserMgmt.allowed, 'Staff bị CHẶN không được tạo tài khoản người dùng (USERS:CREATE)')

    const staffCheckAuditView = await PermissionService.check(staffAuthUser, 'AUDIT', 'VIEW')
    assert(!staffCheckAuditView.allowed, 'Staff bị CHẶN không được xem nhật ký kiểm toán hệ thống (AUDIT:VIEW)')

    const staffCheckSettings = await PermissionService.check(staffAuthUser, 'SETTINGS', 'MANAGE')
    assert(!staffCheckSettings.allowed, 'Staff bị CHẶN không được cấu hình hệ thống (SETTINGS:MANAGE)')

    // TEST 5: Explicit Deny Rule (Explicit Deny > Allow)
    console.log('\n▶ [TEST GROUP 4] QUY TẮC BẢO MẬT EXPLICIT DENY > ALLOW')
    const docDownloadPerm = await prisma.permission.findUnique({ where: { code: 'DOCUMENTS:DOWNLOAD' } })
    if (docDownloadPerm) {
      // Create explicit deny for this staff
      await prisma.userPermission.upsert({
        where: { userId_permissionId: { userId: staffAuthUser.id, permissionId: docDownloadPerm.id } },
        update: { isGranted: false },
        create: { userId: staffAuthUser.id, permissionId: docDownloadPerm.id, isGranted: false },
      })

      const staffDenyCheck = await PermissionService.check(staffAuthUser, 'DOCUMENTS', 'DOWNLOAD')
      assert(!staffDenyCheck.allowed, 'Khi có Explicit Deny, thao tác bị từ chối ngay lập tức')

      // Clean up deny rule
      await prisma.userPermission.deleteMany({
        where: { userId: staffAuthUser.id, permissionId: docDownloadPerm.id },
      })
    }

    // TEST 6: Manager Scope Check
    console.log('\n▶ [TEST GROUP 5] PHẠM VI QUYỀN QUẢN LÝ PHÒNG BAN (MANAGER)')
    const managerUser = await prisma.user.findUnique({
      where: { email: 'ha.tran@tml.vn' },
      include: { departments: { include: { department: true } } },
    })
    const docDept = await prisma.department.findFirst({ where: { code: 'DOC' } })
    const expDept = await prisma.department.findFirst({ where: { code: 'EXP' } })

    const managerAuthUser = {
      id: managerUser!.id,
      orgId: managerUser!.orgId,
      email: managerUser!.email,
      name: managerUser!.name,
      initials: managerUser!.initials,
      role: 'MANAGER' as const,
      departments: managerUser!.departments.map((d) => ({
        id: d.department.id,
        name: d.department.name,
        code: d.department.code,
        isPrimary: d.isPrimary,
        isManager: d.isManager,
      })),
      positions: [{ id: 'p2', name: 'Trưởng phòng', level: 4 }],
      isActive: true,
    }

    const managerSameDept = await PermissionService.check(managerAuthUser, 'DOCUMENTS', 'VIEW', {
      departmentId: docDept!.id,
    })
    assert(managerSameDept.allowed, 'Manager được xem chứng từ thuộc phòng ban của mình (DOC)')

    const managerOtherDept = await PermissionService.check(managerAuthUser, 'DOCUMENTS', 'VIEW', {
      departmentId: expDept!.id, // Phòng Hàng xuất
    })
    assert(!managerOtherDept.allowed, 'Manager bị CHẶN không được truy cập chứng từ của phòng ban khác (EXP)')

    // TEST 7: Document Sharing Scope Check
    console.log('\n▶ [TEST GROUP 6] CƠ CHẾ CHIA SẺ LIÊN PHÒNG BAN (CROSS-DEPARTMENT SHARING)')
    const sampleDoc = await prisma.document.findFirst()
    if (sampleDoc && docDept) {
      // Create cross-department access grant for department DOC
      const grant = await prisma.documentAccessPermission.create({
        data: {
          documentId: sampleDoc.id,
          targetDeptId: docDept.id,
          permissionLevel: 'VIEW',
          grantedBy: adminUser!.id,
        },
      })

      const sharedAccessCheck = await PermissionService.check(managerAuthUser, 'DOCUMENTS', 'VIEW', {
        id: sampleDoc.id,
        departmentId: expDept!.id, // original doc dept is EXP
      })
      assert(sharedAccessCheck.allowed, 'Tài liệu chia sẻ hợp lệ được truy cập xuyên phòng ban')

      // Clean up share
      await prisma.documentAccessPermission.delete({ where: { id: grant.id } })
    }

    console.log(`\n======================================================`)
    console.log(`TỔNG KẾT KIỂM THỬ: ${passed} PASSED / ${failed} FAILED`)
    console.log(`======================================================\n`)

    if (failed > 0) process.exit(1)
  } catch (err) {
    console.error('Lỗi khi chạy bộ kiểm thử:', err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

runTests()
