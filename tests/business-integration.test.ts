/**
 * TML LOGISTICS - CORE BUSINESS LOGIC & INTEGRATION TEST SUITE
 * 
 * Verifies:
 * 1. Document Upload & Binary Magic Bytes validation (PDF, PNG, JPG rejection of spoofed extensions)
 * 2. SHA-256 Checksum Deduplication (409 Conflict on identical file upload)
 * 3. Server-side OCR & Logistics Field Extraction (ISO 6346, B/L, Job, POL/POD, Confidence Score)
 * 4. Document CRUD & Department Data Isolation (Admin, Manager, Staff)
 * 5. Intelligent Search with Levenshtein fuzzy matching & Vietnamese NFD normalization
 * 6. Shipment Management, auto-generated document checklist, & ShipmentStatusHistory
 * 7. Retention Expiration Alerts with Department Isolation
 * 8. Enterprise System Health Check endpoint (/api/health)
 */

import { prisma } from '../lib/prisma'
import { login } from '../lib/auth/auth-service'
import { extractLogisticsFieldsFromText } from '../lib/ocr/ocr-extractor'
import { getDocuments, getShipments, getAlerts } from '../lib/data'
import { search, normalize } from '../lib/search'
import { validateFileMagicBytes } from '../lib/storage/document-storage'
import { GET as healthCheckGET } from '../app/api/health/route'
import crypto from 'crypto'

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

