import { z } from 'zod'
import type { DocType } from '@/lib/types'

/**
 * Thuật toán kiểm tra số kiểm tra (Checksum) Mã số thuế Việt Nam (10 hoặc 13 chữ số)
 * - 10 chữ số: d1 d2 d3 d4 d5 d6 d7 d8 d9 d10
 * - Trọng số W = [31, 29, 23, 19, 17, 13, 7, 5, 3]
 * - Tổng S = sum(d[i] * W[i]) (i = 0..8)
 * - Số dư R = S % 11
 * - Chữ số kiểm tra d10 = 10 - R (nếu 10 - R === 10 thì d10 = 0)
 * - 13 chữ số: XXXXXXXXXX-XXX (10 chữ số đầu đúng chuẩn và theo sau là dấu gạch ngang cùng 3 số)
 */
export function validateVietnameseTaxCode(taxCode: string): { valid: boolean; message?: string } {
  if (!taxCode || typeof taxCode !== 'string') {
    return { valid: false, message: 'Mã số thuế là bắt buộc.' }
  }

  const clean = taxCode.trim()
  const regex = /^(\d{10})(-\d{3})?$/
  const match = clean.match(regex)

  if (!match) {
    return {
      valid: false,
      message: 'Mã số thuế không đúng định dạng (phải gồm 10 chữ số hoặc 13 chữ số dạng XXXXXXXXXX-XXX).',
    }
  }

  const tenDigits = match[1]
  // Từ chối MST toàn số 0 hoặc toàn một chữ số lặp (ví dụ 0000000000, 1111111111)
  if (/^(\d)\1{9}$/.test(tenDigits)) {
    return {
      valid: false,
      message: 'Mã số thuế không hợp lệ (không thể là chuỗi số 0 hoặc chữ số lặp lại).',
    }
  }

  const digits = tenDigits.split('').map(Number)
  const weights = [31, 29, 23, 19, 17, 13, 7, 5, 3]

  const sum = digits.slice(0, 9).reduce((acc, digit, idx) => acc + digit * weights[idx], 0)
  const remainder = sum % 11
  const checkDigit = 10 - remainder === 10 ? 0 : 10 - remainder

  if (digits[9] !== checkDigit) {
    return {
      valid: false,
      message: `Mã số thuế không hợp lệ theo thuật toán số kiểm tra Tổng cục Thuế (chữ số cuối phải là ${checkDigit}).`,
    }
  }

  return { valid: true }
}

/**
 * Chuẩn hóa và kiểm tra mã HS Code:
 * - Mã HS Code là tùy chọn (không bắt buộc).
 * - Cho phép nhập dấu chấm (e.g. "0304.62.00")
 * - Chuẩn hóa bỏ dấu chấm ("03046200")
 * - Độ dài hợp lệ (nếu có nhập): từ 4 đến 10 chữ số
 */
export function normalizeAndValidateHsCode(hsCode?: string | null): { valid: boolean; normalized: string; message?: string } {
  if (!hsCode || typeof hsCode !== 'string' || !hsCode.trim()) {
    return { valid: true, normalized: '' }
  }

  const clean = hsCode.replace(/\./g, '').trim()

  if (!/^\d+$/.test(clean)) {
    return {
      valid: false,
      normalized: clean,
      message: 'Mã HS Code chỉ được chứa chữ số và dấu chấm phân tách (e.g. 0304.62.00).',
    }
  }

  if (clean.length < 4 || clean.length > 10) {
    return {
      valid: false,
      normalized: clean,
      message: 'Mã HS Code phải có từ 4 đến 10 chữ số (thực tế: ' + clean.length + ' chữ số).',
    }
  }

  return { valid: true, normalized: clean }
}

/**
 * Kiểm tra tuyến đường: Điểm đi và Điểm đến không được trùng nhau
 */
