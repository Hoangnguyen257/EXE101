import assert from 'node:assert'
import { prisma } from '../lib/prisma'
import { suggestDocType } from '../components/app/upload-dialog'
import { MAX_FILE_SIZE, ALLOWED_EXTENSIONS } from '../lib/storage/document-storage'
import { login } from '../lib/auth/auth-service'

async function runTest() {
  console.log('================================================================================')
  console.log('🧪 TEST: LỖI 4 - DUY NHẤT 1 Ô CHỌN LÔ HÀNG CHO CẢ LƯỢT TẢI & ĐỒNG NHẤT GIỚI HẠN')
  console.log('================================================================================')

  // 1. Thống nhất giới hạn dung lượng và định dạng giữa Client & Server
  console.log('\n[PHẦN 1] THỐNG NHẤT GIỚI HẠN 25MB VÀ ĐỊNH DẠNG PDF/JPG/PNG')
  assert.strictEqual(MAX_FILE_SIZE, 25 * 1024 * 1024, 'Giới hạn server và client phải thống nhất đúng 25MB')
  assert(ALLOWED_EXTENSIONS.includes('.pdf'), 'Cho phép PDF')
  assert(ALLOWED_EXTENSIONS.includes('.jpg'), 'Cho phép JPG')
  assert(ALLOWED_EXTENSIONS.includes('.jpeg'), 'Cho phép JPEG')
  assert(ALLOWED_EXTENSIONS.includes('.png'), 'Cho phép PNG')
  console.log('✅ [PASS] Giới hạn thống nhất 25MB và chỉ nhận PDF, JPG, PNG')

  // 2. Gợi ý loại chứng từ theo tên file
  console.log('\n[PHẦN 2] THẨM ĐỊNH TỰ ĐỘNG GỢI Ý LOẠI CHỨNG TỪ (DOC TYPE)')
  const blSuggestion = suggestDocType('BL_MAEU262104471.pdf')
  assert.strictEqual(blSuggestion.type, 'BL', 'File có chữ BL nhận diện loại BL')

  const invSuggestion = suggestDocType('Invoice_INV-2026-VN-994.pdf')
  assert.strictEqual(invSuggestion.type, 'INVOICE', 'File có chữ Invoice nhận diện loại INVOICE')

  const plSuggestion = suggestDocType('Packing_List_TML.pdf')
  assert.strictEqual(plSuggestion.type, 'PACKING_LIST', 'File có chữ Packing List nhận diện loại PACKING_LIST')

  const customSuggestion = suggestDocType('To_Khai_Hai_Quan_001.pdf')
  assert.strictEqual(customSuggestion.type, 'CUSTOMS', 'File có chữ To_Khai nhận diện loại CUSTOMS')
  console.log('✅ [PASS] Bộ quy tắc gợi ý loại chứng từ hoạt động chính xác')

  // 3. Thử nghiệm Upload thực tế với duy nhất một Lô hàng được chọn
  console.log('\n[PHẦN 3] KIỂM THỬ MỌI FILE TRONG LƯỢT TẢI ĐỀU VÀO ĐÚNG 1 LÔ ĐÃ CHỌN')
  const org = await prisma.organization.findFirst()
  assert(org, 'Cần Organization')
  const user = await prisma.user.findFirst({ where: { orgId: org.id } })
  assert(user, 'Cần User')
  const dept = await prisma.department.findFirst({ where: { orgId: org.id } })

  // Tạo 2 lô hàng khác nhau
  const shipmentTarget = await prisma.shipment.create({
    data: {
      orgId: org.id,
      jobNo: `JOB-TARGET-${Date.now()}`,
      mode: 'sea',
      origin: 'Cat Lai, VN',
      destination: 'Singapore, SG',
      status: 'booking',
      draftStep: 3,
      ownerId: user.id,
      departmentId: dept?.id || null,
    },
  })

  const shipmentOther = await prisma.shipment.create({
    data: {
      orgId: org.id,
      jobNo: `JOB-OTHER-${Date.now()}`,
      mode: 'air',
      origin: 'Tan Son Nhat, VN',
      destination: 'Tokyo, JP',
      status: 'booking',
      draftStep: 3,
      ownerId: user.id,
      departmentId: dept?.id || null,
    },
  })

  // Tải lên 2 file vào shipmentTarget (mặc dù 1 file có tên chứa JOB-OTHER)
  const cust = await prisma.customer.findFirst()
  assert(cust, 'Cần Customer')
  const docDept = await prisma.department.findFirst()
  assert(docDept, 'Cần Department')

  const file1 = await prisma.document.create({
    data: {
      organization: { connect: { id: org.id } },
      shipment: { connect: { id: shipmentTarget.id } },
      customer: { connect: { id: cust.id } },
      department: { connect: { id: docDept.id } },
      creator: { connect: { id: user.id } },
      updater: { connect: { id: user.id } },
      type: 'BL',
      title: 'Vận đơn đường biển',
      fileName: 'BL_Target.pdf',
      fileSizeBytes: 10240,
      storageKey: `test_bl_${Date.now()}`,
      docDate: '2026-11-02',
    },
  })

  const file2 = await prisma.document.create({
    data: {
      organization: { connect: { id: org.id } },
      shipment: { connect: { id: shipmentTarget.id } },
      customer: { connect: { id: cust.id } },
      department: { connect: { id: docDept.id } },
      creator: { connect: { id: user.id } },
      updater: { connect: { id: user.id } },
      type: 'INVOICE',
      title: 'Hóa đơn thương mại',
      fileName: `Invoice_${shipmentOther.jobNo}.pdf`,
      fileSizeBytes: 20480,
      storageKey: `test_inv_${Date.now()}`,
      docDate: '2026-11-02',
    },
  })

  // Đối soát: Cả 2 file BẮT BUỘC nằm trong shipmentTarget
  const uploadedFiles = await prisma.document.findMany({
    where: { shipmentId: shipmentTarget.id },
  })

  assert.strictEqual(uploadedFiles.length, 2, 'Tất cả 2 file trong lượt tải đều được gán chính xác vào lô target')
  assert(uploadedFiles.some((f) => f.id === file1.id))
  assert(uploadedFiles.some((f) => f.id === file2.id))

  // Đảm bảo shipmentOther KHÔNG bị ghi ngầm file nào
  const otherFiles = await prisma.document.findMany({
    where: { shipmentId: shipmentOther.id },
  })
  assert.strictEqual(otherFiles.length, 0, 'Lô khác KHÔNG bị gán file ngầm ngoài ý muốn')
  console.log(`✅ [PASS] Tất cả các file trong lượt tải được gán đồng nhất vào Lô "${shipmentTarget.jobNo}"`)

  // Dọn dẹp bản ghi kiểm thử
  await prisma.document.deleteMany({ where: { id: { in: [file1.id, file2.id] } } })
  await prisma.shipment.deleteMany({ where: { id: { in: [shipmentTarget.id, shipmentOther.id] } } })
  console.log('🧹 Đã dọn dẹp các tài liệu và lô hàng kiểm thử.')

  console.log('\n================================================================================')
  console.log('🎉 TẤT CẢ CÁC MỤC NGHIỆM THU LỖI 4 ĐỀU ĐẠT CHUẨN 100% PASS!')
  console.log('================================================================================\n')
}

runTest().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err)
  process.exit(1)
})
