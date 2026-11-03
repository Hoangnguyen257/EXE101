/**
 * TESTS: PDF OCR TEXT RECOGNITION & FORMAT PRESERVATION
 * TML - Text Mining Library
 * 
 * Kiểm thử toàn diện:
 * 1. Trích xuất text từ tập tin PDF với độ chính xác cao và BẢO TOÀN NGUYÊN VẸN BỐ CỤC:
 *    - Ngắt dòng chính xác (\n) giữa các dòng và các khối địa chỉ Shipper, Consignee
 *    - Phân tách cột bảng biểu (Container, Seal, Packages, Description, Weight, CBM)
 *    - Căn chỉnh các trường Key-Value logistics
 * 2. Khôi phục bảng mã tiếng Việt (mojibake) từ font đơn byte sang UTF-8 chuẩn
 * 3. Sinh mã HTML có cấu trúc cho trình soạn thảo TipTap (Document.editedHtml)
 * 4. Kiểm tra trích xuất OCR bất đồng bộ (extractTextFromBufferAsync) cho PDF và ảnh
 * 5. Lưu trữ đầy đủ rawText định dạng chuẩn và structuredData trong DocumentOcrResult
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import {
  extractTextFromPdf,
  extractTextFromPdfWithLayout,
  extractTextFromBufferAsync,
  extractTextFromBuffer,
  extractLogisticsFields,
  normalizeLogisticsText,
  generateStructuredDocumentHtml,
} from '../lib/ocr/ocr-extractor'
import {
  validateComprehensiveUpload,
  validateFileMagicBytes,
} from '../lib/storage/document-storage'

// Hàm sinh PDF chuẩn với cấu trúc đa dòng, bảng biểu và metadata vận tải
function createSampleLogisticsPdf(): Buffer {
  const lines = [
    { text: 'OCEAN NETWORK EXPRESS - BILL OF LADING', x: 50, y: 750 },
    { text: 'B/L NO: ONEYPUSA28831', x: 380, y: 750 },
    { text: 'BOOKING NO: BKG-2610-8819', x: 380, y: 735 },
    { text: 'SHIPPER / EXPORTER:', x: 50, y: 710 },
    { text: 'CONG TY CP THUY SAN SAO MAI', x: 50, y: 695 },
    { text: 'KHU CONG NGHIEP SONG HAU, DONG THAP, VIETNAM', x: 50, y: 680 },
    { text: 'TEL: +84 277 3881 234', x: 50, y: 665 },
    { text: 'CONSIGNEE:', x: 50, y: 640 },
    { text: 'PACIFIC HARBOR SEAFOOD IMPORTS LLC', x: 50, y: 625 },
    { text: '1420 HARBOR BLVD, LONG BEACH, CA 90802, USA', x: 50, y: 610 },
    { text: 'VESSEL: ONE COMMITMENT V.024E', x: 50, y: 575 },
    { text: 'PORT OF LOADING: CAT LAI, VIETNAM', x: 280, y: 575 },
    { text: 'PORT OF DISCHARGE: LOS ANGELES, CA, USA', x: 50, y: 555 },
    { text: 'CONTAINER NO', x: 50, y: 520 },
    { text: 'SEAL NO', x: 160, y: 520 },
    { text: 'PACKAGES', x: 240, y: 520 },
    { text: 'DESCRIPTION OF GOODS', x: 320, y: 520 },
    { text: 'GROSS WEIGHT', x: 480, y: 520 },
    { text: 'ONEU9182301', x: 50, y: 500 },
    { text: 'ONES81923', x: 160, y: 500 },
    { text: '1,450 CTNS', x: 240, y: 500 },
    { text: 'FROZEN PANGASIUS FILLETS', x: 320, y: 500 },
    { text: '21,750.00 KGS', x: 480, y: 500 },
  ]

  let stream = 'BT /F1 10 Tf\n'
  let curX = 0
  let curY = 0
  for (const item of lines) {
    const dx = item.x - curX
    const dy = item.y - curY
    stream += `${dx} ${dy} Td (${item.text}) Tj\n`
    curX = item.x
    curY = item.y
  }
  stream += 'ET'

  const streamBytes = Buffer.byteLength(stream, 'utf-8')
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${streamBytes} >>
stream
${stream}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
trailer
<< /Size 5 /Root 1 0 R >>
startxref
500
%%EOF`

  return Buffer.from(pdf, 'utf-8')
}

async function runTests() {
  console.log('\n================================================================================')
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: NHẬN DẠNG CHỮ TỪ PDF VÀ BẢO TOÀN ĐỊNH DẠNG (FORMAT PRESERVATION)')
  console.log('================================================================================\n')

  let passCount = 0
  let failCount = 0

  function pass(msg: string) {
    passCount++
    console.log(`  ✅ [PASS] ${msg}`)
  }

  function fail(msg: string, err?: any) {
    failCount++
    console.error(`  ❌ [FAIL] ${msg}`, err)
  }

  // ---------------------------------------------------------------------------
  // NHÓM 1: BẢO TOÀN BỐ CỤC KHÔNG GIAN 2D KHI TRÍCH XUẤT TỪ PDF
  // ---------------------------------------------------------------------------
  console.log('▶ [NHÓM 1] KIỂM TRA TRÍCH XUẤT TEXT VÀ BẢO TOÀN BỐ CỤC KHÔNG GIAN 2D')

  try {
    const pdfBuf = createSampleLogisticsPdf()
    const layout = await extractTextFromPdfWithLayout(pdfBuf)

    assert.ok(layout.text.length > 100, 'Nội dung trích xuất phải có độ dài đầy đủ')
    assert.strictEqual(layout.hasTextLayer, true, 'Tài liệu phải nhận diện được Text Layer sẵn có')
    assert.strictEqual(layout.pageCount, 1, 'Số trang ước tính phải chính xác là 1')

    // 1.1 Kiểm tra giữ nguyên ngắt dòng
    assert.ok(layout.text.includes('\n'), 'Văn bản trích xuất phải giữ nguyên các dòng ngắt (\n)')
    assert.ok(
      layout.text.includes('SHIPPER / EXPORTER:\nCONG TY CP THUY SAN SAO MAI'),
      'Khối thông tin Shipper phải giữ nguyên các dòng địa chỉ liền mạch'
    )
    pass('Giữ nguyên ngắt dòng và cấu trúc khối địa chỉ Shipper / Consignee')

    // 1.2 Kiểm tra căn chỉnh trường dữ liệu trên cùng một dòng (Vessel & Port of Loading)
    const vesselLine = layout.text.split('\n').find((l) => l.includes('VESSEL:') && l.includes('PORT OF LOADING:'))
    assert.ok(vesselLine, 'Vessel và Port of Loading nằm trên cùng độ cao Y phải được giữ cùng dòng với khoảng cách cột')
    pass('Bảo toàn định dạng cột cho các trường song song trên cùng một tọa độ Y')

    // 1.3 Kiểm tra bảng hàng hóa (Container, Seal, Packages, Goods, Weight)
    const tableHeaderLine = layout.text.split('\n').find((l) => l.includes('CONTAINER NO') && l.includes('SEAL NO'))
    const tableDataLine = layout.text.split('\n').find((l) => l.includes('ONEU9182301') && l.includes('ONES81923'))
    assert.ok(tableHeaderLine, 'Tiêu đề bảng hàng hóa phải được trích xuất thành dòng riêng biệt')
    assert.ok(tableDataLine, 'Dữ liệu hàng hóa phải nằm trên dòng riêng biệt ngay dưới tiêu đề')
    pass('Bảo toàn cấu trúc dòng và cột cho bảng Container & hàng hóa')

    // 1.4 Kiểm tra bóc tách các trường Logistics trọng yếu
    const fields = extractLogisticsFields(layout.text)
    assert.strictEqual(fields.blNo, 'ONEYPUSA28831', 'Phải trích xuất chính xác B/L No: ONEYPUSA28831')
    assert.strictEqual(fields.containerNo, 'ONEU9182301', 'Phải trích xuất chính xác Container No: ONEU9182301')
    assert.strictEqual(fields.portOfLoading, 'CAT LAI, VIETNAM', 'Phải trích xuất chính xác POL: CAT LAI, VIETNAM')
    assert.strictEqual(fields.portOfDischarge, 'LOS ANGELES, CA, USA', 'Phải trích xuất chính xác POD: LOS ANGELES, CA, USA')
    assert.ok(fields.confidenceScore >= 70, 'Điểm tin cậy OCR phải đạt từ 70% trở lên')
    pass('Trích xuất tự động và điền chính xác các trường logistics cốt lõi (B/L, Container, POL, POD)')
  } catch (err) {
    fail('Lỗi nhóm 1: Trích xuất bố cục không gian 2D', err)
  }

  // ---------------------------------------------------------------------------
  // NHÓM 2: KHÔI PHỤC BẢNG MÃ TIẾNG VIỆT & XỬ LÝ MOJIBAKE
  // ---------------------------------------------------------------------------
  console.log('\n▶ [NHÓM 2] KIỂM TRA KHÔI PHỤC BẢNG MÃ TIẾNG VIỆT TỪ PDF SINGLE-BYTE FONT')

  try {
    const garbledText = 'VÆ”›n ˜ ˘¡n ˜ ˘ Æ» ng biÆ» n Hapag-Lloyd HLCUSGN2610418\nHˆ‡a ˜ ˘¡n th˘ ˘¡ng mÆ”¡i INV-2610-088\nPhiÆ”¿u ˜ ˆ‡ng gˆ‡i PKL-2610-033'
    const restored = normalizeLogisticsText(garbledText)

    assert.ok(restored.includes('Vận đơn'), 'Phải khôi phục "VÆ”›n ˜ ˘¡n" thành "Vận đơn"')
    assert.ok(restored.includes('Hóa đơn'), 'Phải khôi phục "Hˆ‡a ˜ ˘¡n" thành "Hóa đơn"')
    assert.ok(restored.includes('Phiếu đóng gói'), 'Phải khôi phục "PhiÆ”¿u ˜ ˆ‡ng gˆ‡i" thành "Phiếu đóng gói"')
    assert.ok(restored.includes('đường biển'), 'Phải khôi phục "˜ ˘ Æ» ng biÆ» n" thành "đường biển"')
    assert.ok(restored.includes('thương mại'), 'Phải khôi phục "th˘ ˘¡ng mÆ”¡i" thành "thương mại"')
    pass('Khôi phục thành công các thuật ngữ chứng từ tiếng Việt bị lỗi bảng mã sang chuẩn UTF-8')
  } catch (err) {
    fail('Lỗi nhóm 2: Khôi phục bảng mã tiếng Việt', err)
  }

  // ---------------------------------------------------------------------------
  // NHÓM 3: SINH MÃ HTML CẤU TRÚC CHO TRÌNH SOẠN THẢO TIPTAP
  // ---------------------------------------------------------------------------
  console.log('\n▶ [NHÓM 3] KIỂM TRA SINH TÀI LIỆU HTML CÓ CẤU TRÚC (TIPTAP & DETAIL VIEW)')

  try {
    const rawSample = `OCEAN NETWORK EXPRESS - BILL OF LADING    B/L NO: ONEYPUSA28831
SHIPPER: CONG TY CP THUY SAN SAO MAI
CONSIGNEE: PACIFIC HARBOR SEAFOOD IMPORTS LLC
PORT OF LOADING: CAT LAI, VIETNAM
CONTAINER NO    SEAL NO    GROSS WEIGHT
ONEU9182301    ONES81923  21,750.00 KGS`

    const sampleFields = extractLogisticsFields(rawSample)
    const html = generateStructuredDocumentHtml('Vận đơn đường biển ONE', rawSample, sampleFields)

    assert.ok(html.includes('<h2 class="text-xl font-bold text-slate-900 border-b pb-2 mb-3">Vận đơn đường biển ONE</h2>'), 'Phải có tiêu đề tài liệu h2')
    assert.ok(html.includes('<table class="border-collapse border border-slate-300 w-full text-sm">'), 'Phải có bảng thông tin nghiệp vụ logistics')
    assert.ok(html.includes('ONEYPUSA28831'), 'Bảng phải chứa B/L No')
    assert.ok(html.includes('ONEU9182301'), 'Bảng phải chứa Container No')
    assert.ok(html.includes('<pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap'), 'Nội dung phải nằm trong khối pre có class font-mono và whitespace-pre-wrap')
    pass('Sinh mã HTML cấu trúc hoàn hảo tương thích TipTap Editor và DocumentDetailView')
  } catch (err) {
    fail('Lỗi nhóm 3: Sinh mã HTML cấu trúc', err)
  }

  // ---------------------------------------------------------------------------
  // NHÓM 4: KIỂM SOÁT TẢI LÊN FILE & TÍNH TƯƠNG THÍCH MIME TYPE
  // ---------------------------------------------------------------------------
  console.log('\n▶ [NHÓM 4] KIỂM TRA AN NINH TẢI LÊN & CHẤP NHẬN TẬP TIN "edo (2).pdf"')

  try {
    const sampleBuffer = createSampleLogisticsPdf()

    // 4.1 Chấp nhận với application/pdf
    const check1 = validateFileMagicBytes(sampleBuffer, 'application/pdf')
    assert.strictEqual(check1.isValid, true, 'Magic bytes PDF phải hợp lệ với MIME application/pdf')

    // 4.2 Chấp nhận với application/octet-stream (phổ biến từ form browser Windows)
    const check2 = validateFileMagicBytes(sampleBuffer, 'application/octet-stream')
    assert.strictEqual(check2.isValid, true, 'Magic bytes PDF phải chấp nhận khi browser gửi application/octet-stream')

    // 4.3 Chấp nhận với application/x-pdf
    const check3 = validateFileMagicBytes(sampleBuffer, 'application/x-pdf')
    assert.strictEqual(check3.isValid, true, 'Magic bytes PDF phải chấp nhận khi browser gửi application/x-pdf')

    // 4.4 Kiểm tra tập tin có khoảng trắng và ngoặc đơn "edo (2).pdf"
    const uploadRes = validateComprehensiveUpload(sampleBuffer, 'edo (2).pdf', 'application/pdf')
    assert.strictEqual(uploadRes.isValid, true, 'Tập tin "edo (2).pdf" phải được phê duyệt hợp lệ qua bộ lọc')
    assert.strictEqual(uploadRes.safeFileName, 'edo__2_.pdf', 'Tên lưu trữ an toàn phải được chuẩn hóa đúng quy chuẩn')
    pass('Xác thực Magic Bytes nhị phân linh hoạt với các biến thể MIME type của PDF & eDO')
  } catch (err) {
    fail('Lỗi nhóm 4: An ninh và MIME types', err)
  }

  // ---------------------------------------------------------------------------
  // NHÓM 5: TÍCH HỢP GHI CƠ SỞ DỮ LIỆU ĐẦY ĐỦ RAWTEXT VÀ STRUCTUREDDATA
  // ---------------------------------------------------------------------------
  console.log('\n▶ [NHÓM 5] KIỂM TRA LƯU TRỮ VÀO CSDL VỚI FORMAT CHUẨN')

  try {
    const testDocId = `doc_test_fmt_${Date.now()}`
    const testShipment = await prisma.shipment.findFirst()
    const testUser = await prisma.user.findFirst()
    if (!testShipment || !testUser) {
      throw new Error('Cần ít nhất 1 Shipment và 1 User để kiểm tra')
    }

    const testPdfBuf = createSampleLogisticsPdf()
    const extractedText = await extractTextFromBufferAsync(testPdfBuf, 'sample_test.pdf')
    const logistics = extractLogisticsFields(extractedText)
    const docHtml = generateStructuredDocumentHtml('Test Format Document', extractedText, logistics)

    const createdDoc = await prisma.document.create({
      data: {
        id: testDocId,
        orgId: testShipment.orgId,
        shipmentId: testShipment.id,
        type: 'BL',
        title: 'Vận đơn kiểm thử format',
        fileName: 'sample_test.pdf',
        fileSizeBytes: testPdfBuf.length,
        storageKey: `test_vault/${testDocId}.pdf`,
        pages: 1,
        docDate: '2026-11-03',
        createdBy: testUser.id,
        updatedBy: testUser.id,
        editedHtml: docHtml,
      },
    })

    const ocrRecord = await prisma.documentOcrResult.create({
      data: {
        documentId: createdDoc.id,
        status: 'COMPLETED',
        confidenceScore: logistics.confidenceScore,
        rawText: extractedText,
        structuredData: JSON.stringify({
          ...logistics,
          formattedText: extractedText,
        }),
      },
    })

    // Truy vấn lại từ DB để kiểm tra tính toàn vẹn
    const queriedDoc = await prisma.document.findUnique({
      where: { id: testDocId },
      include: { ocrResults: true },
    })

    assert.ok(queriedDoc, 'Tài liệu phải tồn tại trong CSDL')
    assert.ok(queriedDoc.editedHtml && queriedDoc.editedHtml.includes('<pre class="font-mono'), 'editedHtml phải chứa khối văn bản định dạng monospace')
    assert.strictEqual(queriedDoc.ocrResults[0]?.rawText, extractedText, 'rawText lưu trong CSDL phải bảo toàn nguyên vẹn format')
    assert.ok(queriedDoc.ocrResults[0]?.rawText?.includes('\n'), 'rawText phải chứa các ký tự xuống dòng ngắt đoạn')

    // Dọn dẹp bản ghi kiểm thử
    await prisma.documentOcrResult.deleteMany({ where: { documentId: testDocId } })
    await prisma.document.delete({ where: { id: testDocId } })

    pass('CSDL lưu trữ chuẩn xác rawText có định dạng dòng cột và editedHtml cấu trúc hoàn chỉnh')
  } catch (err) {
    fail('Lỗi nhóm 5: Lưu trữ CSDL', err)
  }

  console.log('\n================================================================================')
  console.log(`KẾT QUẢ KIỂM THỬ: ${passCount} PASSED / ${failCount} FAILED`)
  console.log('================================================================================\n')

  if (failCount > 0) {
    process.exit(1)
  }
}

runTests().catch((err) => {
  console.error('Lỗi nghiêm trọng trong runner kiểm thử:', err)
  process.exit(1)
})
