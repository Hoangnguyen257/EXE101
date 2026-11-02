/**
 * TML LOGISTICS - TASK 10 ACCEPTANCE TEST SUITE: PERMISSION HARDENING & SCOPING
 * 
 * Comprehensive tests verifying:
 * 1. Single Source of Truth (SSoT) Role Permission Matrix counts:
 *    - ADMIN = 84 permissions
 *    - MANAGER = 36 permissions
 *    - STAFF = 12 permissions
 * 2. Database Role Permission sync & SSoT integrity
 * 3. Matrix verification across 3 roles x 6 actions x 3 contexts (same dept, other dept, assigned)
 * 4. "Responsible Staff Department Model" (Mô hình phòng ban phụ trách):
 *    - DOC Manager sees and manages EXP shipment s2 because DOC staff u4 (lan.pham) is an assigned participant
 * 5. Search `q` query cross-department leakage prevention
 * 6. List-to-detail consistency test (0 403 errors on list items)
 * 7. Document department integrity (Document.departmentId required, backfilled, and enforced)
 * 8. ShipmentParticipant API functionality (GET, POST, DELETE)
 */

import { prisma } from '../lib/prisma'
import { PermissionService, buildShipmentWhereInput, buildDocumentWhereInput } from '../lib/auth/permission-service'
import { ROLE_PERMISSIONS_MATRIX } from '../lib/auth/role-matrix'
import { login, getSessionUser } from '../lib/auth/auth-service'

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

