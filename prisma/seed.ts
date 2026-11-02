import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('--- Bắt đầu Seeding Dữ liệu Doanh nghiệp TML Logistics ---')

  // 1. Organization
  const org = await prisma.organization.upsert({
    where: { taxCode: '0312456789' },
    update: {},
    create: {
      name: 'Công ty TNHH Logistics Tân Minh (TML)',
      taxCode: '0312456789',
      address: '12 Nguyễn Tất Thành, Phường 12, Quận 4, TP. Hồ Chí Minh',
      plan: 'Enterprise Business',
    },
  })

  // 2. Roles
  const roles = [
    { code: 'ADMIN', name: 'Quản trị viên hệ thống', description: 'Toàn quyền quản trị tổ chức, người dùng và phân quyền' },
    { code: 'MANAGER', name: 'Quản lý phòng ban', description: 'Quản lý nhân sự, công việc và chứng từ trong phạm vi phòng ban' },
    { code: 'STAFF', name: 'Nhân viên tác nghiệp', description: 'Thực hiện nghiệp vụ chứng từ và lô hàng được phân công' },
  ]

  for (const r of roles) {
    await prisma.role.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description },
      create: r,
    })
  }

  // 3. Permissions
  const modules = ['DOCUMENTS', 'SHIPMENTS', 'USERS', 'DEPARTMENTS', 'AUDIT', 'SETTINGS', 'ARCHIVE']
  const actions = ['VIEW', 'CREATE', 'EDIT', 'DELETE', 'UPLOAD', 'DOWNLOAD', 'SHARE', 'APPROVE', 'EXPORT', 'ASSIGN', 'RESTORE', 'MANAGE']

  const permissionList: { code: string; module: string; action: string; description: string }[] = []

  for (const mod of modules) {
    for (const act of actions) {
      // Filter out non-applicable combinations if any, or register all standard
      permissionList.push({
        code: `${mod}:${act}`,
        module: mod,
        action: act,
        description: `Quyền ${act} trong phân hệ ${mod}`,
      })
    }
  }

  for (const p of permissionList) {
    await prisma.permission.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    })
  }

  // Gán quyền cho Roles:
  // Admin: Toàn bộ
  const allPerms = await prisma.permission.findMany()
  const adminRole = await prisma.role.findUnique({ where: { code: 'ADMIN' } })
  const managerRole = await prisma.role.findUnique({ where: { code: 'MANAGER' } })
  const staffRole = await prisma.role.findUnique({ where: { code: 'STAFF' } })

  if (adminRole) {
    for (const p of allPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: adminRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: adminRole.id, permissionId: p.id },
      })
    }
  }

  // Manager: Documents (all except DELETE), Shipments (all except DELETE), Users (VIEW only), Audit (VIEW only), Archive (all except DELETE)
  if (managerRole) {
    const managerPerms = allPerms.filter((p) => {
      if (['USERS', 'DEPARTMENTS', 'AUDIT'].includes(p.module)) {
        return p.action === 'VIEW'
      }
      if (p.module === 'SETTINGS') return false
      if (p.action === 'DELETE') return false
      return true
    })
    for (const p of managerPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: managerRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: managerRole.id, permissionId: p.id },
      })
    }
  }

  // Staff: VIEW, UPLOAD, DOWNLOAD, EDIT for documents/shipments assigned
  if (staffRole) {
    const staffPerms = allPerms.filter((p) => {
      if (['DOCUMENTS', 'SHIPMENTS', 'ARCHIVE'].includes(p.module)) {
        return ['VIEW', 'UPLOAD', 'DOWNLOAD', 'EDIT'].includes(p.action)
      }
      return false
    })
    for (const p of staffPerms) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: staffRole.id, permissionId: p.id } },
        update: {},
        create: { roleId: staffRole.id, permissionId: p.id },
      })
    }
  }

  // 4. Departments
  const depts = [
    { code: 'DOC', name: 'Phòng Chứng từ' },
    { code: 'EXP', name: 'Phòng Hàng xuất' },
    { code: 'IMP', name: 'Phòng Hàng nhập' },
    { code: 'ACC', name: 'Phòng Kế toán' },
    { code: 'SALES', name: 'Phòng Kinh doanh' },
    { code: 'MGMT', name: 'Ban Giám Đốc' },
  ]

  const deptMap: Record<string, string> = {}
  for (const d of depts) {
    const dept = await prisma.department.upsert({
      where: { orgId_code: { orgId: org.id, code: d.code } },
      update: { name: d.name },
      create: { orgId: org.id, code: d.code, name: d.name },
    })
    deptMap[d.code] = dept.id
  }

  // 5. Positions
  const positions = [
    { name: 'Giám đốc', level: 5 },
    { name: 'Trưởng phòng', level: 4 },
    { name: 'Trưởng nhóm', level: 3 },
    { name: 'Chuyên viên Chứng từ', level: 2 },
    { name: 'Chuyên viên Khai thác', level: 2 },
    { name: 'Kế toán viên', level: 2 },
  ]

  const posMap: Record<string, string> = {}
  for (const pos of positions) {
    const p = await prisma.position.upsert({
      where: { orgId_name: { orgId: org.id, name: pos.name } },
      update: { level: pos.level },
      create: { orgId: org.id, name: pos.name, level: pos.level },
    })
    posMap[pos.name] = p.id
  }

  // 6. Users & Passwords
  const isTestMode = process.argv.includes('--test') || process.env.SEED_MODE === 'test'

  function generateSecureRandomPassword(length = 20): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'
    const bytes = crypto.randomBytes(length)
    let result = ''
    for (let i = 0; i < length; i++) {
      result += chars[bytes[i] % chars.length]
    }
    return result
  }

  // Production Seed: Chỉ tạo 1 tài khoản Admin duy nhất với mật khẩu ngẫu nhiên in ra 1 lần
  const adminRandomPassword = generateSecureRandomPassword(20)
  const adminPasswordHash = await bcrypt.hash(adminRandomPassword, 12)

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@tml.vn' },
    update: {
      name: 'Nguyễn Hoàng',
      initials: 'NH',
      roleCode: 'ADMIN',
      isActive: true,
      mustChangePassword: true,
    },
    create: {
      id: 'u1',
      orgId: org.id,
      email: 'admin@tml.vn',
      passwordHash: adminPasswordHash,
      name: 'Nguyễn Hoàng',
      initials: 'NH',
      roleCode: 'ADMIN',
      isActive: true,
      mustChangePassword: true,
    },
  })

  // Gắn phòng ban và chức vụ cho Admin
  const mgmtDeptId = deptMap['MGMT']
  if (mgmtDeptId) {
    await prisma.userDepartment.upsert({
      where: { userId_departmentId: { userId: adminUser.id, departmentId: mgmtDeptId } },
      update: { isManager: true, isPrimary: true },
      create: {
        userId: adminUser.id,
        departmentId: mgmtDeptId,
        isPrimary: true,
        isManager: true,
      },
    })
    await prisma.department.update({
      where: { id: mgmtDeptId },
      data: { headUserId: adminUser.id },
    })
  }

  const gdocPosId = posMap['Giám đốc']
  if (gdocPosId) {
    await prisma.userPosition.upsert({
      where: { userId_positionId: { userId: adminUser.id, positionId: gdocPosId } },
      update: {},
      create: { userId: adminUser.id, positionId: gdocPosId },
    })
  }

  if (!isTestMode) {
    console.log('='.repeat(80))
    console.log('🚀 SEED CƠ SỞ DỮ LIỆU SẠCH CHO MÔI TRƯỜNG PRODUCTION THÀNH CÔNG!')
    console.log('='.repeat(80))
    console.log(`👤 Tài khoản Quản trị viên (Admin):`)
    console.log(`   - Email:               admin@tml.vn`)
    console.log(`   - Mật khẩu khởi tạo:  ${adminRandomPassword}`)
    console.log(`   - Bắt buộc đổi MK:    CÓ (mustChangePassword = true)`)
    console.log(`\n⚠️  CẢNH BÁO AN NINH:`)
    console.log(`   Mật khẩu khởi tạo ngẫu nhiên chỉ được in ra duy nhất một lần tại nhật ký này.`)
    console.log(`   Hãy lưu trữ an toàn trong trình quản lý mật khẩu của doanh nghiệp.`)
    console.log(`   Hệ thống sạch không chứa bất kỳ dữ liệu mẫu (Dummy/Test Data) nào.`)
    console.log('='.repeat(80))
    return
  }

  // --- NẾU CHẠY CHẾ ĐỘ TEST/DEVELOPMENT (--test) ---
  console.log('--- Đang khởi tạo thêm dữ liệu mẫu cho môi trường kiểm thử (--test) ---')
  const testPasswordHash = await bcrypt.hash('TestOnly@2026!', 10)

  const usersData = [
    {
      id: 'u2',
      email: 'ha.tran@tml.vn',
      name: 'Trần Thu Hà',
      initials: 'TH',
      roleCode: 'MANAGER',
      deptCode: 'DOC',
      posName: 'Trưởng phòng',
      isManager: true,
    },
    {
      id: 'u3',
      email: 'tuan.le@tml.vn',
      name: 'Lê Minh Tuấn',
      initials: 'LT',
      roleCode: 'MANAGER',
      deptCode: 'EXP',
      posName: 'Trưởng phòng',
      isManager: true,
    },
    {
      id: 'u8',
      email: 'mai.hoang@tml.vn',
      name: 'Hoàng Thị Mai',
      initials: 'HM',
      roleCode: 'MANAGER',
      deptCode: 'IMP',
      posName: 'Trưởng phòng',
      isManager: true,
    },
    {
      id: 'u4',
      email: 'lan.pham@tml.vn',
      name: 'Phạm Ngọc Lan',
      initials: 'PL',
      roleCode: 'STAFF',
      deptCode: 'DOC',
      posName: 'Chuyên viên Chứng từ',
      isManager: false,
    },
    {
      id: 'u5',
      email: 'anh.vo@tml.vn',
      name: 'Võ Đức Anh',
      initials: 'VA',
      roleCode: 'STAFF',
      deptCode: 'EXP',
      posName: 'Chuyên viên Khai thác',
      isManager: false,
    },
    {
      id: 'u6',
      email: 'linh.dang@tml.vn',
      name: 'Đặng Mỹ Linh',
      initials: 'ĐL',
      roleCode: 'STAFF',
      deptCode: 'ACC',
      posName: 'Kế toán viên',
      isManager: false,
    },
    {
      id: 'u7',
      email: 'khanh.bui@tml.vn',
      name: 'Bùi Quốc Khánh',
      initials: 'BK',
      roleCode: 'STAFF',
      deptCode: 'SALES',
      posName: 'Chuyên viên Khai thác',
      isManager: false,
    },
  ]

  const userMap: Record<string, string> = {}
  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        name: u.name,
        initials: u.initials,
        roleCode: u.roleCode,
      },
      create: {
        id: u.id,
        orgId: org.id,
        email: u.email,
        passwordHash: testPasswordHash,
        name: u.name,
        initials: u.initials,
        roleCode: u.roleCode,
        isActive: true,
        mustChangePassword: false,
      },
    })
    userMap[u.id] = user.id

    // User department link
    const deptId = deptMap[u.deptCode]
    if (deptId) {
      await prisma.userDepartment.upsert({
        where: { userId_departmentId: { userId: user.id, departmentId: deptId } },
        update: { isManager: u.isManager, isPrimary: true },
        create: {
          userId: user.id,
          departmentId: deptId,
          isPrimary: true,
          isManager: u.isManager,
        },
      })
      if (u.isManager) {
        await prisma.department.update({
          where: { id: deptId },
          data: { headUserId: user.id },
        })
      }
    }

    // User position link
    const posId = posMap[u.posName]
    if (posId) {
      await prisma.userPosition.upsert({
        where: { userId_positionId: { userId: user.id, positionId: posId } },
        update: {},
        create: { userId: user.id, positionId: posId },
      })
    }
  }

  // 7. Customers
  const customers = [
    { id: 'c1', name: 'Công ty CP Hải Sản Phương Nam', shortName: 'Hải Sản Phương Nam', taxCode: '0301112223' },
    { id: 'c2', name: 'Công ty TNHH Dệt May An Phát', shortName: 'Dệt May An Phát', taxCode: '0304445556' },
    { id: 'c3', name: 'Công ty CP Nội Thất Gỗ Việt', shortName: 'Nội Thất Gỗ Việt', taxCode: '3702223334' },
    { id: 'c4', name: 'Công ty TNHH Cà Phê Cao Nguyên Xanh', shortName: 'Cà Phê Cao Nguyên Xanh', taxCode: '6001234567' },
    { id: 'c5', name: 'Công ty TNHH Điện Tử Sao Mai', shortName: 'Điện Tử Sao Mai', taxCode: '0108889990' },
    { id: 'c6', name: 'Công ty CP Giày Da Bình Minh', shortName: 'Giày Da Bình Minh', taxCode: '3701119998' },
  ]

  for (const c of customers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {},
      create: { id: c.id, orgId: org.id, name: c.name, shortName: c.shortName, taxCode: c.taxCode },
    })
  }

  // 8. Archive Boxes
  const boxes = [
    { id: 'ab1', code: 'ARC-2609-001', warehouse: 'Kho Quận 4 - HCM', shelf: 'A3', box: '12', customerId: 'c1', period: '2026-09', createdBy: 'u2' },
    { id: 'ab2', code: 'ARC-2609-002', warehouse: 'Kho Quận 4 - HCM', shelf: 'A3', box: '13', customerId: 'c3', period: '2026-09', createdBy: 'u2' },
    { id: 'ab3', code: 'ARC-2610-001', warehouse: 'Kho Quận 4 - HCM', shelf: 'B1', box: '01', period: '2026-10', createdBy: 'u4' },
    { id: 'ab4', code: 'ARC-2610-002', warehouse: 'Kho Hải Phòng', shelf: 'C2', box: '04', customerId: 'c5', period: '2026-10', createdBy: 'u8' },
    { id: 'ab5', code: 'ARC-2110-007', warehouse: 'Kho dài hạn Bình Chánh', shelf: 'Z9', box: '41', customerId: 'c2', period: '2021-10', createdBy: 'u3' },
  ]

  for (const b of boxes) {
    await prisma.archiveBox.upsert({
      where: { id: b.id },
      update: {},
      create: {
        id: b.id,
        orgId: org.id,
        code: b.code,
        warehouse: b.warehouse,
        shelf: b.shelf,
        box: b.box,
        customerId: b.customerId,
        period: b.period,
        createdBy: b.createdBy,
      },
    })
  }

  // 9. Shipments
  const shipments = [
    { id: 's1', jobNo: 'TML-SE2610-0142', blNo: 'HLCUSGN2610418', customerId: 'c1', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Los Angeles, US', etd: '2026-10-12', eta: '2026-11-03', status: 'customs', ownerId: 'u4', deptCode: 'EXP', goodsDesc: 'FROZEN PANGASIUS FILLET (CÁ TRA PHI LÊ ĐÔNG LẠNH), HS 0304.62' },
    { id: 's2', jobNo: 'TML-SE2610-0139', blNo: 'MAEU262104471', customerId: 'c2', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Rotterdam, NL', etd: '2026-10-08', eta: '2026-11-10', status: 'delivered', ownerId: 'u3', deptCode: 'EXP', goodsDesc: 'COTTON T-SHIRTS AND KNITWEAR (ÁO THUN COTTON), HS 6109.10' },
    { id: 's3', jobNo: 'TML-SI2610-0087', blNo: 'ONEYPUSA28831', customerId: 'c5', mode: 'sea', origin: 'Busan, KR', destination: 'Hải Phòng, VN', etd: '2026-10-10', eta: '2026-10-21', status: 'on_yard', ownerId: 'u8', deptCode: 'IMP', goodsDesc: 'PRINTED CIRCUIT BOARD ASSEMBLY (BẢN MẠCH ĐIỆN TỬ), HS 8534.00' },
    { id: 's4', jobNo: 'TML-AE2610-0031', blNo: '618-24519932', customerId: 'c5', mode: 'air', origin: 'Tân Sơn Nhất, VN', destination: 'Narita, JP', etd: '2026-10-17', eta: '2026-10-18', status: 'delivered', ownerId: 'u5', deptCode: 'EXP', goodsDesc: 'PRINTED CIRCUIT BOARD ASSEMBLY (BẢN MẠCH ĐIỆN TỬ), HS 8534.00' },
    { id: 's5', jobNo: 'TML-SE2610-0133', blNo: 'COSU6421887310', customerId: 'c3', mode: 'sea', origin: 'Quy Nhơn, VN', destination: 'Long Beach, US', etd: '2026-10-05', eta: '2026-10-29', status: 'customs', ownerId: 'u4', deptCode: 'EXP', goodsDesc: 'WOODEN DINING FURNITURE (BÀN GHẾ GỖ), HS 9403.60' },
    { id: 's6', jobNo: 'TML-SE2610-0151', blNo: 'EGLV143650021', customerId: 'c4', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Hamburg, DE', etd: '2026-10-22', eta: '2026-11-26', status: 'booking', ownerId: 'u3', deptCode: 'EXP', goodsDesc: 'ROBUSTA COFFEE BEANS GRADE 1 (CÀ PHÊ NHÂN), HS 0901.11' },
    { id: 's7', jobNo: 'TML-SI2610-0091', blNo: 'CMDUSHA1937220', customerId: 'c6', mode: 'sea', origin: 'Thượng Hải, CN', destination: 'Cát Lái, VN', etd: '2026-10-09', eta: '2026-10-16', status: 'customs', ownerId: 'u8', deptCode: 'IMP', goodsDesc: 'LEATHER FOOTWEAR (GIÀY DA), HS 6403.99' },
    { id: 's8', jobNo: 'TML-RD2610-0012', blNo: 'CMR-LS-2610-12', customerId: 'c2', mode: 'road', origin: 'Hà Nội, VN', destination: 'Bằng Tường, CN', etd: '2026-10-15', eta: '2026-10-17', status: 'delivered', ownerId: 'u5', deptCode: 'EXP', goodsDesc: 'COTTON T-SHIRTS AND KNITWEAR (ÁO THUN COTTON), HS 6109.10' },
    { id: 's9', jobNo: 'TML-SE2609-0118', blNo: 'HLCUSGN2609377', customerId: 'c1', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Tokyo, JP', etd: '2026-09-20', eta: '2026-09-30', status: 'closed', ownerId: 'u4', deptCode: 'EXP', goodsDesc: 'FROZEN PANGASIUS FILLET (CÁ TRA PHI LÊ ĐÔNG LẠNH), HS 0304.62' },
    { id: 's10', jobNo: 'TML-SE2609-0109', blNo: 'MAEU262097745', customerId: 'c3', mode: 'sea', origin: 'Cái Mép, VN', destination: 'Sydney, AU', etd: '2026-09-14', eta: '2026-10-02', status: 'closed', ownerId: 'u3', deptCode: 'EXP', goodsDesc: 'WOODEN DINING FURNITURE (BÀN GHẾ GỖ), HS 9403.60' },
    { id: 's11', jobNo: 'TML-AI2610-0019', blNo: '160-88231045', customerId: 'c6', mode: 'air', origin: 'Frankfurt, DE', destination: 'Tân Sơn Nhất, VN', etd: '2026-10-18', eta: '2026-10-20', status: 'arrived', ownerId: 'u8', deptCode: 'IMP', goodsDesc: 'LEATHER FOOTWEAR (GIÀY DA), HS 6403.99' },
    { id: 's12', jobNo: 'TML-SE2610-0147', blNo: 'ONEYSGNA77512', customerId: 'c4', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Singapore, SG', etd: '2026-10-14', eta: '2026-10-17', status: 'customs', ownerId: 'u4', deptCode: 'EXP', goodsDesc: 'ROBUSTA COFFEE BEANS GRADE 1 (CÀ PHÊ NHÂN), HS 0901.11' },
    { id: 's13', jobNo: 'TML-SE2109-0044', blNo: 'HLCUSGN2109112', customerId: 'c2', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Antwerp, BE', etd: '2021-09-10', eta: '2021-10-15', status: 'closed', ownerId: 'u3', deptCode: 'EXP', goodsDesc: 'COTTON T-SHIRTS AND KNITWEAR (ÁO THUN COTTON), HS 6109.10' },
    { id: 's14', jobNo: 'TML-SE2110-0058', blNo: 'MAEU211058834', customerId: 'c1', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Busan, KR', etd: '2021-10-28', eta: '2021-11-04', status: 'closed', ownerId: 'u4', deptCode: 'EXP', goodsDesc: 'FROZEN PANGASIUS FILLET (CÁ TRA PHI LÊ ĐÔNG LẠNH), HS 0304.62' },
  ]

  for (const s of shipments) {
    const isExport = s.origin.toUpperCase().includes('VN')
    const reqDocTypes = isExport
      ? ['BL', 'BOOKING', 'PACKING_LIST', 'CO', 'CUSTOMS', 'INVOICE']
      : ['ARRIVAL_NOTICE', 'DELIVERY_ORDER', 'PACKING_LIST', 'CO', 'CUSTOMS', 'INVOICE', 'BL']

    const createdShipment = await prisma.shipment.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        orgId: org.id,
        jobNo: s.jobNo,
        blNo: s.blNo,
        customerId: s.customerId,
        departmentId: deptMap[s.deptCode],
        mode: s.mode,
        origin: s.origin,
        destination: s.destination,
        etd: s.etd,
        eta: s.eta,
        status: s.status,
        ownerId: s.ownerId,
        goodsDesc: s.goodsDesc,
      },
    })

    // Create requirements
    for (const r of reqDocTypes) {
      await prisma.shipmentRequirement.upsert({
        where: { shipmentId_docType: { shipmentId: createdShipment.id, docType: r } },
        update: {},
        create: {
          shipmentId: createdShipment.id,
          docType: r,
          isMandatory: true,
          status: 'MISSING',
        },
      })
    }
  }

  // 10. Vault directory on disk
  const vaultDir = path.resolve(process.cwd(), 'storage_vault')
  if (!fs.existsSync(vaultDir)) {
    fs.mkdirSync(vaultDir, { recursive: true })
  }

  // 11. Documents & Real Storage Files
  const sampleDocs = [
    {
      id: 'doc_s1_bl',
      shipmentId: 's1',
      customerId: 'c1',
      type: 'BL',
      title: 'Vận đơn đường biển Hapag-Lloyd HLCUSGN2610418',
      fileName: 'BL_HLCUSGN2610418.pdf',
      docDate: '2026-10-12',
      createdBy: 'u4',
      pages: 3,
      sizeKb: 412,
      ocrText: `BILL OF LADING\nHAPAG-LLOYD (VIETNAM)\nB/L NO: HLCUSGN2610418\nSHIPPER: CONG TY CP HAI SAN PHUONG NAM\nCONSIGNEE: PACIFIC SEAFOOD TRADING LLC\nPORT OF LOADING: CAT LAI PORT, HO CHI MINH CITY, VIETNAM\nPORT OF DISCHARGE: LOS ANGELES, CA, USA\nVESSEL: NYK THEMIS V.2610E\nDESCRIPTION: 1,420 CARTONS FROZEN PANGASIUS FILLET\nGROSS WEIGHT: 21,300 KGS\nCONTAINER NO: HLXU8492011 / 40HC\nSEAL NO: HL789123`,
      structured: {
        blNo: 'HLCUSGN2610418',
        containerNo: 'HLXU8492011',
        customer: 'Công ty CP Hải Sản Phương Nam',
        portOfLoading: 'Cát Lái, VN',
        portOfDischarge: 'Los Angeles, US',
      },
    },
    {
      id: 'doc_s1_invoice',
      shipmentId: 's1',
      customerId: 'c1',
      type: 'INVOICE',
      title: 'Hóa đơn thương mại INV-2610-088',
      fileName: 'Commercial_Invoice_INV2610088.pdf',
      docDate: '2026-10-11',
      createdBy: 'u4',
      pages: 2,
      sizeKb: 285,
      ocrText: `COMMERCIAL INVOICE\nINVOICE NO: INV-2610-088\nDATE: 11-OCT-2026\nSELLER: CONG TY CP HAI SAN PHUONG NAM\nBUYER: PACIFIC SEAFOOD TRADING LLC\nTOTAL AMOUNT: USD 84,600.00\nTERMS: CIF LOS ANGELES\nPAYMENT: T/T 30 DAYS`,
      structured: {
        invoiceNo: 'INV-2610-088',
        customer: 'Công ty CP Hải Sản Phương Nam',
      },
    },
    {
      id: 'doc_s2_bl',
      shipmentId: 's2',
      customerId: 'c2',
      type: 'BL',
      title: 'Vận đơn Maersk Line MAEU262104471',
      fileName: 'BL_MAEU262104471.pdf',
      docDate: '2026-10-08',
      createdBy: 'u3',
      pages: 2,
      sizeKb: 345,
      ocrText: `MAERSK LINE BILL OF LADING\nB/L: MAEU262104471\nSHIPPER: CONG TY TNHH DET MAY AN PHAT\nCONSIGNEE: EURO TEXTILE LOGISTICS BV\nPORT OF LOADING: CAT LAI, VIETNAM\nPORT OF DISCHARGE: ROTTERDAM, NETHERLANDS\nGOODS: 100% COTTON T-SHIRTS AND KNITWEAR\nCONTAINER: MSKU9182344`,
      structured: {
        blNo: 'MAEU262104471',
        containerNo: 'MSKU9182344',
        customer: 'Công ty TNHH Dệt May An Phát',
        portOfLoading: 'Cát Lái, VN',
        portOfDischarge: 'Rotterdam, NL',
      },
    },
    {
      id: 'doc_s3_an',
      shipmentId: 's3',
      customerId: 'c5',
      type: 'ARRIVAL_NOTICE',
      title: 'Thông báo hàng đến ONE ONEYPUSA28831',
      fileName: 'Arrival_Notice_ONEYPUSA28831.pdf',
      docDate: '2026-10-19',
      createdBy: 'u8',
      pages: 1,
      sizeKb: 198,
      ocrText: `OCEAN NETWORK EXPRESS (ONE)\nARRIVAL NOTICE\nB/L NO: ONEYPUSA28831\nVESSEL: ONE CONTEMPLATION V.024S\nPORT OF DISCHARGE: HAI PHONG PORT\nETA: 21-OCT-2026\nNOTIFY PARTY: CONG TY TNHH DIEN TU SAO MAI\nGOODS: PRINTED CIRCUIT BOARD ASSEMBLY`,
      structured: {
        blNo: 'ONEYPUSA28831',
        customer: 'Công ty TNHH Điện Tử Sao Mai',
        portOfDischarge: 'Hải Phòng, VN',
      },
    },
    {
      id: 'doc_s5_packing_list',
      shipmentId: 's5',
      customerId: 'c3',
      type: 'PACKING_LIST',
      title: 'Phiếu đóng gói PKL-2610-033',
      fileName: 'Packing_List_PKL2610033.pdf',
      docDate: '2026-10-04',
      createdBy: 'u4',
      pages: 4,
      sizeKb: 512,
      ocrText: `PACKING LIST\nREF: PKL-2610-033\nSHIPPER: CONG TY CP NOI THAT GO VIET\nBUYER: AMERICAN HOME FURNITURE INC\nGOODS: WOODEN DINING FURNITURE (BAN GHE GO)\nTOTAL PACKAGES: 450 PACKAGES\nNET WEIGHT: 14,200 KGS\nGROSS WEIGHT: 15,600 KGS`,
      structured: {
        customer: 'Công ty CP Nội Thất Gỗ Việt',
      },
    },
  ]

  for (const doc of sampleDocs) {
    const storageKey = `docs/${doc.id}/${doc.fileName}`
    const filePath = path.join(vaultDir, doc.fileName)

    // Write physical file to storage vault if not exists
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, Buffer.from(`TML LOGISTICS DOCUMENT VAULT\n${doc.title}\n\n${doc.ocrText}`))
    }

    const createdDoc = await prisma.document.upsert({
      where: { id: doc.id },
      update: {},
      create: {
        id: doc.id,
        orgId: org.id,
        shipmentId: doc.shipmentId,
        customerId: doc.customerId,
        type: doc.type,
        title: doc.title,
        fileName: doc.fileName,
        fileSizeBytes: doc.sizeKb * 1024,
        storageKey: storageKey,
        pages: doc.pages,
        docDate: doc.docDate,
        retentionUntil: '2031-10-19',
        createdBy: doc.createdBy,
        updatedBy: doc.createdBy,
        editedHtml: `<p>${doc.title}</p><pre>${doc.ocrText}</pre>`,
      },
    })

    // Create version 1
    const v1 = await prisma.documentVersion.upsert({
      where: { documentId_versionNumber: { documentId: createdDoc.id, versionNumber: 1 } },
      update: {},
      create: {
        documentId: createdDoc.id,
        versionNumber: 1,
        fileName: doc.fileName,
        storageKey: storageKey,
        sizeBytes: doc.sizeKb * 1024,
        uploadedBy: doc.createdBy,
        changeNote: 'Tải lên ban đầu',
      },
    })

    // Create OCR result
    await prisma.documentOcrResult.create({
      data: {
        documentId: createdDoc.id,
        versionId: v1.id,
        status: 'COMPLETED',
        confidenceScore: 94.5,
        rawText: doc.ocrText,
        structuredData: JSON.stringify(doc.structured),
      },
    })

    // Update shipment requirement status to UPLOADED
    await prisma.shipmentRequirement.updateMany({
      where: { shipmentId: doc.shipmentId, docType: doc.type },
      data: { status: 'UPLOADED' },
    })

    // Register storage object
    await prisma.storageObject.upsert({
      where: { storageKey: storageKey },
      update: {},
      create: {
        storageKey: storageKey,
        bucket: 'tml-vault',
        mimeType: 'application/pdf',
        sizeBytes: doc.sizeKb * 1024,
      },
    })
  }

  // 12. Audit Logs
  const auditActions = ['login', 'view', 'download', 'upload', 'edit', 'share']
  for (let i = 1; i <= 25; i++) {
    const act = auditActions[i % auditActions.length]
    await prisma.auditLog.create({
      data: {
        orgId: org.id,
        userId: usersData[i % usersData.length].id,
        action: act,
        resourceType: act === 'login' ? 'user' : 'document',
        resourceId: act === 'login' ? usersData[i % usersData.length].id : sampleDocs[i % sampleDocs.length].id,
        ipAddress: `113.161.${(i * 17) % 255}.${(i * 31) % 255}`,
        device: 'Chrome 131 · Windows 11',
        status: 'SUCCESS',
      },
    })
  }

  console.log('✅ Seeding Dữ liệu Doanh nghiệp Hoàn tất thành công!')
}

main()
  .catch((e) => {
    console.error('❌ Lỗi khi Seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

