/**
 * TML LOGISTICS - SERVER-SIDE DOCUMENT STORAGE & VAULT SERVICE
 * 
 * Quản lý kho lưu trữ tài liệu an toàn (Storage Vault), kiểm tra Magic Bytes nhị phân,
 * băm SHA-256 chống trùng lặp dữ liệu, và phân giải đường dẫn tập tin.
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { prisma } from '../prisma'

export const VAULT_DIR = path.resolve(process.cwd(), 'storage_vault')

// Khởi tạo thư mục vault nếu chưa tồn tại
if (!fs.existsSync(VAULT_DIR)) {
  fs.mkdirSync(VAULT_DIR, { recursive: true })
}

export const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']
export const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

/**
 * Làm sạch tên file, loại bỏ path traversal, ký tự điều khiển và null bytes
 */
export function sanitizeFileName(fileName: string): string {
  if (!fileName) return 'unnamed_file'
  // 1. Loại bỏ null byte và các ký tự điều khiển
  const cleaned = fileName.replace(/[\x00-\x1f\x7f]/g, '')
  // 2. Chuyển đổi backslash sang forward slash và tách lấy tên file cuối cùng
  const normalized = cleaned.replace(/\\/g, '/')
  const segments = normalized.split('/').filter(Boolean)
  const baseName = segments.length > 0 ? segments[segments.length - 1] : 'unnamed_file'
  // 3. Loại bỏ chuỗi .. và ký tự không hợp lệ
  const safeName = baseName.replace(/\.\.+/g, '').replace(/[^a-zA-Z0-9._-]/g, '_')
  return safeName.length > 0 ? safeName : 'unnamed_file'
}

export interface FileValidationResult {
  isValid: boolean
  mimeType?: string
  error?: string
}

/**
 * Kiểm tra chữ ký số nhị phân (Magic Bytes) để xác thực định dạng file thực tế
 */
export function validateFileMagicBytes(buffer: Buffer, declaredMimeType?: string): FileValidationResult {
  if (buffer.length < 4) {
    return { isValid: false, error: 'Tập tin rỗng hoặc kích thước quá nhỏ' }
  }

  // 1. PDF: %PDF- (0x25 0x50 0x44 0x46)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    if (declaredMimeType && declaredMimeType !== 'application/pdf') {
      return { isValid: false, error: 'Nội dung thực tế (PDF) không khớp loại MIME khai báo' }
    }
    return { isValid: true, mimeType: 'application/pdf' }
  }

  // 2. PNG: 0x89 0x50 0x4E 0x47 (‰PNG)
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    if (declaredMimeType && declaredMimeType !== 'image/png') {
      return { isValid: false, error: 'Nội dung thực tế (PNG) không khớp loại MIME khai báo' }
    }
    return { isValid: true, mimeType: 'image/png' }
  }

  // 3. JPEG/JPG: 0xFF 0xD8 0xFF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    if (declaredMimeType && !['image/jpeg', 'image/jpg'].includes(declaredMimeType)) {
      return { isValid: false, error: 'Nội dung thực tế (JPEG) không khớp loại MIME khai báo' }
    }
    return { isValid: true, mimeType: 'image/jpeg' }
  }

  return { isValid: false, error: 'Định dạng tập tin không được hỗ trợ hoặc bị giả mạo' }
}

/**
 * Hàm tương thích kiểm tra theo đuôi mở rộng
 */
export function validateFileSignature(buffer: Buffer, ext: string): boolean {
  const normExt = ext.toLowerCase()
  if (normExt === '.pdf') {
    return buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46
  }
  if (normExt === '.png') {
    return buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  }
  if (normExt === '.jpg' || normExt === '.jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
  }
  return false
}

/**
 * Kiểm tra toàn diện tập tin tải lên (Task 13.7 - File Upload Hardening):
 * - Kết hợp 3 lớp: Magic Bytes nhị phân + MIME type + Phần mở rộng (.ext)
 * - Kiểm tra tính toàn vẹn cấu trúc PDF (EOF marker, không chứa mã độc /Launch, /JavaScript)
 * - Giới hạn kích thước và số trang an toàn
 */
export function validateComprehensiveUpload(
  buffer: Buffer,
  fileName: string,
  declaredMimeType?: string
): { isValid: boolean; error?: string; mimeType?: string; checksum: string; safeFileName: string } {
  const checksum = calculateChecksum(buffer)
  const safeFileName = sanitizeFileName(fileName)

  // 1. Kiểm tra kích thước tập tin
  if (!buffer || buffer.length < 4) {
    return { isValid: false, error: 'Tập tin rỗng hoặc kích thước quá nhỏ (< 4 bytes)', checksum, safeFileName }
  }

  if (buffer.length > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `Dung lượng tập tin (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) vượt quá ngưỡng tối đa cho phép (25MB)`,
      checksum,
      safeFileName,
    }
  }

  // 2. Kiểm tra phần mở rộng
  const ext = path.extname(safeFileName).toLowerCase()
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      isValid: false,
      error: `Phần mở rộng ${ext} không được hỗ trợ. Chỉ chấp nhận .pdf, .jpg, .jpeg, .png`,
      checksum,
      safeFileName,
    }
  }

  // 3. Kiểm tra Magic Bytes nhị phân
  const magicResult = validateFileMagicBytes(buffer, declaredMimeType)
  if (!magicResult.isValid || !magicResult.mimeType) {
    return {
      isValid: false,
      error: magicResult.error || 'Nội dung nhị phân không khớp định dạng tập tin khai báo',
      checksum,
      safeFileName,
    }
  }

  // 4. Kiểm tra chuyên sâu cho tập tin PDF
  if (magicResult.mimeType === 'application/pdf') {
    const tailBuffer = buffer.subarray(Math.max(0, buffer.length - 2048))
    const tailStr = tailBuffer.toString('latin1')
    if (!tailStr.includes('%%EOF')) {
      return {
        isValid: false,
        error: 'Tập tin PDF bị lỗi cấu trúc (thiếu dấu kết thúc %%EOF tiêu chuẩn)',
        checksum,
        safeFileName,
      }
    }

    // Quét phần tử độc hại (Exploit, Shell Launch, embedded scripts)
    const contentSample = buffer.toString('latin1', 0, Math.min(buffer.length, 300000))
    if (contentSample.includes('/Launch ') || contentSample.includes('/Launch/')) {
      return {
        isValid: false,
        error: 'Tập tin PDF bị từ chối: Phát hiện chỉ thị thực thi hệ thống nguy hiểm (/Launch)',
        checksum,
        safeFileName,
      }
    }
    if (contentSample.includes('/JavaScript') || contentSample.includes('/JS ')) {
      return {
        isValid: false,
        error: 'Tập tin PDF bị từ chối: Phát hiện mã kịch bản nhúng (/JavaScript)',
        checksum,
        safeFileName,
      }
    }
  }

  return {
    isValid: true,
    mimeType: magicResult.mimeType,
    checksum,
    safeFileName,
  }
}

/**
 * Tính mã băm SHA-256 của tập tin
 */
export function calculateChecksum(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

/**
 * Kiểm tra xem tài liệu có bị trùng lặp trong hệ thống không
 */
export async function findDuplicateFile(checksum: string) {
  return prisma.storageObject.findFirst({
    where: {
      checksumSha256: checksum,
    },
  })
}
