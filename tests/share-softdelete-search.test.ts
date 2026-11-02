import assert from 'assert'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { getStorageProvider } from '@/lib/storage/storage-provider'
import { GET as getShareContent } from '@/app/api/s/[token]/content/route'
import { GET as getShareDownload } from '@/app/api/s/[token]/download/route'
import { GET as getShareFile } from '@/app/api/s/[token]/file/route'
import { POST as verifyShare } from '@/app/api/s/[token]/verify/route'
import { login, getSessionUser } from '@/lib/auth/auth-service'
import { dbSearch } from '@/lib/search'

async function runAcceptanceTests() {
  console.log('\n================================================================================')
  console.log('🔗 KIỂM THỬ NGHIỆM THU: LINK CHIA SẺ VỚI FILE ĐÃ XÓA MỀM & TÌM KIẾM CSDL')
  console.log('================================================================================')

  const org = await prisma.organization.findFirstOrThrow()
  const deptDoc = await prisma.department.findFirstOrThrow({ where: { code: 'DOC' } })
  const customer = await prisma.customer.findFirstOrThrow()
  const adminUser = await prisma.user.findFirstOrThrow({ where: { roleCode: 'ADMIN' } })
  const staffUser = await prisma.user.findFirstOrThrow({ where: { roleCode: 'STAFF', departments: { some: { departmentId: deptDoc.id } } } })

  const storage = getStorageProvider()
  const testPdfContent = Buffer.from('%PDF-1.4 TEST ACCEPTANCE PDF CONTENT %%EOF')
  const storageKey = `test_softdelete_${Date.now()}.pdf`
  await storage.put(storageKey, testPdfContent, 'application/pdf')

  await prisma.storageObject.create({
    data: {
      storageKey,
      bucket: 'test-bucket',
      mimeType: 'application/pdf',
      sizeBytes: testPdfContent.length,
      checksumSha256: crypto.createHash('sha256').update(testPdfContent).digest('hex'),
    },
  })

  const shipment = await prisma.shipment.create({
    data: {
      orgId: org.id,
      departmentId: deptDoc.id,
      customerId: customer.id,
      jobNo: `JOB-TEST-${Date.now().toString().slice(-6)}`,
      blNo: `BL-TEST-${Date.now().toString().slice(-6)}`,
      mode: 'sea',
      origin: 'VNSGN',
      destination: 'USLAX',
      status: 'booking',
      ownerId: adminUser.id,
    },
  })

  const document = await prisma.document.create({
    data: {
      orgId: adminUser.orgId,
      departmentId: deptDoc.id,
      customerId: customer.id,
      shipmentId: shipment.id,
      title: 'Vận đơn kiểm thử nghiệm thu',
      type: 'BILL_OF_LADING',
      fileName: 'test-doc.pdf',
      docDate: '2026-11-02',
      storageKey,
      fileSizeBytes: testPdfContent.length,
      pages: 1,
      isDeleted: false,
      createdBy: adminUser.id,
      updatedBy: adminUser.id,
      ocrResults: {
        create: {
          rawText: 'CONTAINER NUMBER TMLU999888123 VESSEL MAERSK TAIPEI SPECIAL ACCEPTANCE KEYWORD',
          confidenceScore: 0.98,
        },
      },
    },
  })

  const shareToken = `share_test_${Date.now()}`
  const share = await prisma.documentShare.create({
    data: {
      documentId: document.id,
      token: shareToken,
      createdBy: adminUser.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      allowDownload: true,
    },
  })

  // ---------------------------------------------------------------------------
  // PHẦN 1: TÀI LIỆU CÒN HOẠT ĐỘNG -> TRUY CẬP HỢP LỆ
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 1] TÀI LIỆU HOẠT ĐỘNG: TRUY CẬP XEM VÀ TẢI THÀNH CÔNG (200)')
  {
    const req = new Request(`http://localhost:3000/api/s/${shareToken}/content`)
    const res = await getShareContent(req, { params: Promise.resolve({ token: shareToken }) })
    assert.strictEqual(res.status, 200, 'Content trả về 200 khi tài liệu chưa xóa')

    const fileReq = new Request(`http://localhost:3000/api/s/${shareToken}/file`)
    const fileRes = await getShareFile(fileReq, { params: Promise.resolve({ token: shareToken }) })
    assert.strictEqual(fileRes.status, 200, 'File view trực tiếp trả về 200')
    assert.ok(fileRes.headers.get('content-disposition')?.includes('inline'), 'Header Content-Disposition phải là inline')
    assert.strictEqual(fileRes.headers.get('content-type'), 'application/pdf', 'Content-Type phải là application/pdf')

    console.log('  ✅ [PASS] Xem nội dung và xem trực tiếp file thật trả về HTTP 200 với header inline')
  }

  // ---------------------------------------------------------------------------
  // PHẦN 2: TÀI LIỆU BỊ XÓA MỀM (isDeleted: true) -> TẤT CẢ LINK TRẢ VỀ 404
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 2] TÀI LIỆU BỊ XÓA MỀM (isDeleted: true): LINK CŨ BỊ CHẶN TUYỆT ĐỐI (404 NOT FOUND)')
  {
    await prisma.document.update({
      where: { id: document.id },
      data: { isDeleted: true, deletedAt: new Date() },
    })

    // 1. Verify link
    const verifyReq = new Request(`http://localhost:3000/api/s/${shareToken}/verify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    const verifyRes = await verifyShare(verifyReq, { params: Promise.resolve({ token: shareToken }) })
    assert.strictEqual(verifyRes.status, 404, 'Verify phải trả về 404 khi tài liệu bị xóa mềm')

    // 2. Content link
    const contentReq = new Request(`http://localhost:3000/api/s/${shareToken}/content`)
    const contentRes = await getShareContent(contentReq, { params: Promise.resolve({ token: shareToken }) })
    assert.strictEqual(contentRes.status, 404, 'Content phải trả về 404 khi tài liệu bị xóa mềm')

    // 3. Download link
    const downloadReq = new Request(`http://localhost:3000/api/s/${shareToken}/download`)
    const downloadRes = await getShareDownload(downloadReq, { params: Promise.resolve({ token: shareToken }) })
    assert.strictEqual(downloadRes.status, 404, 'Download phải trả về 404 khi tài liệu bị xóa mềm')

    // 4. File direct view link
    const fileReq = new Request(`http://localhost:3000/api/s/${shareToken}/file`)
    const fileRes = await getShareFile(fileReq, { params: Promise.resolve({ token: shareToken }) })
    assert.strictEqual(fileRes.status, 404, 'File view trực tiếp phải trả về 404 khi tài liệu bị xóa mềm')

    console.log('  ✅ [PASS] Toàn bộ endpoint công khai (verify, content, download, file) đều trả về 404 khi tài liệu bị xóa mềm')
  }

  // ---------------------------------------------------------------------------
  // PHẦN 3: TÌM KIẾM TRỰC TIẾP TRÊN DATABASE (dbSearch) VÀ PHÂN TRANG
  // ---------------------------------------------------------------------------
  console.log('\n▶ [PHẦN 3] TÌM KIẾM CƠ SỞ DỮ LIỆU CÓ PHÂN TRANG & KHÔNG NẠP DỮ LIỆU VÀO RAM')
  {
    // Khôi phục tài liệu để tìm kiếm
    await prisma.document.update({
      where: { id: document.id },
      data: { isDeleted: false, deletedAt: null },
    })

    const loginRes = await login('admin@tml.vn', 'Tml@2026!')
    const authAdmin = await getSessionUser(loginRes.token)
    assert.ok(authAdmin, 'Phải lấy được session của Admin')

    // 1. Tìm theo JobNo
    const resJob = await dbSearch(authAdmin, { query: shipment.jobNo, scope: 'job' })
    assert.ok(resJob.hits.some((h) => h.id === `sh_${shipment.id}`), 'Phải tìm thấy shipment theo jobNo')

    // 2. Tìm theo BillNo
    const resBill = await dbSearch(authAdmin, { query: shipment.blNo || '', scope: 'bill' })
    assert.ok(resBill.hits.some((h) => h.id === `sh_${shipment.id}` || h.id === document.id), 'Phải tìm thấy theo blNo')

    // 3. Tìm theo nội dung văn bản OCR
    const resOcr = await dbSearch(authAdmin, { query: 'SPECIAL ACCEPTANCE KEYWORD', scope: 'content' })
    assert.ok(resOcr.hits.some((h) => h.id === document.id), 'Phải tìm thấy tài liệu theo từ khóa OCR')
    const matchedDoc = resOcr.hits.find((h) => h.id === document.id)
    assert.ok(matchedDoc?.snippet, 'Kết quả tìm theo OCR phải có trích đoạn snippet')

    // 4. Kiểm tra phân trang: page 1 limit 1
    const resPaging = await dbSearch(authAdmin, { query: shipment.jobNo, scope: 'all', page: 1, limit: 1 })
    assert.strictEqual(resPaging.limit, 1, 'Limit trả về phải đúng 1')
    assert.strictEqual(resPaging.hits.length, 1, 'Số lượng phần tử trả về trang 1 phải bằng 1')
    assert.ok(resPaging.total >= 1, 'Tổng số phần tử phải >= 1')

    console.log('  ✅ [PASS] dbSearch tìm chính xác qua Job, Bill, Nội dung OCR và phân trang chuẩn xác')
  }

  // Dọn dẹp dữ liệu test
  await prisma.documentShare.delete({ where: { id: share.id } })
  await prisma.documentOcrResult.deleteMany({ where: { documentId: document.id } })
  await prisma.document.delete({ where: { id: document.id } })
  await prisma.shipment.delete({ where: { id: shipment.id } })
  await storage.delete(storageKey)
  await prisma.storageObject.deleteMany({ where: { storageKey } })

  console.log('\n================================================================================')
  console.log('TỔNG HỢP KIỂM THỬ: TẤT CẢ CÁC MỤC NGHIỆM THU ĐỀU ĐẠT 100% PASS!')
  console.log('================================================================================\n')
}

runAcceptanceTests()
  .catch((e) => {
    console.error('❌ Lỗi kiểm thử nghiệm thu:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