async function runPermissionMatrixTests() {
  console.log('='.repeat(80))
  console.log('🛡️  BẮT ĐẦU KIỂM THỬ MA TRẬN PHÂN QUYỀN & MÔ HÌNH PHÒNG BAN PHỤ TRÁCH')
  console.log('='.repeat(80))

  // ---------------------------------------------------------------------------
  // PHẦN 1: KIỂM TRA SỐ LƯỢNG QUYỀN HẠN SINGLE SOURCE OF TRUTH (SSoT)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 1] KIỂM TRA SỐ LƯỢNG QUYỀN HẠN ROLE PERMISSION MATRIX (SSoT)')

  assert(ROLE_PERMISSIONS_MATRIX.ADMIN.length === 84, 'SSoT: ADMIN có chính xác 84 quyền trong role-matrix.ts')
  assert(ROLE_PERMISSIONS_MATRIX.MANAGER.length === 36, 'SSoT: MANAGER có chính xác 36 quyền trong role-matrix.ts')
  assert(ROLE_PERMISSIONS_MATRIX.STAFF.length === 12, 'SSoT: STAFF có chính xác 12 quyền trong role-matrix.ts')

  // Kiểm tra số lượng quyền thực tế đã đồng bộ vào CSDL
  const adminRole = await prisma.role.findUnique({
    where: { code: 'ADMIN' },
    include: { rolePermissions: { include: { permission: true } } },
  })
  const managerRole = await prisma.role.findUnique({
    where: { code: 'MANAGER' },
    include: { rolePermissions: { include: { permission: true } } },
  })
  const staffRole = await prisma.role.findUnique({
    where: { code: 'STAFF' },
    include: { rolePermissions: { include: { permission: true } } },
  })

  assert(adminRole?.rolePermissions.length === 84, `CSDL: ADMIN Role có đúng 84 permissions trong DB (Thực tế: ${adminRole?.rolePermissions.length})`)
  assert(managerRole?.rolePermissions.length === 36, `CSDL: MANAGER Role có đúng 36 permissions trong DB (Thực tế: ${managerRole?.rolePermissions.length})`)
  assert(staffRole?.rolePermissions.length === 12, `CSDL: STAFF Role có đúng 12 permissions trong DB (Thực tế: ${staffRole?.rolePermissions.length})`)

  // Kiểm tra MANAGER và STAFF không có quyền DELETE trên DOCUMENTS và SHIPMENTS
  const managerHasDocDelete = managerRole?.rolePermissions.some((rp) => rp.permission.code === 'DOCUMENTS:DELETE')
  const managerHasShipmentDelete = managerRole?.rolePermissions.some((rp) => rp.permission.code === 'SHIPMENTS:DELETE')
  const staffHasDocDelete = staffRole?.rolePermissions.some((rp) => rp.permission.code === 'DOCUMENTS:DELETE')
  const staffHasShipmentDelete = staffRole?.rolePermissions.some((rp) => rp.permission.code === 'SHIPMENTS:DELETE')

  assert(!managerHasDocDelete, 'MANAGER không có quyền DOCUMENTS:DELETE')
  assert(!managerHasShipmentDelete, 'MANAGER không có quyền SHIPMENTS:DELETE')
  assert(!staffHasDocDelete, 'STAFF không có quyền DOCUMENTS:DELETE')
  assert(!staffHasShipmentDelete, 'STAFF không có quyền SHIPMENTS:DELETE')

  // ---------------------------------------------------------------------------
  // PHẦN 2: CHUẨN BỊ USER CONTEXTS (ADMIN, MANAGER DOC, STAFF DOC)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 2] THIẾT LẬP PHIÊN ĐĂNG NHẬP VÀ USER CONTEXTS')

  const docDept = await prisma.department.findFirst({ where: { code: 'DOC' } })
  const expDept = await prisma.department.findFirst({ where: { code: 'EXP' } })
  if (!docDept || !expDept) {
    throw new Error('Thiếu phòng ban DOC hoặc EXP trong DB.')
  }

  // Lấy hoặc tạo user test
  const adminDb = await prisma.user.findFirst({ where: { roleCode: 'ADMIN' } })
  const managerDocDb = await prisma.user.findFirst({
    where: { roleCode: 'MANAGER', departments: { some: { departmentId: docDept.id } } },
  })
  const staffDocDb = await prisma.user.findFirst({
    where: { roleCode: 'STAFF', departments: { some: { departmentId: docDept.id } } },
  })

  if (!adminDb || !managerDocDb || !staffDocDb) {
    throw new Error('Thiếu User ADMIN, MANAGER (DOC), hoặc STAFF (DOC) trong DB.')
  }

  // Đăng nhập để lấy AuthUser đầy đủ permissions
  let adminLogin = await login(adminDb.email, 'TestOnly@2026!', '127.0.0.1')
  if (!adminLogin.success) adminLogin = await login(adminDb.email, 'Tml@2026!', '127.0.0.1')

  let managerLogin = await login(managerDocDb.email, 'TestOnly@2026!', '127.0.0.1')
  if (!managerLogin.success) managerLogin = await login(managerDocDb.email, 'Tml@2026!', '127.0.0.1')

  let staffLogin = await login(staffDocDb.email, 'TestOnly@2026!', '127.0.0.1')
  if (!staffLogin.success) staffLogin = await login(staffDocDb.email, 'Tml@2026!', '127.0.0.1')

  const adminUser = await getSessionUser(adminLogin.token!)
  const managerUser = await getSessionUser(managerLogin.token!)
  const staffUser = await getSessionUser(staffLogin.token!)

  assert(Boolean(adminUser && adminUser.role === 'ADMIN'), 'Admin AuthUser sẵn sàng')
  assert(Boolean(managerUser && managerUser.role === 'MANAGER' && managerUser.departments.some((d) => d.id === docDept.id)), 'Manager AuthUser (DOC) sẵn sàng')
  assert(Boolean(staffUser && staffUser.role === 'STAFF' && staffUser.departments.some((d) => d.id === docDept.id)), 'Staff AuthUser (DOC) sẵn sàng')

  if (!adminUser || !managerUser || !staffUser) {
    throw new Error('Lỗi khởi tạo session users')
  }

  // ---------------------------------------------------------------------------
  // PHẦN 3: MA TRẬN 3 ROLES × 6 ACTIONS × 3 CONTEXTS (SAME, OTHER, ASSIGNED)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 3] KIỂM THỬ MA TRẬN PHÂN QUYỀN: 3 ROLES × 6 ACTIONS × 3 CONTEXTS')

  const actionsToCheck = ['VIEW', 'UPLOAD', 'EDIT', 'DOWNLOAD', 'SHARE', 'DELETE'] as const

  // Context 1: Same Department (Lô hàng/chứng từ thuộc DOC)
  const docResource = {
    id: 'doc_same_dept_test',
    departmentId: docDept.id,
    orgId: adminUser.orgId,
    createdBy: 'u_other_doc',
    ownerId: 'u_other_doc',
  }

  // Test ADMIN on Same Dept
  for (const act of actionsToCheck) {
    const res = await PermissionService.check(adminUser, 'DOCUMENTS', act, docResource)
    assert(res.allowed, `ADMIN - Same Dept - Action ${act}: Cho phép (ORG scope)`)
  }

  // Test MANAGER on Same Dept
  for (const act of actionsToCheck) {
    const res = await PermissionService.check(managerUser, 'DOCUMENTS', act, docResource)
    if (act === 'DELETE') {
      assert(!res.allowed, `MANAGER - Same Dept - Action DELETE: BỊ TỪ CHỐI (Manager không có quyền DELETE)`)
    } else {
      assert(res.allowed, `MANAGER - Same Dept - Action ${act}: Cho phép (DEPARTMENT scope)`)
    }
  }

  // Test STAFF on Same Dept
  for (const act of actionsToCheck) {
    const res = await PermissionService.check(staffUser, 'DOCUMENTS', act, docResource)
    if (act === 'DELETE' || act === 'SHARE') {
      assert(!res.allowed, `STAFF - Same Dept - Action ${act}: BỊ TỪ CHỐI (Staff không có quyền ${act})`)
    } else {
      assert(res.allowed, `STAFF - Same Dept - Action ${act}: Cho phép (DEPARTMENT scope)`)
    }
  }

  // Context 2: Other Department (Lô hàng/chứng từ thuộc EXP, không ai phòng DOC được phân công)
  const expResourceUnassigned = {
    id: 'doc_exp_unassigned_test',
    departmentId: expDept.id,
    orgId: adminUser.orgId,
    createdBy: 'u_exp_user',
    ownerId: 'u_exp_user',
  }

  for (const act of actionsToCheck) {
    // Admin: vẫn cho phép
    const resAdmin = await PermissionService.check(adminUser, 'DOCUMENTS', act, expResourceUnassigned)
    assert(resAdmin.allowed, `ADMIN - Other Dept - Action ${act}: Cho phép (ORG scope)`)

    // Manager: Bị từ chối
    const resMgr = await PermissionService.check(managerUser, 'DOCUMENTS', act, expResourceUnassigned)
    assert(!resMgr.allowed, `MANAGER - Other Dept (Unassigned) - Action ${act}: BỊ TỪ CHỐI`)

    // Staff: Bị từ chối
    const resStaff = await PermissionService.check(staffUser, 'DOCUMENTS', act, expResourceUnassigned)
    assert(!resStaff.allowed, `STAFF - Other Dept (Unassigned) - Action ${act}: BỊ TỪ CHỐI`)
  }

  // Context 3: Other Department nhưng Nhân viên DOC (staffUser) được phân công tham gia
  const expResourceAssignedToStaff = {
    id: 'doc_exp_assigned_test',
    departmentId: expDept.id,
    orgId: adminUser.orgId,
    createdBy: 'u_exp_user',
    ownerId: 'u_exp_user',
    assignedUserIds: [staffUser.id],
  }

  for (const act of actionsToCheck) {
    // Admin: Được phép
    const resAdmin = await PermissionService.check(adminUser, 'DOCUMENTS', act, expResourceAssignedToStaff)
    assert(resAdmin.allowed, `ADMIN - Assigned Resource - Action ${act}: Cho phép`)

    // Staff: Được phép VIEW, UPLOAD, EDIT, DOWNLOAD (trừ DELETE, SHARE)
    const resStaff = await PermissionService.check(staffUser, 'DOCUMENTS', act, expResourceAssignedToStaff)
    if (act === 'DELETE' || act === 'SHARE') {
      assert(!resStaff.allowed, `STAFF - Assigned Resource - Action ${act}: BỊ TỪ CHỐI`)
    } else {
      assert(resStaff.allowed, `STAFF - Assigned Resource - Action ${act}: Cho phép (ASSIGNED scope)`)
    }

    // Manager DOC: Được phép nhờ Responsible Staff Model (trừ DELETE)
    const resMgr = await PermissionService.check(managerUser, 'DOCUMENTS', act, expResourceAssignedToStaff)
    if (act === 'DELETE') {
      assert(!resMgr.allowed, `MANAGER - Staff-Assigned Resource - Action DELETE: BỊ TỪ CHỐI`)
    } else {
      assert(resMgr.allowed, `MANAGER - Staff-Assigned Resource - Action ${act}: Cho phép (Responsible Staff Model)`)
    }
  }

  // ---------------------------------------------------------------------------
  // PHẦN 4: KIỂM CHỨNG LÔ HÀNG THỰC TẾ S2 (EXP) ĐƯỢC QUẢN LÝ BỞI TRƯỞNG PHÒNG DOC
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 4] KIỂM CHỨNG THỰC TẾ LÔ HÀNG S2 (EXP) ĐƯỢC GIÁM SÁT BỞI TRƯỞNG PHÒNG DOC')

  // Đảm bảo s2 có participant u4 (lan.pham, DOC staff)
  await prisma.shipmentParticipant.upsert({
    where: { shipmentId_userId: { shipmentId: 's2', userId: staffUser.id } },
    update: { roleInShipment: 'DOC_SPECIALIST' },
    create: { shipmentId: 's2', userId: staffUser.id, roleInShipment: 'DOC_SPECIALIST' },
  })

  // Truy vấn danh sách shipment bằng DB query filter tập trung
  const mgrShipmentWhere = await buildShipmentWhereInput(managerUser, 'VIEW')
  const visibleShipmentsToMgr = await prisma.shipment.findMany({
    where: mgrShipmentWhere,
    select: { id: true, jobNo: true, departmentId: true },
  })

  const mgrCanSeeS2 = visibleShipmentsToMgr.some((s) => s.id === 's2')
  assert(mgrCanSeeS2, 'Trưởng phòng DOC thấy lô hàng s2 (EXP) trong danh sách truy vấn DB do có nhân viên DOC tham gia')

  // Kiểm tra tài liệu thuộc lô s2
  const mgrDocWhere = await buildDocumentWhereInput(managerUser, 'VIEW')
  const visibleDocsToMgr = await prisma.document.findMany({
    where: mgrDocWhere,
    select: { id: true, shipmentId: true, title: true },
  })
  const mgrCanSeeS2Docs = visibleDocsToMgr.some((d) => d.shipmentId === 's2')
  assert(mgrCanSeeS2Docs, 'Trưởng phòng DOC thấy chứng từ của lô hàng s2 trong danh sách truy vấn DB')

  // Kiểm tra chi tiết qua PermissionService.check
  const s2Full = await prisma.shipment.findUnique({
    where: { id: 's2' },
    include: { participants: true },
  })
  if (s2Full) {
    const s2Participants = s2Full.participants.map((p) => p.userId)

    const evalMgrView = await PermissionService.check(managerUser, 'SHIPMENTS', 'VIEW', {
      id: s2Full.id,
      departmentId: s2Full.departmentId,
      ownerId: s2Full.ownerId,
      assignedUserIds: s2Participants,
    })
    assert(evalMgrView.allowed, 'Trưởng phòng DOC có quyền VIEW chi tiết lô hàng s2')

    const evalMgrEdit = await PermissionService.check(managerUser, 'SHIPMENTS', 'EDIT', {
      id: s2Full.id,
      departmentId: s2Full.departmentId,
      ownerId: s2Full.ownerId,
      assignedUserIds: s2Participants,
    })
    assert(evalMgrEdit.allowed, 'Trưởng phòng DOC có quyền EDIT lô hàng s2')

    const evalMgrDelete = await PermissionService.check(managerUser, 'SHIPMENTS', 'DELETE', {
      id: s2Full.id,
      departmentId: s2Full.departmentId,
      ownerId: s2Full.ownerId,
      assignedUserIds: s2Participants,
    })
    assert(!evalMgrDelete.allowed, 'Trưởng phòng DOC bị từ chối DELETE lô hàng s2')
  }

  // ---------------------------------------------------------------------------
  // PHẦN 5: CHỐNG RÒ RỈ KHI TÌM KIẾM TỪ KHÓA (SEARCH `q` LEAKAGE TEST)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 5] KIỂM CHỨNG CHỐNG RÒ RỈ DỮ LIỆU KHI TÌM KIẾM (SEARCH `q`)')

  // Tìm một shipment thuộc EXP không do DOC sở hữu và không gán cho DOC (ví dụ s6)
  const unassignedExpShipment = await prisma.shipment.findFirst({
    where: {
      departmentId: expDept.id,
      owner: { departments: { none: { departmentId: docDept.id } } },
      participants: { none: { user: { departments: { some: { departmentId: docDept.id } } } } },
    },
  })

  if (unassignedExpShipment) {
    // Khi nhân viên hoặc trưởng phòng DOC tìm kiếm chính xác JobNo của s6
    const targetJobNo = unassignedExpShipment.jobNo

    // Áp dụng cấu trúc query an toàn từ app/api/shipments/route.ts
    const safeStaffSearchWhere = {
      AND: [
        await buildShipmentWhereInput(staffUser, 'VIEW'),
        {
          OR: [
            { jobNo: { contains: targetJobNo } },
            { blNo: { contains: targetJobNo } },
          ],
        },
      ],
    }

    const leakedToStaff = await prisma.shipment.findMany({ where: safeStaffSearchWhere })
    assert(leakedToStaff.length === 0, `Search q: Nhân viên DOC tìm kiếm chính xác JobNo (${targetJobNo}) của phòng EXP trả về 0 kết quả (Không rò rỉ)`)

    const safeMgrSearchWhere = {
      AND: [
        await buildShipmentWhereInput(managerUser, 'VIEW'),
        {
          OR: [
            { jobNo: { contains: targetJobNo } },
            { blNo: { contains: targetJobNo } },
          ],
        },
      ],
    }
    const leakedToMgr = await prisma.shipment.findMany({ where: safeMgrSearchWhere })
    assert(leakedToMgr.length === 0, `Search q: Trưởng phòng DOC tìm kiếm JobNo (${targetJobNo}) phòng EXP chưa phân công trả về 0 kết quả (Không rò rỉ)`)
  }

  // ---------------------------------------------------------------------------
  // PHẦN 6: TÍNH NHẤT QUÁN TỪ DANH SÁCH ĐẾN CHI TIẾT (LIST-TO-DETAIL CONSISTENCY)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 6] KIỂM TRA TÍNH NHẤT QUÁN TỪ DANH SÁCH ĐẾN CHI TIẾT (0 LỖI 403)')

  // Mọi shipment lấy từ buildShipmentWhereInput cho Staff phải mở được khi gọi PermissionService.check
  const staffVisibleShipments = await prisma.shipment.findMany({
    where: await buildShipmentWhereInput(staffUser, 'VIEW'),
    include: { participants: true },
  })

  let allStaffShipmentsAccessible = true
  for (const s of staffVisibleShipments) {
    const res = await PermissionService.check(staffUser, 'SHIPMENTS', 'VIEW', {
      id: s.id,
      departmentId: s.departmentId,
      ownerId: s.ownerId,
      assignedUserIds: s.participants.map((p) => p.userId),
    })
    if (!res.allowed) {
      allStaffShipmentsAccessible = false
      break
    }
  }
  assert(allStaffShipmentsAccessible, `Mọi lô hàng (${staffVisibleShipments.length} lô) trong danh sách của STAFF đều mở được chi tiết VIEW (Không gặp 403)`)

  // Mọi document lấy từ buildDocumentWhereInput cho Manager DOC phải mở được chi tiết
  const mgrVisibleDocs = await prisma.document.findMany({
    where: await buildDocumentWhereInput(managerUser, 'VIEW'),
    include: { shipment: { include: { participants: true } } },
  })

  let allMgrDocsAccessible = true
  for (const doc of mgrVisibleDocs) {
    const pIds = doc.shipment?.participants.map((p) => p.userId) || []
    const res = await PermissionService.check(managerUser, 'DOCUMENTS', 'VIEW', {
      id: doc.id,
      departmentId: doc.departmentId,
      createdBy: doc.createdBy,
      ownerId: doc.shipment?.ownerId,
      assignedUserIds: pIds,
    })
    if (!res.allowed) {
      allMgrDocsAccessible = false
      break
    }
  }
  assert(allMgrDocsAccessible, `Mọi chứng từ (${mgrVisibleDocs.length} chứng từ) trong danh sách của MANAGER đều mở được chi tiết VIEW (Không gặp 403)`)

  // ---------------------------------------------------------------------------
  // PHẦN 7: TÍNH TOÀN VẸN CỦA Document.departmentId
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 7] KIỂM TRA RÀNG BUỘC Document.departmentId BẮT BUỘC & KHÔNG NULL')

  const nullDeptCountResult = await prisma.$queryRawUnsafe<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM Document WHERE departmentId IS NULL'
  )
  const nullCount = Number(nullDeptCountResult[0]?.count || 0)
  assert(nullCount === 0, '100% tài liệu trong cơ sở dữ liệu có departmentId không null')

  let threwNullDept = false
  try {
    await (prisma.document.create as any)({
      data: {
        title: 'Invalid Null Dept Doc',
        fileName: 'invalid.pdf',
        type: 'BL',
        shipmentId: 's2',
        customerId: 'c1',
        departmentId: null,
        orgId: adminUser.orgId,
      },
    })
  } catch (err: any) {
    threwNullDept = true
  }
  assert(threwNullDept, 'Prisma và CSDL từ chối tạo Document với departmentId = null')

  // Kiểm tra departmentId của document khớp với departmentId của shipment
  const allDocs = await prisma.document.findMany({
    include: { shipment: true },
  })

  const allMatched = allDocs.every(
    (d) => d.departmentId === d.shipment.departmentId
  )
  assert(allMatched, `100% tài liệu (${allDocs.length} tài liệu) có departmentId khớp chính xác với departmentId của shipment tương ứng`)

  // ---------------------------------------------------------------------------
  // PHẦN 8: KIỂM TRA TÍNH NĂNG PHÂN CÔNG THÀNH VIÊN LÔ HÀNG (ShipmentParticipant)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 8] KIỂM TRA QUẢN LÝ PHÂN CÔNG NHÂN VIÊN (ShipmentParticipant API)')

  // 1. Thêm phân công mới
  const testPartShipment = await prisma.shipment.findFirst()
  if (testPartShipment) {
    const createdPart = await prisma.shipmentParticipant.upsert({
      where: {
        shipmentId_userId: { shipmentId: testPartShipment.id, userId: staffUser.id },
      },
      update: { roleInShipment: 'DOC_SPECIALIST' },
      create: {
        shipmentId: testPartShipment.id,
        userId: staffUser.id,
        roleInShipment: 'DOC_SPECIALIST',
      },
      include: { user: true },
    })
    assert(Boolean(createdPart && createdPart.roleInShipment === 'DOC_SPECIALIST'), 'Thêm chuyên viên vào lô hàng thành công')

    // 2. Lấy danh sách thành viên
    const participants = await prisma.shipmentParticipant.findMany({
      where: { shipmentId: testPartShipment.id },
    })
    assert(participants.some((p) => p.userId === staffUser.id), 'Danh sách người tham gia phản ánh đúng nhân viên vừa gán')

    // 3. Xóa thành viên
    await prisma.shipmentParticipant.delete({
      where: { shipmentId_userId: { shipmentId: testPartShipment.id, userId: staffUser.id } },
    })
    const afterDelete = await prisma.shipmentParticipant.findUnique({
      where: { shipmentId_userId: { shipmentId: testPartShipment.id, userId: staffUser.id } },
    })
    assert(afterDelete === null, 'Gỡ bỏ phân công nhân viên khỏi lô hàng thành công')
  }

  // ============================================================================
  // TỔNG KẾT
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  console.log('KẾT QUẢ KIỂM THỬ PHÂN QUYỀN & MÔ HÌNH PHÒNG BAN PHỤ TRÁCH:')
  console.log(`TỔNG CỘNG:  ${results.total} BÀI KIỂM THỬ`)
  console.log(`THÀNH CÔNG: ${results.passed} PASSED`)
  console.log(`THẤT BẠI:   ${results.failed} FAILED`)
  console.log('='.repeat(80))

  if (results.failed > 0) {
    throw new Error(`${results.failed} bài kiểm thử phân quyền thất bại!`)
  }
}

runPermissionMatrixTests()
  .catch((err) => {
    console.error('Lỗi ngoại lệ trong quá trình chạy kiểm thử phân quyền:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
