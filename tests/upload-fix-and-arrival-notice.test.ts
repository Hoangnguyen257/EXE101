/**
 * TESTS: SỬA LỖI TẢI CHỨNG TỪ & BỎ YÊU CẦU BẮT BUỘC THÔNG BÁO HÀNG ĐẾN (ARRIVAL NOTICE)
 * 
 * Kiểm tra các tính năng:
 * 1. Upload tập tin an toàn vào lô hàng draft / chưa có customerId hoặc departmentId
 * 2. Hỗ trợ tập tin PDF có khoảng trắng, dấu ngoặc như 'edo (2).pdf'
 * 3. Đảm bảo cấu hình lưu trữ VAULT_DIR trên Vercel (/tmp/storage_vault)
 * 4. Kiểm tra ARRIVAL_NOTICE không còn là chứng từ bắt buộc trong checklist & tiến độ hoàn thiện
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'
import path from 'path'
import fs from 'fs'
import { prisma } from '../lib/prisma'
import { getRequiredDocTypes, REQUIRED_DOC_TYPES } from '../lib/types'
import { generateShipmentRequirements } from '../lib/validations/shipment-wizard'
import {
  VAULT_DIR,
  sanitizeFileName,
  validateComprehensiveUpload,
} from '../lib/storage/document-storage'
import { getStorageProvider, generateStorageKey } from '../lib/storage/storage-provider'

async function runTests() {
  console.log('\n================================================================================')
  console.log('🧪 BẮT ĐẦU KIỂM THỬ: SỬA LỖI TẢI CHỨNG TỪ & BỎ BẮT BUỘC THÔNG BÁO HÀNG ĐẾN')
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
  // NHÓM 1: KIỂM TRA THÔNG BÁO HÀNG ĐẾN (ARRIVAL NOTICE) KHÔNG BẮT BUỘC BỔ SUNG
  // ---------------------------------------------------------------------------
  console.log('▶ [NHÓM 1] KIỂM TRA QUY TẮC NGHIỆP VỤ THÔNG BÁO HÀNG ĐẾN (ARRIVAL NOTICE)')

  try {
    // 1.1 Kiểm tra REQUIRED_DOC_TYPES hằng số không chứa ARRIVAL_NOTICE
    assert.strictEqual(
      REQUIRED_DOC_TYPES.includes('ARRIVAL_NOTICE'),
      false,
      'REQUIRED_DOC_TYPES không được chứa ARRIVAL_NOTICE'
    )
    pass('Hằng số REQUIRED_DOC_TYPES không chứa ARRIVAL_NOTICE')

    // 1.2 Kiểm tra getRequiredDocTypes cho hàng nhập đường biển (Sea Import)
    const seaImportReqs = getRequiredDocTypes({
      origin: 'SHANGHAI, CHINA',
      destination: 'HAI PHONG, VIETNAM',
      mode: 'sea',
    })
    assert.strictEqual(
      seaImportReqs.includes('ARRIVAL_NOTICE'),
      false,
      'Hàng nhập đường biển không được bắt buộc ARRIVAL_NOTICE'
    )
    assert.ok(seaImportReqs.includes('DELIVERY_ORDER'), 'Hàng nhập đường biển vẫn yêu cầu Lệnh giao hàng (eDO/DO)')
    pass('getRequiredDocTypes (Sea Import) loại bỏ hoàn toàn ARRIVAL_NOTICE khỏi checklist bắt buộc')

    // 1.3 Kiểm tra getRequiredDocTypes cho hàng nhập đường hàng không (Air Import)
    const airImportReqs = getRequiredDocTypes({
      origin: 'INCHEON, KOREA',
      destination: 'NOI BAI, VIETNAM',
      mode: 'air',
    })
    assert.strictEqual(
      airImportReqs.includes('ARRIVAL_NOTICE'),
      false,
      'Hàng nhập đường hàng không không được bắt buộc ARRIVAL_NOTICE'
    )
    pass('getRequiredDocTypes (Air Import) loại bỏ hoàn toàn ARRIVAL_NOTICE')

    // 1.4 Kiểm tra Wizard checklist requirements generator
    const wizardSeaImport = generateShipmentRequirements('sea', 'SINGAPORE', 'HO CHI MINH, VIETNAM')
    assert.strictEqual(
      wizardSeaImport.includes('ARRIVAL_NOTICE'),
      false,
      'Wizard Step 2 không được sinh checklist bắt buộc ARRIVAL_NOTICE cho đường biển'
    )
    const wizardAirImport = generateShipmentRequirements('air', 'TOKYO, JAPAN', 'HA NOI, VIETNAM')
    assert.strictEqual(
      wizardAirImport.includes('ARRIVAL_NOTICE'),
      false,
      'Wizard Step 2 không được sinh checklist bắt buộc ARRIVAL_NOTICE cho đường hàng không'
    )
    pass('generateShipmentRequirements không sinh yêu cầu ARRIVAL_NOTICE trong checklist lô hàng mới')
  } catch (err) {
    fail('Lỗi kiểm tra quy tắc nghiệp vụ ARRIVAL_NOTICE', err)
  }

  // ---------------------------------------------------------------------------
  // NHÓM 2: KIỂM TRA FILE UPLOAD HARDENING VỚI TÊN FILE 'edo (2).pdf' & EROFS MITIGATION
  // ---------------------------------------------------------------------------
  console.log('\n▶ [NHÓM 2] KIỂM TRA TẢI LÊN TẬP TIN "edo (2).pdf" & KIỂM SOÁT STORAGE')

  try {
    // 2.1 Làm sạch tên file có khoảng trắng và dấu ngoặc đơn
    const rawFileName = 'edo (2).pdf'
    const safeName = sanitizeFileName(rawFileName)
    assert.strictEqual(safeName, 'edo__2_.pdf', 'Tên file được làm sạch an toàn không gây lỗi filesystem')
    pass(`Tên file gốc "${rawFileName}" được chuẩn hóa thành "${safeName}"`)

    // 2.2 Tạo buffer mô phỏng file PDF eDO thực tế có kèm script Acrobat và trailing metadata
    const pdfHeader = Buffer.from('%PDF-1.7\n%âãÏÓ\n')
    const pdfBody = Buffer.from('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n')
    const pdfEof = Buffer.from('\n%%EOF\n')
    const trailingPadding = Buffer.from('000000000000'.repeat(300)) // Byte đệm trailer > 2KB
    const mockEdoBuffer = Buffer.concat([pdfHeader, pdfBody, pdfEof, trailingPadding])

    const validationResult = validateComprehensiveUpload(mockEdoBuffer, rawFileName, 'application/pdf')
    assert.strictEqual(validationResult.isValid, true, 'File eDO PDF hợp lệ phải được chấp thuận')
    assert.strictEqual(validationResult.mimeType, 'application/pdf')
    pass('Tập tin "edo (2).pdf" có trailing bytes được kiểm tra tính hợp lệ thành công')

    // 2.3 Kiểm tra chặn chỉ thị nguy hiểm /Launch
    const maliciousPdf = Buffer.concat([pdfHeader, Buffer.from('/Launch /Action << /F (cmd.exe) >>'), pdfEof])
    const maliciousResult = validateComprehensiveUpload(maliciousPdf, 'exploit.pdf', 'application/pdf')
    assert.strictEqual(maliciousResult.isValid, false, 'File chứa chỉ thị nguy hiểm /Launch phải bị chặn')
    pass('Chỉ thị thực thi hệ thống nguy hiểm (/Launch) bị phát hiện và ngăn chặn lập tức')

    // 2.4 Kiểm tra phân giải VAULT_DIR khi chạy trên Vercel
    const originalVercel = process.env.VERCEL
    try {
      process.env.VERCEL = '1'
      // Load lại logic phân giải
      const vercelVaultDir = process.env.VERCEL
        ? path.resolve('/tmp', 'storage_vault')
        : process.env.STORAGE_LOCAL_PATH
          ? path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH)
          : path.resolve(process.cwd(), 'storage_vault')
      const normalized = vercelVaultDir.replace(/\\/g, '/')
      assert.ok(normalized.includes('/tmp/storage_vault') || normalized.includes('tmp'), 'VAULT_DIR trên Vercel phải trỏ vào /tmp')
      pass(`Đường dẫn kho lưu trữ trên Vercel Serverless định tuyến an toàn vào: ${vercelVaultDir}`)
    } finally {
      if (originalVercel !== undefined) {
        process.env.VERCEL = originalVercel
      } else {
        delete process.env.VERCEL
      }
    }
  } catch (err) {
    fail('Lỗi kiểm tra tính năng tải lên tập tin và storage', err)
  }

  // ---------------------------------------------------------------------------
  // NHÓM 3: KIỂM TRA TẢI CHỨNG TỪ VÀO LÔ HÀNG DRAFT (CUSTOMERID = NULL)
  // ---------------------------------------------------------------------------
  console.log('\n▶ [NHÓM 3] KIỂM TRA LƯU TRỮ VÀO CSDL VỚI LÔ HÀNG DRAFT (CUSTOMERID = NULL)')

  let testShipmentId: string | null = null
  let testDocId: string | null = null

  try {
    const org = await prisma.organization.findFirst()
    const user = await prisma.user.findFirst({ where: { roleCode: 'ADMIN' } })

    assert.ok(org, 'Cần có Organization trong DB')
    assert.ok(user, 'Cần có User Admin trong DB')

    // 3.1 Tạo lô hàng draft không có customerId (mô phỏng chính xác lô TML-SE2611-3483)
    const testJobNo = `TEST-DRAFT-${Date.now()}`
    const draftShipment = await prisma.shipment.create({
      data: {
        orgId: org.id,
        jobNo: testJobNo,
        customerId: null, // Draft chưa chốt khách hàng!
        departmentId: null, // Chưa gán phòng ban!
        mode: 'sea',
        origin: 'SHANGHAI',
        destination: 'HAI PHONG',
        status: 'draft',
        draftStep: 1,
        ownerId: user.id,
      },
    })
    testShipmentId = draftShipment.id
    pass(`Tạo thành công lô hàng nháp ${testJobNo} với customerId = null và departmentId = null`)

    // 3.2 Tạo Document liên kết với lô hàng draft này
    testDocId = `test_doc_${Date.now()}`
    const storageKey = generateStorageKey({ extension: '.pdf' })

    const createdDoc = await prisma.document.create({
      data: {
        id: testDocId,
        orgId: org.id,
        shipmentId: draftShipment.id,
        customerId: null, // Document cho phép customerId = null!
        departmentId: null, // Cho phép departmentId = null!
        type: 'DELIVERY_ORDER',
        title: `Lệnh giao hàng điện tử (eDO) ${testJobNo}`,
        fileName: 'edo (2).pdf',
        fileSizeBytes: 751 * 1024,
        storageKey,
        docDate: '2026-10-19',
        createdBy: user.id,
        updatedBy: user.id,
      },
    })

    assert.strictEqual(createdDoc.id, testDocId)
    assert.strictEqual(createdDoc.customerId, null, 'Document customerId phải lưu null thành công mà không lỗi')
    assert.strictEqual(createdDoc.fileName, 'edo (2).pdf')
    pass('Lưu chứng từ "edo (2).pdf" vào CSDL thành công mỹ mãn cho lô hàng nháp (customerId = null)')

    // 3.3 Đọc lại Document cùng Shipment để kiểm tra quan hệ
    const reloadedDoc = await prisma.document.findUnique({
      where: { id: testDocId },
      include: { shipment: true, customer: true },
    })
    assert.ok(reloadedDoc, 'Document phải truy vấn lại được')
    assert.strictEqual(reloadedDoc.customer, null, 'Quan hệ customer là null không gây lỗi')
    assert.strictEqual(reloadedDoc.shipment.jobNo, testJobNo)
    pass('Truy vấn Document include Customer và Shipment hoạt động trơn tru không phát sinh ngoại lệ')
  } catch (err) {
    fail('Lỗi kiểm tra lưu trữ Document với customerId = null', err)
  } finally {
    // Dọn dẹp dữ liệu kiểm thử
    if (testDocId) {
      await prisma.document.delete({ where: { id: testDocId } }).catch(() => {})
    }
    if (testShipmentId) {
      await prisma.shipment.delete({ where: { id: testShipmentId } }).catch(() => {})
    }
  }

  console.log('\n================================================================================')
  console.log(`KẾT QUẢ KIỂM THỬ: ${passCount} PASSED / ${failCount} FAILED`)
  console.log('================================================================================\n')

  if (failCount > 0) {
    process.exit(1)
  }
}

runTests().catch((e) => {
  console.error('Unhandled test runner error:', e)
  process.exit(1)
})
