import assert from 'node:assert'
import {
  validateVietnameseTaxCode,
  normalizeAndValidateHsCode,
  ShipmentGoodsItemSchema,
} from '../lib/validations/shipment-wizard'

async function runTest() {
  console.log('================================================================================')
  console.log('🧪 TEST: LỖI 3 - KIỂM SOÁT MST CHẶT CHẼ & MÃ HS CODE TÙY CHỌN')
  console.log('================================================================================')

  // ---------------------------------------------------------------------------
  // PHẦN 1: THẨM ĐỊNH MÃ SỐ THUẾ VIỆT NAM (CHẶT CHẼ, CHỐNG SỐ LẶP)
  // ---------------------------------------------------------------------------
  console.log('\n[PHẦN 1] KIỂM TRA MÃ SỐ THUẾ VIỆT NAM (MST)')

  // 1.1. Từ chối MST toàn số 0 hoặc chữ số lặp lại
  const zeroResult = validateVietnameseTaxCode('0000000000')
  assert(!zeroResult.valid, 'MST "0000000000" (toàn số 0) BẮT BUỘC bị từ chối')
  console.log('✅ [PASS] Từ chối thành công MST "0000000000" (toàn số 0)')

  const onesResult = validateVietnameseTaxCode('1111111111')
  assert(!onesResult.valid, 'MST "1111111111" (toàn số 1) BẮT BUỘC bị từ chối')
  console.log('✅ [PASS] Từ chối thành công MST "1111111111" (toàn số 1 lặp lại)')

  const twosResult = validateVietnameseTaxCode('2222222222')
  assert(!twosResult.valid, 'MST "2222222222" (toàn số 2) BẮT BUỘC bị từ chối')
  console.log('✅ [PASS] Từ chối thành công MST "2222222222" (toàn số 2 lặp lại)')

  // 1.2. Từ chối MST sai định dạng / độ dài / chứa chữ cái
  assert(!validateVietnameseTaxCode('').valid, 'MST rỗng bị từ chối')
  assert(!validateVietnameseTaxCode('01001091').valid, 'MST quá ngắn (<10 số) bị từ chối')
  assert(!validateVietnameseTaxCode('010010910ABC').valid, 'MST chứa chữ cái bị từ chối')
  assert(!validateVietnameseTaxCode('010010910612345').valid, 'MST quá dài bị từ chối')
  console.log('✅ [PASS] Từ chối các MST sai quy cách định dạng')

  // 1.3. Từ chối MST sai thuật toán checksum
  const wrongChecksum = validateVietnameseTaxCode('0100109105') // Đúng chuẩn phải là chữ số cuối = 6
  assert(!wrongChecksum.valid, 'MST sai chữ số kiểm tra (chữ số cuối 5 thay vì 6) bị từ chối')
  console.log('✅ [PASS] Từ chối MST sai checksum (0100109105 -> chữ số kiểm tra không khớp)')

  // 1.4. Chấp nhận các MST doanh nghiệp thật tại Việt Nam
  const viettel = validateVietnameseTaxCode('0100109106')
  assert(viettel.valid, 'MST Tập đoàn Viettel 0100109106 phải hợp lệ')
  console.log('✅ [PASS] Chấp nhận MST thật: 0100109106 (Tập đoàn Viettel)')

  const vinamilk = validateVietnameseTaxCode('0300588569')
  assert(vinamilk.valid, 'MST Vinamilk 0300588569 phải hợp lệ')
  console.log('✅ [PASS] Chấp nhận MST thật: 0300588569 (Vinamilk)')

  const fpt = validateVietnameseTaxCode('0101248141')
  assert(fpt.valid, 'MST Tập đoàn FPT 0101248141 phải hợp lệ')
  console.log('✅ [PASS] Chấp nhận MST thật: 0101248141 (Tập đoàn FPT)')

  const branchMst = validateVietnameseTaxCode('0100109106-001')
  assert(branchMst.valid, 'MST chi nhánh 13 số 0100109106-001 phải hợp lệ')
  console.log('✅ [PASS] Chấp nhận MST chi nhánh 13 số: 0100109106-001')

  // ---------------------------------------------------------------------------
  // PHẦN 2: THẨM ĐỊNH MÃ HS CODE (TÙY CHỌN / OPTIONAL)
  // ---------------------------------------------------------------------------
  console.log('\n[PHẦN 2] KIỂM TRA MÃ HS CODE (TÙY CHỌN & CHUẨN HÓA)')

  // 2.1. Để trống HS Code -> HỢP LỆ (vì không bắt buộc)
  const emptyHs = normalizeAndValidateHsCode('')
  assert(emptyHs.valid && emptyHs.normalized === '', 'HS Code rỗng ("") phải hợp lệ và trả về normalized: ""')
  console.log('✅ [PASS] HS Code để trống chuỗi rỗng: Hợp lệ')

  const whitespaceHs = normalizeAndValidateHsCode('   ')
  assert(whitespaceHs.valid && whitespaceHs.normalized === '', 'HS Code khoảng trắng phải hợp lệ')
  console.log('✅ [PASS] HS Code chỉ có khoảng trắng: Hợp lệ')

  const nullHs = normalizeAndValidateHsCode(null)
  assert(nullHs.valid && nullHs.normalized === '', 'HS Code null: Hợp lệ')
  console.log('✅ [PASS] HS Code null/undefined: Hợp lệ')

  // 2.2. Nhập HS Code có dấu chấm -> Chuẩn hóa bỏ dấu chấm
  const dottedHs = normalizeAndValidateHsCode('0304.62.00')
  assert(dottedHs.valid && dottedHs.normalized === '03046200', 'HS Code "0304.62.00" chuẩn hóa thành "03046200"')
  console.log('✅ [PASS] HS Code "0304.62.00" chuẩn hóa thành "03046200"')

  const dottedHs2 = normalizeAndValidateHsCode('0306.17')
  assert(dottedHs2.valid && dottedHs2.normalized === '030617', 'HS Code "0306.17" chuẩn hóa thành "030617"')
  console.log('✅ [PASS] HS Code "0306.17" chuẩn hóa thành "030617"')

  // 2.3. Nhập HS Code sai độ dài hoặc chứa chữ cái -> BỊ TỪ CHỐI
  const shortHs = normalizeAndValidateHsCode('123')
  assert(!shortHs.valid, 'HS Code < 4 chữ số bị từ chối')
  console.log('✅ [PASS] HS Code quá ngắn "123" (< 4 chữ số) bị từ chối')

  const longHs = normalizeAndValidateHsCode('12345678901')
  assert(!longHs.valid, 'HS Code > 10 chữ số bị từ chối')
  console.log('✅ [PASS] HS Code quá dài "12345678901" (> 10 chữ số) bị từ chối')

  const letterHs = normalizeAndValidateHsCode('0304.AB.CD')
  assert(!letterHs.valid, 'HS Code chứa chữ cái bị từ chối')
  console.log('✅ [PASS] HS Code chứa chữ cái bị từ chối')

  // 2.4. Zod Schema: Mô tả bắt buộc, HS Code tùy chọn
  const validItemWithoutHs = ShipmentGoodsItemSchema.safeParse({
    description: 'Thép tấm cán nóng',
  })
  assert(validItemWithoutHs.success, 'Zod Schema chấp nhận hàng hóa không có HS Code')
  assert.strictEqual(validItemWithoutHs.data.hsCode, '', 'HS Code mặc định là chuỗi rỗng')
  console.log('✅ [PASS] Zod Schema chấp nhận hàng hóa để trống HS Code')

  const invalidItemWithoutDesc = ShipmentGoodsItemSchema.safeParse({
    description: '',
    hsCode: '03046200',
  })
  assert(!invalidItemWithoutDesc.success, 'Zod Schema BẮT BUỘC mô tả hàng hóa không được để trống')
  console.log('✅ [PASS] Zod Schema từ chối khi thiếu mô tả hàng hóa')

  console.log('\n================================================================================')
  console.log('🎉 TẤT CẢ CÁC MỤC NGHIỆM THU LỖI 3 ĐỀU ĐẠT CHUẨN 100% PASS!')
  console.log('================================================================================\n')
}

runTest().catch((err) => {
  console.error('❌ Kiểm thử thất bại:', err)
  process.exit(1)
})

