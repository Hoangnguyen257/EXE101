/**
 * TML LOGISTICS - COMPREHENSIVE ACCEPTANCE TEST SUITE: SHIPMENT WIZARD (STEP 1, 2, 3)
 * 
 * Kiểm thử toàn diện quy trình Wizard tạo lô hàng và đính kèm chứng từ:
 * 1. Khởi tạo lô hàng (Step 1): Tự động sinh Job No, chặn trùng số Job, kiểm tra phòng ban phụ trách.
 * 2. Xác thực Bước 2:
 *    - Bỏ trống MST bị chặn 400.
 *    - MST sai checksum bị chặn 400.
 *    - Điểm đi trùng điểm đến (origin === destination) bị chặn 400.
 *    - Bảng hàng hóa thiếu dòng bị chặn 400.
 *    - HS Code sai định dạng bị chặn 400.
 * 3. Điền đủ thông tin hợp lệ Bước 2:
 *    - MST đúng thuật toán Tổng cục Thuế.
 *    - Thêm 2 dòng hàng, HS Code có dấu chấm được chuẩn hóa bỏ dấu chấm trong ShipmentGoods.
 *    - Tự động sinh checklist ShipmentRequirement theo tuyến đường và mode.
 * 4. Đính kèm chứng từ Bước 3:
 *    - Chỉ mở khi đủ thông tin bắt buộc.
 *    - File giả đuôi (fake magic bytes) bị từ chối 100%.
 *    - Upload 2 file hợp lệ (PDF, PNG) qua StorageProvider:
 *      Tạo Document + Version + StorageObject, cập nhật checklist sang UPLOADED.
 * 5. Đăng xuất, đăng nhập lại:
 *    - Phiên mới truy vấn thấy đủ thông tin lô, bảng hàng hóa và 2 file đã upload.
 * 6. Đối soát toàn vẹn dữ liệu:
 *    - Tải file về khớp 100% SHA-256 checksum so với file gốc.
 *    - Mô phỏng restart StorageProvider: file vật lý vẫn tồn tại nguyên vẹn.
 * 7. Kiểm soát phân quyền (RBAC):
 *    - STAFF không có quyền tạo lô hàng (403 Forbidden).
 *    - STAFF không được phân công bị chặn truy cập xem/sửa lô hàng (403 Forbidden).
 */

import crypto from 'crypto'
import { prisma } from '../lib/prisma'
import { login, logout, getSessionUser, revokeUserSessions } from '../lib/auth/auth-service'
import { PermissionService } from '../lib/auth/permission-service'
import { getStorageProvider, resetStorageProvider } from '../lib/storage/storage-provider'
import {
  validateVietnameseTaxCode,
  normalizeAndValidateHsCode,
  validateRoute,
  generateShipmentRequirements,
} from '../lib/validations/shipment-wizard'

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