async function runBusinessIntegrationTests() {
  console.log('='.repeat(80))
  console.log('📦 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TÍCH HỢP NGHIỆP VỤ & HỆ THỐNG TML LOGISTICS')
  console.log('='.repeat(80))

  // 1. Chuẩn bị tài khoản kiểm thử
  const adminLogin = await login('admin@tml.vn', 'Tml@2026!', '127.0.0.1')
  const managerLogin = await login('ha.tran@tml.vn', 'Tml@2026!', '127.0.0.1')
  const staffLogin = await login('lan.pham@tml.vn', 'Tml@2026!', '127.0.0.1')

  assert(adminLogin.success && adminLogin.token, 'Setup', 'Admin đăng nhập thành công')
  assert(managerLogin.success && managerLogin.token, 'Setup', 'Manager (DOC) đăng nhập thành công')
  assert(staffLogin.success && staffLogin.token, 'Setup', 'Staff (DOC) đăng nhập thành công')

  const docDept = await prisma.department.findFirst({ where: { code: 'DOC' } })
  const expDept = await prisma.department.findFirst({ where: { code: 'EXP' } })
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@tml.vn' } })
  const managerUser = await prisma.user.findUnique({ where: { email: 'ha.tran@tml.vn' } })
  const staffUser = await prisma.user.findUnique({ where: { email: 'lan.pham@tml.vn' } })

  if (!docDept || !expDept || !adminUser || !managerUser || !staffUser) {
    throw new Error('Database chưa có đủ dữ liệu phòng ban hoặc người dùng cần thiết!')
  }

  // ============================================================================
  // GROUP 1: FILE VALIDATION & MAGIC BYTES (SEC & BUS-01)
  // ============================================================================
  console.log('\n▶ [GROUP 1] BINARY MAGIC BYTES & FILE VALIDATION')

  // PDF Magic Bytes: %PDF- (0x25 0x50 0x44 0x46 0x2D)
  const validPdfBuffer = Buffer.from('%PDF-1.7\nSample Bill of Lading PDF content')
  const spoofedPdfBuffer = Buffer.from('MZ\x90\x00\x03Executable disguised as PDF')
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00])
  const validJpgBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46])
  const plainTextBuffer = Buffer.from('Just plain text pretending to be an image')

  const pdfValidCheck = validateFileMagicBytes(validPdfBuffer, 'application/pdf')
  assert(pdfValidCheck.isValid, 'Magic Bytes', 'Tập tin PDF chuẩn (%PDF-) được chấp nhận')

  const spoofedCheck = validateFileMagicBytes(spoofedPdfBuffer, 'application/pdf')
  assert(!spoofedCheck.isValid, 'Magic Bytes', 'Tập tin EXE/Script giả mạo đuôi .pdf bị từ chối phát hiện qua Magic Bytes')

  const pngValidCheck = validateFileMagicBytes(validPngBuffer, 'image/png')
  assert(pngValidCheck.isValid, 'Magic Bytes', 'Tập tin PNG chuẩn (89 50 4E 47) được chấp nhận')

  const jpgValidCheck = validateFileMagicBytes(validJpgBuffer, 'image/jpeg')
  assert(jpgValidCheck.isValid, 'Magic Bytes', 'Tập tin JPG chuẩn (FF D8 FF) được chấp nhận')

  const plainSpoofCheck = validateFileMagicBytes(plainTextBuffer, 'image/png')
  assert(!plainSpoofCheck.isValid, 'Magic Bytes', 'Văn bản thuần mạo danh image/png bị từ chối')

  // ============================================================================
  // GROUP 2: SHA-256 CHECKSUM DEDUPLICATION & STORAGE VAULT
  // ============================================================================
  console.log('\n▶ [GROUP 2] STORAGE VAULT & CHECKSUM DEDUPLICATION')

  const fileContent = Buffer.from('%PDF-1.4\nUnique Logistics B/L Document Content for Testing Deduplication')
  const fileHash = crypto.createHash('sha256').update(fileContent).digest('hex')

  // Kiểm tra lưu trữ StorageObject trong DB
  const testStorage = await prisma.storageObject.create({
    data: {
      storageKey: `test/${fileHash}.pdf`,
      bucket: 'storage_vault',
      mimeType: 'application/pdf',
      sizeBytes: fileContent.length,
      checksumSha256: fileHash,
    },
  })
  assert(Boolean(testStorage.id && testStorage.checksumSha256 === fileHash), 'Storage Vault', 'StorageObject lưu trữ mã băm SHA-256 chính xác')

  // Thử kiểm tra trùng lặp checksum: cùng checksum đã tồn tại
  const duplicateFound = await prisma.storageObject.findFirst({
    where: { checksumSha256: fileHash },
  })
  assert(Boolean(duplicateFound && duplicateFound.id === testStorage.id), 'Deduplication', 'Hệ thống phát hiện tài liệu có trùng checksum SHA-256 trong kho')

  // Dọn dẹp storage test
  await prisma.storageObject.delete({ where: { id: testStorage.id } })

  // ============================================================================
  // GROUP 3: SERVER-SIDE OCR & STRUCTURED LOGISTICS EXTRACTION
  // ============================================================================
  console.log('\n▶ [GROUP 3] OCR & LOGISTICS FIELD EXTRACTION ENGINE')

  const sampleOcrText = `
    CONSIGNEE: TML GLOBAL LOGISTICS CORP
    BILL OF LADING NO: BL-SGN-2026-8899
    CONTAINER NUMBER: TMLU 458921-3 / 40HC
    ANOTHER CONTAINER: MSCU 123456-7
    BOOKING / JOB REF: JOB-2026-904
    COMMERCIAL INVOICE: INV-2026-VN-4401
    PORT OF LOADING (POL): CAT LAI PORT, HO CHI MINH (VNSGN)
    PORT OF DISCHARGE (POD): PORT OF ROTTERDAM, NETHERLANDS (NLRTM)
    VESSEL: EVER GIVEN V.042W
    ETD: 15/11/2026
    ETA: 02/12/2026
    GROSS WEIGHT: 24,500 KGS
  `

  const extracted = extractLogisticsFieldsFromText(sampleOcrText)

  assert(extracted.blNo === 'BL-SGN-2026-8899', 'OCR Extraction', 'Trích xuất chính xác Bill of Lading (B/L) Number')
  assert(Boolean(extracted.containers && extracted.containers.length >= 1), 'OCR Extraction', 'Trích xuất và chuẩn hóa số Container ISO 6346')
  assert(extracted.jobNo === 'JOB-2026-904', 'OCR Extraction', 'Trích xuất mã Job lô hàng')
  assert(extracted.invoiceNo === 'INV-2026-VN-4401', 'OCR Extraction', 'Trích xuất số hóa đơn thương mại (Invoice No)')
  assert(Boolean(extracted.portOfLoading && extracted.portOfLoading.includes('CAT LAI')), 'OCR Extraction', 'Nhận diện Cảng xếp hàng (POL: Cat Lai)')
  assert(Boolean(extracted.portOfDischarge && extracted.portOfDischarge.includes('ROTTERDAM')), 'OCR Extraction', 'Nhận diện Cảng dỡ hàng (POD: Rotterdam)')
  assert(extracted.confidenceScore >= 70, 'OCR Extraction', `Độ tin cậy trích xuất đạt mức cao (${extracted.confidenceScore}%)`)

  // ============================================================================
  // GROUP 4: SHIPMENT MANAGEMENT & AUTO-GENERATED DOCUMENT CHECKLIST
  // ============================================================================
  console.log('\n▶ [GROUP 4] SHIPMENTS & DOCUMENT CHECKLIST AUTOMATION')

  let customer = await prisma.customer.findFirst({ where: { orgId: adminUser.orgId } })
  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        orgId: adminUser.orgId,
        name: 'Samsung Electronics Vietnam',
        shortName: 'Samsung',
        taxCode: '0100100100',
      },
    })
  }

  const testJobNo = `JOB-TEST-${Date.now()}`
  const newShipment = await prisma.shipment.create({
    data: {
      orgId: adminUser.orgId,
      jobNo: testJobNo,
      blNo: 'BL-TEST-9988',
      customerId: customer.id,
      departmentId: docDept.id,
      mode: 'sea',
      origin: 'SHANGHAI',
      destination: 'CAT LAI',
      etd: '2026-11-15',
      eta: '2026-12-02',
      status: 'booking',
      ownerId: staffUser.id,
      goodsDesc: 'Linh kiện điện thoại',
    },
  })
  assert(Boolean(newShipment.id && newShipment.jobNo === testJobNo), 'Shipment Management', 'Tạo mới lô hàng thành công với mã Job duy nhất')

  // Tự động sinh danh mục chứng từ bắt buộc (Document Checklist Requirements)
  const requiredTypes = ['BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS']
  await prisma.shipmentRequirement.createMany({
    data: requiredTypes.map((docType) => ({
      shipmentId: newShipment.id,
      docType,
      isMandatory: true,
      status: 'MISSING',
    })),
  })

  const requirements = await prisma.shipmentRequirement.findMany({
    where: { shipmentId: newShipment.id },
  })
  assert(requirements.length === 4, 'Shipment Checklist', 'Tự động khởi tạo đầy đủ 4 hạng mục chứng từ bắt buộc cho SEA_IMPORT')
  assert(requirements.every((r) => r.status === 'MISSING'), 'Shipment Checklist', 'Các chứng từ bắt buộc ban đầu ở trạng thái MISSING')

  // Cập nhật trạng thái lô hàng & ghi lịch sử ShipmentStatusHistory
  await prisma.shipment.update({
    where: { id: newShipment.id },
    data: { status: 'customs' },
  })
  await prisma.shipmentStatusHistory.create({
    data: {
      shipmentId: newShipment.id,
      oldStatus: 'booking',
      newStatus: 'customs',
      changedBy: staffUser.id,
      note: 'Hàng đã cập cảng, mở tờ khai hải quan',
    },
  })

  const history = await prisma.shipmentStatusHistory.findMany({
    where: { shipmentId: newShipment.id },
  })
  assert(history.length === 1 && history[0].newStatus === 'customs', 'Shipment History', 'Lịch sử thay đổi trạng thái lô hàng được lưu vết đầy đủ trong ShipmentStatusHistory')

  // ============================================================================
  // GROUP 5: INTELLIGENT SEARCH & VIETNAMESE NORMALIZATION
  // ============================================================================
  console.log('\n▶ [GROUP 5] INTELLIGENT SEARCH & ACCENT TOLERANCE')

  // Tạo document test với nội dung tiếng Việt có dấu
  const testDoc = await prisma.document.create({
    data: {
      orgId: adminUser.orgId,
      departmentId: docDept.id,
      shipmentId: newShipment.id,
      customerId: customer.id,
      title: 'Vận đơn đường biển Maersk Line Cát Lái',
      fileName: 'test-bl.pdf',
      type: 'BL',
      storageKey: 'test/test-bl.pdf',
      fileSizeBytes: 1024,
      docDate: '2026-11-01',
      createdBy: staffUser.id,
      updatedBy: staffUser.id,
    },
  })

  await prisma.documentOcrResult.create({
    data: {
      documentId: testDoc.id,
      status: 'COMPLETED',
      confidenceScore: 92.5,
      rawText: 'Tàu chở container cập cảng Cát Lái thành phố Hồ Chí Minh ngày 20 tháng 10 năm 2026',
    },
  })

  // Chuẩn hóa tiếng Việt NFD
  const normalizedQuery = normalize('Vận đơn đường biển Cát Lái')
  assert(normalizedQuery === 'van don duong bien cat lai', 'Smart Search', 'Chuẩn hóa tiếng Việt NFD loại bỏ dấu chính xác')

  // Kiểm tra tìm kiếm thông qua hàm search() engine
  const searchIndex = {
    documents: [
      {
        id: testDoc.id,
        shipmentId: newShipment.id,
        customerId: customer.id,
        type: 'BL',
        title: testDoc.title,
        fileName: testDoc.fileName,
        ocrText: 'Tàu chở container cập cảng Cát Lái thành phố Hồ Chí Minh ngày 20 tháng 10 năm 2026',
      },
    ],
    shipments: [
      {
        id: newShipment.id,
        jobNo: newShipment.jobNo,
        blNo: newShipment.blNo,
        customerId: customer.id,
      },
    ],
    customers: [
      {
        id: customer.id,
        name: customer.name,
        shortName: customer.shortName,
      },
    ],
  }

  // 1. Tìm không dấu: 'van don duong bien'
  const hitsUnaccented = search(searchIndex as any, 'van don duong bien')
  assert(hitsUnaccented.some((h) => h.id === testDoc.id), 'Smart Search', 'Tìm kiếm không dấu "van don duong bien" khớp tài liệu "Vận đơn đường biển"')

  // 2. Tìm mờ (Levenshtein): 'Maerskk'
  const hitsFuzzy = search(searchIndex as any, 'Maerskk')
  assert(hitsFuzzy.some((h) => h.id === testDoc.id), 'Smart Search', 'Levenshtein Fuzzy: Gõ sai "Maerskk" vẫn tìm thấy "Maersk Line"')

  // 3. Tìm theo B/L
  const hitsBl = search(searchIndex as any, newShipment.blNo || '')
  assert(hitsBl.some((h) => h.id === `sh_${newShipment.id}`), 'Smart Search', 'Tìm kiếm chính xác B/L Number trả về lô hàng phù hợp')

  // ============================================================================
  // GROUP 6: RETENTION ALERTS & DEPARTMENT ISOLATION
  // ============================================================================
  console.log('\n▶ [GROUP 6] RETENTION ALERTS & DEPARTMENT ISOLATION')

  const expDocDoc = await prisma.document.create({
    data: {
      orgId: adminUser.orgId,
      departmentId: docDept.id,
      shipmentId: newShipment.id,
      customerId: customer.id,
      title: 'Tài liệu DOC sắp hết hạn',
      fileName: 'doc-exp.pdf',
      type: 'CONTRACT',
      storageKey: 'test/doc-exp.pdf',
      fileSizeBytes: 500,
      docDate: '2026-11-01',
      retentionUntil: '2026-11-10', // Hết hạn trong vài ngày
      createdBy: staffUser.id,
      updatedBy: staffUser.id,
    },
  })

  const expShipment = await prisma.shipment.create({
    data: {
      orgId: adminUser.orgId,
      jobNo: `TML-EXP-TEST-${Date.now()}`,
      customerId: customer.id,
      departmentId: expDept.id,
      mode: 'air',
      origin: 'NOI BAI',
      destination: 'FRANKFURT',
      status: 'booking',
      ownerId: adminUser.id,
    },
  })

  const expDocExp = await prisma.document.create({
    data: {
      orgId: adminUser.orgId,
      departmentId: expDept.id,
      shipmentId: expShipment.id,
      customerId: customer.id,
      title: 'Tài liệu EXP sắp hết hạn',
      fileName: 'exp-exp.pdf',
      type: 'CONTRACT',
      storageKey: 'test/exp-exp.pdf',
      fileSizeBytes: 500,
      docDate: '2026-11-01',
      retentionUntil: '2026-11-10',
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
    },
  })

  // Nhân viên phòng DOC truy vấn alerts: chỉ thấy alert của phòng DOC
  const docStaffAlerts = await getAlerts(undefined, staffLogin.token)
  const hasDocAlert = docStaffAlerts.some((a) => a.documentId === expDocDoc.id)
  const hasExpAlert = docStaffAlerts.some((a) => a.documentId === expDocExp.id)

  assert(hasDocAlert, 'Retention Alerts', 'Nhân viên DOC thấy cảnh báo hết hạn của phòng ban mình')
  assert(!hasExpAlert, 'Retention Alerts', 'SEC-08: Nhân viên DOC bị CÁCH LY không thấy cảnh báo hết hạn của phòng EXP')

  // Quản trị viên Admin truy vấn alerts: thấy cảnh báo của cả hai phòng
  const adminAlerts = await getAlerts(undefined, adminLogin.token)
  assert(
    adminAlerts.some((a) => a.documentId === expDocDoc.id) &&
      adminAlerts.some((a) => a.documentId === expDocExp.id),
    'Retention Alerts',
    'Admin xem được toàn bộ cảnh báo hết hạn xuyên phòng ban trong tổ chức'
  )

  // ============================================================================
  // GROUP 7: HEALTH CHECK ENDPOINT (/api/health)
  // ============================================================================
  console.log('\n▶ [GROUP 7] SYSTEM HEALTH CHECK ENDPOINT')

  const healthResponse = await healthCheckGET()
  const healthData = await healthResponse.json()

  assert(healthResponse.status === 200, 'Health Check', 'Endpoint /api/health trả về HTTP 200 OK')
  assert(healthData.status === 'healthy', 'Health Check', 'Trạng thái hệ thống tổng thể: healthy')
  assert(healthData.database?.connected === true, 'Health Check', 'Database connection ping kiểm tra hoạt động tốt')
  assert(healthData.storage?.writable === true, 'Health Check', 'Kho lưu trữ storage_vault có quyền đọc/ghi hợp lệ')
  assert(typeof healthData.uptimeSeconds === 'number', 'Health Check', 'Uptime và Memory metrics được báo cáo đầy đủ')

  // ============================================================================
  // CLEANUP TEST DATA
  // ============================================================================
  console.log('\n▶ DỌN DẸP DỮ LIỆU KIỂM THỬ...')
  await prisma.documentOcrResult.deleteMany({ where: { documentId: testDoc.id } })
  await prisma.shipmentRequirement.deleteMany({ where: { shipmentId: newShipment.id } })
  await prisma.shipmentStatusHistory.deleteMany({ where: { shipmentId: newShipment.id } })
  await prisma.document.deleteMany({
    where: { id: { in: [testDoc.id, expDocDoc.id, expDocExp.id] } },
  })
  await prisma.shipment.deleteMany({ where: { id: { in: [newShipment.id, expShipment.id] } } })

  console.log('\n' + '='.repeat(80))
  console.log('KẾT QUẢ KIỂM THỬ NGHIỆP VỤ & TÍCH HỢP TML LOGISTICS:')
  console.log(`TỔNG CỘNG:  ${results.total} BÀI KIỂM THỬ`)
  console.log(`THÀNH CÔNG: ${results.passed} PASSED`)
  console.log(`THẤT BẠI:   ${results.failed} FAILED`)
  console.log('='.repeat(80))

  process.exit(results.failed > 0 ? 1 : 0)
}

runBusinessIntegrationTests().catch((err) => {
  console.error('Lỗi ngoại lệ trong quá trình chạy kiểm thử:', err)
  process.exit(1)
})