export function validateRoute(origin?: string | null, destination?: string | null): { valid: boolean; message?: string } {
  if (!origin || !origin.trim()) {
    return { valid: false, message: 'Điểm xuất phát (Origin) không được để trống.' }
  }
  if (!destination || !destination.trim()) {
    return { valid: false, message: 'Điểm đích (Destination) không được để trống.' }
  }
  if (origin.trim().toLowerCase() === destination.trim().toLowerCase()) {
    return { valid: false, message: 'Điểm đi và điểm đến không được trùng nhau.' }
  }
  return { valid: true }
}

/**
 * Sinh danh mục Checklist yêu cầu theo Tuyến đường và Phương thức vận chuyển
 */
export function generateShipmentRequirements(mode: 'sea' | 'air' | 'road', origin: string, destination: string): DocType[] {
  const originStr = (origin || '').toUpperCase()
  const destStr = (destination || '').toUpperCase()
  const isExport = originStr.includes('VN') || originStr.includes('VIETNAM') || originStr.includes('VNM')
  const isImport = destStr.includes('VN') || destStr.includes('VIETNAM') || destStr.includes('VNM')
  const isInternational = !isExport || !isImport // có xuất hoặc nhập quốc tế

  let checklist: DocType[] = []

  if (mode === 'air') {
    checklist = isExport
      ? ['BL', 'BOOKING', 'PACKING_LIST', 'CUSTOMS', 'INVOICE']
      : ['ARRIVAL_NOTICE', 'PACKING_LIST', 'CUSTOMS', 'INVOICE', 'BL']
  } else if (mode === 'road') {
    checklist = ['BL', 'PACKING_LIST', 'CUSTOMS', 'INVOICE', 'DELIVERY_ORDER']
  } else {
    // Mode sea
    checklist = isExport
      ? ['BL', 'BOOKING', 'PACKING_LIST', 'CUSTOMS', 'INVOICE', 'DELIVERY_ORDER']
      : ['ARRIVAL_NOTICE', 'DELIVERY_ORDER', 'PACKING_LIST', 'CUSTOMS', 'INVOICE', 'BL']
  }

  if (isInternational && !checklist.includes('CO')) {
    checklist.push('CO')
  }

  return Array.from(new Set(checklist))
}

/**
 * Zod Schemas cho Step 1 & Step 2
 */
export const ShipmentGoodsItemSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1, 'Mô tả hàng hóa không được để trống'),
  hsCode: z.string().optional().default(''),
  orderIndex: z.number().int().default(0),
})

export const WizardStep1Schema = z.object({
  jobNo: z.string().min(3, 'Mã Job phải có tối thiểu 3 ký tự').max(50, 'Mã Job tối đa 50 ký tự'),
  departmentId: z.string().min(1, 'Vui lòng chọn phòng ban phụ trách'),
  mode: z.enum(['sea', 'air', 'road']).default('sea'),
  origin: z.string().min(1, 'Điểm đi (Origin) không được để trống'),
  destination: z.string().min(1, 'Điểm đến (Destination) không được để trống'),
}).refine((data) => data.origin.trim().toLowerCase() !== data.destination.trim().toLowerCase(), {
  message: 'Điểm đi và điểm đến không được trùng nhau',
  path: ['destination'],
})

export const WizardStep2Schema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().optional(),
  customerTaxCode: z.string().optional(),
  goods: z.array(ShipmentGoodsItemSchema).min(1, 'Bảng hàng hóa phải có tối thiểu 1 dòng'),
  blNo: z.string().optional().nullable(),
  etd: z.string().optional().nullable(),
  eta: z.string().optional().nullable(),
  carrier: z.string().optional().nullable(),
  vessel: z.string().optional().nullable(),
  voyage: z.string().optional().nullable(),
  containerNo: z.string().optional().nullable(),
  incoterms: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export type WizardStep1Input = z.infer<typeof WizardStep1Schema>
export type WizardStep2Input = z.infer<typeof WizardStep2Schema>