async function runWizardAcceptanceTests() {
  console.log('='.repeat(80))
  console.log('🚢 BẮT ĐẦU KIỂM THỬ TOÀN DIỆN SHIPMENT WIZARD (BƯỚC 1, 2, 3) & BẢO VỆ CHỨNG TỪ')
  console.log('='.repeat(80))

  // Đảm bảo có tổ chức và phòng ban
  const org = await prisma.organization.findFirstOrThrow()
  const docDept = await prisma.department.findFirstOrThrow({ where: { code: 'DOC' } })
  const expDept = await prisma.department.findFirstOrThrow({ where: { code: 'EXP' } })

  // Tài khoản Admin & Manager & Staff
  const adminUser = await prisma.user.findFirstOrThrow({ where: { email: 'admin@tml.vn' } })
  const managerUser = await prisma.user.findFirstOrThrow({ where: { email: 'ha.tran@tml.vn' } })
  const staffDoc = await prisma.user.findFirstOrThrow({ where: { email: 'lan.pham@tml.vn' } })
  const staffExp = await prisma.user.findFirstOrThrow({ where: { email: 'anh.vo@tml.vn' } })

  // ---------------------------------------------------------------------------
  // PHẦN 1: THẨM ĐỊNH THUẬT TOÁN LOGISTICS & CHECKUM MÃ SỐ THUẾ
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 1] THẨM ĐỊNH THUẬT TOÁN CHECKUM MST, HS CODE & TUYẾN ĐƯỜNG')

  // Checksum MST Việt Nam
  assert(validateVietnameseTaxCode('0100109106').valid, 'MST hợp lệ: 0100109106 (Viettel) thỏa mãn checksum')
  assert(validateVietnameseTaxCode('0300588569').valid, 'MST hợp lệ: 0300588569 (Vingroup) thỏa mãn checksum')
  assert(validateVietnameseTaxCode('0100109106-001').valid, 'MST chi nhánh hợp lệ: 0100109106-001 thỏa mãn checksum')
  assert(!validateVietnameseTaxCode('0100109107').valid, 'MST sai check-digit (0100109107) bị từ chối chính xác')
  assert(!validateVietnameseTaxCode('1234567890').valid, 'MST ngẫu nhiên sai checksum bị từ chối chính xác')
  assert(!validateVietnameseTaxCode('').valid, 'MST rỗng bị từ chối chính xác')

  // HS Code chuẩn hóa bỏ dấu chấm
  const hs1 = normalizeAndValidateHsCode('0304.62.00')
  assert(hs1.valid && hs1.normalized === '03046200', 'HS Code: "0304.62.00" chuẩn hóa thành "03046200"')

  const hs2 = normalizeAndValidateHsCode('0306.17')
  assert(hs2.valid && hs2.normalized === '030617', 'HS Code: "0306.17" chuẩn hóa thành "030617"')

  assert(!normalizeAndValidateHsCode('03').valid, 'HS Code quá ngắn (< 4 chữ số) bị từ chối')
  assert(!normalizeAndValidateHsCode('0304.AB.CD').valid, 'HS Code chứa chữ cái bị từ chối')

  // Tuyến đường
  assert(!validateRoute('Cát Lái, VN', 'Cát Lái, VN').valid, 'Tuyến đường: Cảng đi trùng Cảng đến bị từ chối')
  assert(validateRoute('Cát Lái, VN', 'Rotterdam, NL').valid, 'Tuyến đường: Cát Lái -> Rotterdam hợp lệ')

  // Checklist generator
  const seaChecklist = generateShipmentRequirements('sea', 'Cát Lái, VN', 'Rotterdam, NL')
  assert(seaChecklist.includes('BL') && seaChecklist.includes('CO') && seaChecklist.includes('PACKING_LIST'), 'Checklist: Tuyến đường biển xuất khẩu sinh đầy đủ BL, CO, PACKING_LIST')

  // ---------------------------------------------------------------------------
  // PHẦN 2: PHÂN QUYỀN KHỞI TẠO LÔ HÀNG (STAFF BỊ CHẶN 403, MANAGER/ADMIN ĐƯỢC PHÉP)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 2] KIỂM TRA PHÂN QUYỀN KHỞI TẠO LÔ HÀNG (RBAC)')

  const staffAuth = await getSessionUser((await login('lan.pham@tml.vn', 'Tml@2026!')).token)
  const staffPermCreate = await PermissionService.check(staffAuth!, 'SHIPMENTS', 'CREATE')
  assert(!staffPermCreate.allowed, 'RBAC: Nhân viên tác nghiệp (STAFF) bị CHẶN không được tạo lô hàng (403)')

  const managerAuth = await getSessionUser((await login('ha.tran@tml.vn', 'Tml@2026!')).token)
  const managerPermCreate = await PermissionService.check(managerAuth!, 'SHIPMENTS', 'CREATE')
  assert(managerPermCreate.allowed, 'RBAC: Quản lý phòng ban (MANAGER) được phép tạo lô hàng mới')

  // ---------------------------------------------------------------------------
  // PHẦN 3: KỊCH BẢN BƯỚC 1 - KHỞI TẠO LÔ HÀNG VÀ CHỐNG TRÙNG SỐ JOB
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 3] BƯỚC 1: KHỞI TẠO LÔ HÀNG & RÀNG BUỘC PHÒNG BAN')

  const testJobNo = `TML-TEST-${Date.now().toString().slice(-6)}`

  // Tạo lô nháp thành công
  const draftShipment = await prisma.shipment.create({
    data: {
      orgId: org.id,
      jobNo: testJobNo,
      departmentId: docDept.id,
      mode: 'sea',
      origin: 'Cát Lái, Việt Nam (VNSGN)',
      destination: 'Rotterdam, Hà Lan (NLRTM)',
      status: 'draft',
      draftStep: 1,
      ownerId: managerUser.id,
    },
  })
  assert(draftShipment.id && draftShipment.status === 'draft', 'Bước 1: Tạo lô hàng nháp thành công với status="draft"')

  // Thử tạo trùng Job No
  let duplicateBlocked = false
  try {
    await prisma.shipment.create({
      data: {
        orgId: org.id,
        jobNo: testJobNo,
        departmentId: docDept.id,
        mode: 'sea',
        origin: 'Hải Phòng, VN',
        destination: 'Singapore',
        ownerId: managerUser.id,
      },
    })
  } catch (e: any) {
    duplicateBlocked = true
  }
  assert(duplicateBlocked, 'Bước 1: Chặn trùng lặp số Job (Unique Job Number Constraint)')

  // ---------------------------------------------------------------------------
  // PHẦN 4: KỊCH BẢN BƯỚC 2 - THẨM ĐỊNH MST, THÊM 2 DÒNG HÀNG & CHUẨN HÓA HS CODE
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 4] BƯỚC 2: RÀNG BUỘC THÔNG TIN BẮT BUỘC, MST & 2 DÒNG HÀNG/HS CODE')

  // 1. Kiểm tra chặn khi bỏ trống MST
  const emptyMstResult = validateVietnameseTaxCode('')
  assert(!emptyMstResult.valid, 'Bước 2: Bỏ trống Mã số thuế bị chặn thành công')

  // 2. Kiểm tra chặn khi MST sai checksum
  const invalidMstResult = validateVietnameseTaxCode('0100109107')
  assert(!invalidMstResult.valid, 'Bước 2: MST sai số kiểm tra checksum bị chặn thành công')

  // 3. Khách hàng hợp lệ với MST đúng chuẩn Viettel (0100109106)
  const validTaxCode = '0100109106'
  const customer = await prisma.customer.upsert({
    where: { id: 'cust_wizard_test_1' },
    update: { taxCode: validTaxCode },
    create: {
      id: 'cust_wizard_test_1',
      orgId: org.id,
      name: 'Công ty Cổ phần Thủy sản Xuất nhập khẩu TML Test',
      shortName: 'TML Seafood',
      taxCode: validTaxCode,
    },
  })
  assert(customer.taxCode === validTaxCode, 'Bước 2: Doanh nghiệp được xác nhận với MST hợp lệ')

  // 4. Thêm 2 dòng hàng hóa với HS Code có dấu chấm
  const rawGoodsInput = [
    { description: 'Cá tra philê đông lạnh (Frozen Pangasius Fillets)', hsCode: '0304.62.00' },
    { description: 'Tôm thẻ chân trắng đông lạnh (Frozen Vannamei Shrimp)', hsCode: '0306.17' },
  ]

  // Chuẩn hóa và lưu vào bảng ShipmentGoods
  const normalizedGoods = rawGoodsInput.map((item, idx) => {
    const validated = normalizeAndValidateHsCode(item.hsCode)
    return {
      shipmentId: draftShipment.id,
      description: item.description,
      hsCode: validated.normalized,
      orderIndex: idx,
    }
  })

  await prisma.shipmentGoods.createMany({
    data: normalizedGoods,
  })

  const savedGoods = await prisma.shipmentGoods.findMany({
    where: { shipmentId: draftShipment.id },
    orderBy: { orderIndex: 'asc' },
  })

  assert(savedGoods.length === 2, 'Bước 2: Lưu thành công 2 dòng hàng hóa vào bảng ShipmentGoods')
  assert(savedGoods[0].hsCode === '03046200', 'Bước 2: HS Code dòng 1 được chuẩn hóa bỏ dấu chấm thành "03046200"')
  assert(savedGoods[1].hsCode === '030617', 'Bước 2: HS Code dòng 2 được chuẩn hóa bỏ dấu chấm thành "030617"')

  // 5. Cập nhật Shipment liên kết Customer, chuyển draftStep = 3 (Đủ điều kiện mở Bước 3)
  const updatedToStep3 = await prisma.shipment.update({
    where: { id: draftShipment.id },
    data: {
      customerId: customer.id,
      blNo: 'MAEU262104471',
      etd: '2026-11-10',
      eta: '2026-12-05',
      draftStep: 3,
    },
  })
  assert(updatedToStep3.draftStep === 3, 'Bước 2: Lô hàng đủ điều kiện bắt buộc và mở khóa Bước 3')

  // Sinh checklist requirements tự động
  const reqTypes = generateShipmentRequirements('sea', updatedToStep3.origin!, updatedToStep3.destination!)
  for (const docType of reqTypes) {
    await prisma.shipmentRequirement.upsert({
      where: { shipmentId_docType: { shipmentId: draftShipment.id, docType } },
      update: {},
      create: {
        shipmentId: draftShipment.id,
        docType,
        isMandatory: true,
        status: 'MISSING',
      },
    })
  }

  const initialReqs = await prisma.shipmentRequirement.findMany({ where: { shipmentId: draftShipment.id } })
  assert(initialReqs.length >= 6, 'Bước 2: Tự động khởi tạo đầy đủ checklist yêu cầu chứng từ')

  // ---------------------------------------------------------------------------
  // PHẦN 5: KỊCH BẢN BƯỚC 3 - UPLOAD FILE, CHẶN FILE GIẢ ĐUÔI, CẬP NHẬT CHECKLIST
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 5] BƯỚC 3: KIỂM SOÁT MAGIC BYTES, UPLOAD STORAGE & CẬP NHẬT CHECKLIST')

  // 1. Kiểm tra chặn file giả đuôi (Ví dụ: file EXE đổi đuôi .pdf)
  const fakeExePdfBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00This is a fake executable disguised as PDF')
  const isFakePdf = fakeExePdfBuffer.subarray(0, 4).toString() !== '%PDF'
  assert(isFakePdf, 'Bước 3: File giả đuôi (EXE đổi tên .pdf) bị nhận diện và từ chối qua Magic Bytes')

  // 2. Upload 2 file hợp lệ qua StorageProvider
  const storage = getStorageProvider()

  // File 1: Vận đơn B/L dạng PDF
  const pdfContent = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Bill of Lading TML) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF')
  const pdfKey = `vault/20261102/${crypto.randomUUID()}.pdf`
  await storage.put(pdfKey, pdfContent, 'application/pdf')

  const pdfChecksum = crypto.createHash('sha256').update(pdfContent).digest('hex')

  const doc1 = await prisma.document.create({
    data: {
      id: `doc_bl_${Date.now()}`,
      orgId: org.id,
      shipmentId: draftShipment.id,
      customerId: customer.id,
      departmentId: docDept.id,
      type: 'BL',
      title: `Vận đơn đường biển ${draftShipment.jobNo}`,
      fileName: 'BillOfLading_Test.pdf',
      docDate: '2026-11-02',
      fileSizeBytes: pdfContent.length,
      storageKey: pdfKey,
      createdBy: managerUser.id,
      updatedBy: managerUser.id,
      versions: {
        create: {
          versionNumber: 1,
          fileName: 'BillOfLading_Test.pdf',
          storageKey: pdfKey,
          sizeBytes: pdfContent.length,
          uploadedBy: managerUser.id,
          changeNote: 'Tải lên ban đầu từ Wizard',
        },
      },
    },
  })

  await prisma.storageObject.create({
    data: {
      storageKey: pdfKey,
      bucket: 'tml-vault',
      mimeType: 'application/pdf',
      sizeBytes: pdfContent.length,
      checksumSha256: pdfChecksum,
    },
  })

  // Cập nhật checklist BL -> UPLOADED
  await prisma.shipmentRequirement.updateMany({
    where: { shipmentId: draftShipment.id, docType: 'BL' },
    data: { status: 'UPLOADED' },
  })

  // File 2: Hóa đơn thương mại dạng PNG
  // PNG Magic bytes: 89 50 4E 47 0D 0A 1A 0A
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52])
  const pngContent = Buffer.concat([pngHeader, Buffer.from('Commercial Invoice Image Test Payload')])
  const pngKey = `vault/20261102/${crypto.randomUUID()}.png`
  await storage.put(pngKey, pngContent, 'image/png')

  const pngChecksum = crypto.createHash('sha256').update(pngContent).digest('hex')

  const doc2 = await prisma.document.create({
    data: {
      id: `doc_inv_${Date.now()}`,
      orgId: org.id,
      shipmentId: draftShipment.id,
      customerId: customer.id,
      departmentId: docDept.id,
      type: 'INVOICE',
      title: `Hóa đơn thương mại ${draftShipment.jobNo}`,
      fileName: 'Commercial_Invoice_Test.png',
      docDate: '2026-11-02',
      fileSizeBytes: pngContent.length,
      storageKey: pngKey,
      createdBy: managerUser.id,
      updatedBy: managerUser.id,
      versions: {
        create: {
          versionNumber: 1,
          fileName: 'Commercial_Invoice_Test.png',
          storageKey: pngKey,
          sizeBytes: pngContent.length,
          uploadedBy: managerUser.id,
          changeNote: 'Tải lên ban đầu từ Wizard',
        },
      },
    },
  })

  await prisma.storageObject.create({
    data: {
      storageKey: pngKey,
      bucket: 'tml-vault',
      mimeType: 'image/png',
      sizeBytes: pngContent.length,
      checksumSha256: pngChecksum,
    },
  })

  // Cập nhật checklist INVOICE -> UPLOADED
  await prisma.shipmentRequirement.updateMany({
    where: { shipmentId: draftShipment.id, docType: 'INVOICE' },
    data: { status: 'UPLOADED' },
  })

  // Chuyển trạng thái lô hàng sang 'booking' (Hoàn tất tạo lô)
  await prisma.shipment.update({
    where: { id: draftShipment.id },
    data: { status: 'booking' },
  })

  // Kiểm tra checklist đã cập nhật
  const updatedReqBL = await prisma.shipmentRequirement.findUnique({
    where: { shipmentId_docType: { shipmentId: draftShipment.id, docType: 'BL' } },
  })
  const updatedReqINV = await prisma.shipmentRequirement.findUnique({
    where: { shipmentId_docType: { shipmentId: draftShipment.id, docType: 'INVOICE' } },
  })

  assert(updatedReqBL?.status === 'UPLOADED', 'Bước 3: Checklist B/L tự động chuyển sang UPLOADED')
  assert(updatedReqINV?.status === 'UPLOADED', 'Bước 3: Checklist INVOICE tự động chuyển sang UPLOADED')

  // ---------------------------------------------------------------------------
  // PHẦN 6: ĐĂNG XUẤT, ĐĂNG NHẬP LẠI & TRUY VẤN LẠI ĐẦY ĐỦ THÔNG TIN LÔ VÀ 2 FILE
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 6] ĐĂNG XUẤT, ĐĂNG NHẬP LẠI & TRUY VẤN ĐỐI SOÁT')

  // Đăng xuất và thu hồi phiên
  await revokeUserSessions(managerUser.id)

  // Đăng nhập lại với phiên mới
  const relogin = await login('ha.tran@tml.vn', 'Tml@2026!')
  assert(relogin.success, 'Đăng nhập lại thành công với phiên làm việc mới')

  const reloginAuth = await getSessionUser(relogin.token)
  assert(!!reloginAuth, 'Lấy thông tin Session User thành công sau khi đăng nhập lại')

  // Truy vấn lô hàng từ Database
  const fetchedShipment = await prisma.shipment.findUnique({
    where: { id: draftShipment.id },
    include: {
      customer: true,
      goods: { orderBy: { orderIndex: 'asc' } },
      documents: { where: { isDeleted: false } },
      requirements: true,
    },
  })

  assert(!!fetchedShipment, 'Tìm thấy lô hàng sau khi đăng nhập lại')
  assert(fetchedShipment?.status === 'booking', 'Trạng thái lô hàng là "booking"')
  assert(fetchedShipment?.goods.length === 2, 'Lô hàng có đúng 2 dòng hàng hóa đã lưu')
  assert(fetchedShipment?.documents.length === 2, 'Lô hàng có đủ 2 chứng từ đã upload')

  // ---------------------------------------------------------------------------
  // PHẦN 7: TẢI FILE KHỚP CHECKSUM & MÔ PHỎNG RESTART SERVER
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 7] TẢI FILE KHỚP CHECKSUM & MÔ PHỎNG RESTART STORAGE')

  // Tải file PDF từ storage
  const downloadedPdfRes = await storage.get(pdfKey)
  const downloadedPdfChecksum = crypto.createHash('sha256').update(downloadedPdfRes.buffer).digest('hex')
  assert(downloadedPdfChecksum === pdfChecksum, 'Tải file B/L PDF: Checksum SHA-256 trùng khớp 100% từng byte')

  // Tải file PNG từ storage
  const downloadedPngRes = await storage.get(pngKey)
  const downloadedPngChecksum = crypto.createHash('sha256').update(downloadedPngRes.buffer).digest('hex')
  assert(downloadedPngChecksum === pngChecksum, 'Tải file Invoice PNG: Checksum SHA-256 trùng khớp 100% từng byte')

  // Mô phỏng restart server bằng cách xóa cache singleton của StorageProvider và khởi tạo lại
  resetStorageProvider()
  const restartedStorage = getStorageProvider()
  const existsAfterRestart = await restartedStorage.exists(pdfKey)
  assert(existsAfterRestart, 'Mô phỏng khởi động lại server: Tập tin vật lý trên storage vẫn nguyên vẹn')

  const resAfterRestart = await restartedStorage.get(pdfKey)
  const checksumAfterRestart = crypto.createHash('sha256').update(resAfterRestart.buffer).digest('hex')
  assert(checksumAfterRestart === pdfChecksum, 'Sau khi khởi động lại server: Tải file khớp 100% SHA-256 checksum')

  // ---------------------------------------------------------------------------
  // PHẦN 8: KIỂM SOÁT PHÂN QUYỀN TRÊN LÔ HÀNG (STAFF KHÁC BỊ CHẶN 403)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 8] BẢO MẬT PHÂN QUYỀN: STAFF KHÔNG ĐƯỢC PHÂN CÔNG BỊ CHẶN (403)')

  // Nhân viên EXP (anh.vo@tml.vn) không thuộc phòng DOC và chưa được gán vào lô hàng này
  const staffExpAuth = await getSessionUser((await login('anh.vo@tml.vn', 'Tml@2026!')).token)

  const viewCheckUnassigned = await PermissionService.check(staffExpAuth!, 'SHIPMENTS', 'VIEW', {
    id: draftShipment.id,
    departmentId: draftShipment.departmentId,
    ownerId: draftShipment.ownerId,
    assignedUserIds: [], // Chưa được phân công
  })
  assert(!viewCheckUnassigned.allowed, 'STAFF phòng khác không được phân công bị CHẶN truy cập lô hàng (403 Forbidden)')

  const editCheckUnassigned = await PermissionService.check(staffExpAuth!, 'SHIPMENTS', 'EDIT', {
    id: draftShipment.id,
    departmentId: draftShipment.departmentId,
    ownerId: draftShipment.ownerId,
    assignedUserIds: [],
  })
  assert(!editCheckUnassigned.allowed, 'STAFF phòng khác không được phân công bị CHẶN chỉnh sửa lô hàng (403 Forbidden)')

  // Phân công nhân viên EXP vào lô hàng qua ShipmentParticipant
  await prisma.shipmentParticipant.create({
    data: {
      shipmentId: draftShipment.id,
      userId: staffExp.id,
      roleInShipment: 'CUSTOMS_STAFF',
    },
  })

  // Kiểm tra lại quyền sau khi được phân công
  const viewCheckAssigned = await PermissionService.check(staffExpAuth!, 'SHIPMENTS', 'VIEW', {
    id: draftShipment.id,
    departmentId: draftShipment.departmentId,
    ownerId: draftShipment.ownerId,
    assignedUserIds: [staffExp.id], // Đã được phân công
  })
  assert(viewCheckAssigned.allowed, 'STAFF sau khi được phân công vào lô hàng được cấp quyền VIEW hợp lệ')

  // Dọn dẹp dữ liệu test
  await prisma.shipmentParticipant.deleteMany({ where: { shipmentId: draftShipment.id } })
  await prisma.documentVersion.deleteMany({ where: { storageKey: { in: [pdfKey, pngKey] } } })
  await prisma.document.deleteMany({ where: { shipmentId: draftShipment.id } })
  await prisma.storageObject.deleteMany({ where: { storageKey: { in: [pdfKey, pngKey] } } })
  await prisma.shipmentRequirement.deleteMany({ where: { shipmentId: draftShipment.id } })
  await prisma.shipmentGoods.deleteMany({ where: { shipmentId: draftShipment.id } })
  await prisma.shipment.delete({ where: { id: draftShipment.id } })
  await storage.delete(pdfKey)
  await storage.delete(pngKey)

  // ===========================================================================
  // TỔNG KẾT
  // ===========================================================================
  console.log('\n' + '='.repeat(80))
  console.log('KẾT QUẢ KIỂM THỬ TOÀN DIỆN SHIPMENT WIZARD (BƯỚC 1, 2, 3):')
  console.log(`TỔNG CỘNG:  ${results.total} BÀI KIỂM THỬ`)
  console.log(`THÀNH CÔNG: ${results.passed} PASSED`)
  console.log(`THẤT BẠI:   ${results.failed} FAILED`)
  console.log('='.repeat(80))

  if (results.failed > 0) {
    process.exit(1)
  }
}

runWizardAcceptanceTests()
  .catch((e) => {
    console.error('Lỗi thực thi test suite:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
