/**
 * OCR Structured Information Extractor for Logistics Documents
 * TML - Text Mining Library
 */

import { PDFParse } from 'pdf-parse'
import { createWorker } from 'tesseract.js'

export interface ExtractedLogisticsData {
  jobNo?: string
  blNo?: string
  invoiceNo?: string
  containerNo?: string
  containers?: string[]
  portOfLoading?: string
  portOfDischarge?: string
  docDate?: string
  vesselName?: string
  goodsDescription?: string
  confidenceScore: number
  matchedFields: string[]
}

// Regex chuẩn cho các định dạng vận tải quốc tế (hỗ trợ có dấu cách hoặc gạch ngang)
const CONTAINER_REGEX = /\b([A-Z]{4})[\s-]?(\d{6})[\s-]?(\d{1})\b/gi
const BL_REGEX = /(?:B\/L|BILL\s*OF\s*LADING|(?:SEA\s*|AIR\s*)?WAYBILL|AWB)(?:\s*(?:NO|NUMBER|#|SỐ))?[ \t.:#-]*((?=[A-Z0-9/-]*\d)[A-Z0-9/-]{6,25})\b/i
const BL_STANDALONE_REGEX = /\b([A-Z]{4}\d{8,12})\b/
const JOB_REGEX = /(?:JOB\s*(?:NO|NUMBER|#)?|REF\s*(?:NO|#)?|MÃ\s*(?:QUẢN\s*LÝ\s*)?LÔ\s*HÀNG)[\s.:#-]*([A-Z0-9-]{6,25})\b/iu
const INVOICE_REGEX = /(?:(?:COMMERCIAL\s*)?INV(?:OICE)?|HÓA\s*ĐƠN)(?:\s*(?:NO|NUMBER|#|SỐ|GTGT))?[ \t.:#-]+([A-Z0-9-]{4,25})\b/iu
const POL_REGEX = /(?:PORT\s*OF\s*LOADING|POL|CẢNG\s*XẾP\s*HÀNG)(?:\s*\([A-Z]+\))?[\s.:#-]*([A-Za-z0-9\s,./()À-ỹ-]{3,60})(?:\n|\r|$)/iu
const POD_REGEX = /(?:PORT\s*OF\s*DISCHARGE|POD|CẢNG\s*DỠ\s*HÀNG)(?:\s*\([A-Z]+\))?[\s.:#-]*([A-Za-z0-9\s,./()À-ỹ-]{3,60})(?:\n|\r|$)/iu
const DATE_REGEX = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})\b/
const VESSEL_REGEX = /(?:VESSEL|TÀU|FEEDER)[\s.:-]*([A-Z0-9\s.-]{3,30})(?:\s*V\.|VOY|VOYAGE|$)/i

/**
 * Trích xuất các trường thông tin logistics trọng yếu từ văn bản thô
 */
export function extractLogisticsFields(rawText: string): ExtractedLogisticsData {
  if (!rawText || !rawText.trim()) {
    return {
      confidenceScore: 0,
      matchedFields: [],
    }
  }

  const result: ExtractedLogisticsData = {
    confidenceScore: 0,
    matchedFields: [],
  }

  let totalScore = 0
  let maxPossibleScore = 0

  // 1. Container Number (ISO 6346 standard)
  const containerMatches = Array.from(rawText.matchAll(CONTAINER_REGEX)).map(
    (m) => `${m[1]}${m[2]}${m[3]}`.toUpperCase()
  )
  if (containerMatches.length > 0) {
    const uniqueContainers = Array.from(new Set(containerMatches))
    result.containerNo = uniqueContainers[0]
    result.containers = uniqueContainers
    result.matchedFields.push('containerNo')
    totalScore += 25
  }
  maxPossibleScore += 25

  // 2. Bill of Lading (B/L Number)
  const blMatch = rawText.match(BL_REGEX) || rawText.match(BL_STANDALONE_REGEX)
  if (blMatch) {
    result.blNo = blMatch[1].trim()
    result.matchedFields.push('blNo')
    totalScore += 25
  }
  maxPossibleScore += 25

  // 3. Job Number
  const jobMatch = rawText.match(JOB_REGEX)
  if (jobMatch) {
    result.jobNo = jobMatch[1].trim()
    result.matchedFields.push('jobNo')
    totalScore += 15
  } else {
    // Tìm pattern phổ biến TML-SE...
    const tmlJobMatch = rawText.match(/\b(TML-[A-Z0-9]+-\d+)\b/i)
    if (tmlJobMatch) {
      result.jobNo = tmlJobMatch[1].trim()
      result.matchedFields.push('jobNo')
      totalScore += 15
    }
  }
  maxPossibleScore += 15

  // 4. Invoice Number
  const invMatch = rawText.match(INVOICE_REGEX)
  if (invMatch) {
    result.invoiceNo = invMatch[1].trim()
    result.matchedFields.push('invoiceNo')
    totalScore += 10
  }
  maxPossibleScore += 10

  // 5. Port of Loading (POL)
  const polMatch = rawText.match(POL_REGEX)
  if (polMatch) {
    const cleanPol = polMatch[1].replace(/[\n\r]/g, ' ').trim()
    if (cleanPol.length >= 3 && cleanPol.length <= 60) {
      result.portOfLoading = cleanPol
      result.matchedFields.push('portOfLoading')
      totalScore += 10
    }
  }
  maxPossibleScore += 10

  // 6. Port of Discharge (POD)
  const podMatch = rawText.match(POD_REGEX)
  if (podMatch) {
    const cleanPod = podMatch[1].replace(/[\n\r]/g, ' ').trim()
    if (cleanPod.length >= 3 && cleanPod.length <= 60) {
      result.portOfDischarge = cleanPod
      result.matchedFields.push('portOfDischarge')
      totalScore += 10
    }
  }
  maxPossibleScore += 10

  // 7. Document Date
  const dateMatch = rawText.match(DATE_REGEX)
  if (dateMatch) {
    result.docDate = dateMatch[1].trim()
    result.matchedFields.push('docDate')
    totalScore += 5
  }
  maxPossibleScore += 5

  // Tính điểm tin cậy tổng thể (Percentage: 0 - 100%)
  const hasCoreLogisticsField = Boolean(
    result.containerNo || result.blNo || result.jobNo || result.invoiceNo
  )
  const rawConfidence = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0
  const minFloor = hasCoreLogisticsField ? 50 : 20
  result.confidenceScore = Math.min(98, Math.max(minFloor, Math.round(rawConfidence)))

  return result
}

/**
 * Trích xuất văn bản từ tập tin PDF có Text Layer bằng thư viện pdf-parse thật sự
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const parser = new PDFParse({ data: buffer })
    const data = await parser.getText()
    await parser.destroy()
    return (data.text || '').replace(/-- \d+ of \d+ --/g, '').trim()
  } catch (err) {
    console.warn('Lỗi phân tích cú pháp PDF qua pdf-parse, chuyển sang cơ chế fallback:', err)
    return ''
  }
}

/**
 * Nhận dạng ký tự quang học (OCR) thực sự cho tập tin hình ảnh sử dụng Tesseract.js Worker
 */
export async function recognizeImageWithTesseract(
  imageBuffer: Buffer,
  lang = 'vie+eng'
): Promise<{ text: string; confidence: number }> {
  try {
    const worker = await createWorker(lang)
    try {
      const ret = await worker.recognize(imageBuffer)
      return {
        text: (ret.data.text || '').trim(),
        confidence: ret.data.confidence || 0,
      }
    } finally {
      await worker.terminate()
    }
  } catch (err) {
    console.error('Lỗi nhận dạng Tesseract.js Worker:', err)
    return { text: '', confidence: 0 }
  }
}

/**
 * Trích xuất text bất đồng bộ tối ưu (Async Real Pipeline):
 * - PDF có text layer: Dùng pdf-parse thực sự
 * - File ảnh (PNG/JPG/BMP): Dùng Tesseract.js OCR thật
 * - Văn bản thuần (TXT/CSV): Đọc chuỗi UTF-8
 */
export async function extractTextFromBufferAsync(buffer: Buffer, fileName: string): Promise<string> {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))

  if (ext === '.txt' || ext === '.csv') {
    return buffer.toString('utf-8', 0, Math.min(buffer.length, 100000))
  }

  if (ext === '.pdf') {
    const parsedText = await extractTextFromPdf(buffer)
    if (parsedText && parsedText.length >= 10) {
      return parsedText
    }
    // Nếu pdf-parse không đọc được do PDF scan ảnh hoặc định dạng synthetic trong test:
    const fallbackText = extractTextFromBuffer(buffer, fileName)
    if (fallbackText && fallbackText !== `Chứng từ: ${fileName}`) {
      return fallbackText
    }
    return parsedText || fallbackText
  }

  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.bmp') {
    const ocrResult = await recognizeImageWithTesseract(buffer)
    if (ocrResult.text && ocrResult.text.length > 5) {
      return ocrResult.text
    }
  }

  return extractTextFromBuffer(buffer, fileName)
}

/**
 * Trích xuất text từ buffer file tải lên (hỗ trợ text layer của PDF hoặc text thuần)
 */
export function extractTextFromBuffer(buffer: Buffer, fileName: string): string {
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'))
  const textContent = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000))

  // Nếu file là text hoặc có text stream
  if (ext === '.txt' || ext === '.csv') {
    return textContent
  }

  // Đối với PDF: trích xuất các chuỗi text stream hiển thị trong PDF syntax
  if (ext === '.pdf') {
    const extractedChunks: string[] = []
    // Match text blocks bên trong PDF: (Text content) Tj hoặc [(T)(e)(x)(t)] TJ
    const tjRegex = /\(([^)]+)\)\s*Tj/g
    let match
    while ((match = tjRegex.exec(textContent)) !== null) {
      if (match[1] && match[1].length > 1) {
        extractedChunks.push(match[1])
      }
    }

    if (extractedChunks.length > 5) {
      return extractedChunks.join(' ')
    }

    // Nếu PDF không có text stream rõ ràng, trích xuất chuỗi ascii/unicode có nghĩa
    const asciiMatches = textContent.match(/[A-Za-z0-9\s.,/#:;_\-()]{4,}/g)
    if (asciiMatches && asciiMatches.length > 10) {
      return asciiMatches.slice(0, 200).join(' ')
    }
  }

  return `Chứng từ: ${fileName}`
}

export const extractLogisticsFieldsFromText = extractLogisticsFields

export interface PdfTypeAnalysis {
  isPdf: boolean
  hasTextLayer: boolean
  isScannedImage: boolean
  pageCountEstimate: number
  containsSuspiciousElements: boolean
  suspiciousReasons: string[]
}

/**
 * Phân tích định dạng PDF: Phân định PDF có Text Layer sẵn và PDF scan thuần ảnh
 * Đồng thời kiểm tra tính an toàn cấu trúc (chống PDF bomb, embedded JavaScript)
 */
export function detectPdfType(buffer: Buffer): PdfTypeAnalysis {
  if (buffer.length < 4 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
    return {
      isPdf: false,
      hasTextLayer: false,
      isScannedImage: false,
      pageCountEstimate: 0,
      containsSuspiciousElements: false,
      suspiciousReasons: ['Không phải định dạng PDF hợp lệ'],
    }
  }

  const str = buffer.toString('latin1', 0, Math.min(buffer.length, 500000))

  // 1. Kiểm tra phần tử độc hại / PDF Exploit / Launch Action
  const suspiciousReasons: string[] = []
  if (str.includes('/JavaScript') || str.includes('/JS ')) {
    suspiciousReasons.push('Chứa mã kịch bản nhúng (/JavaScript hoặc /JS)')
  }
  if (str.includes('/Launch ')) {
    suspiciousReasons.push('Chứa lệnh thực thi hệ thống nguy hiểm (/Launch)')
  }
  if (str.includes('/EmbeddedFiles')) {
    suspiciousReasons.push('Chứa tập tin nhúng ẩn (/EmbeddedFiles)')
  }

  // 2. Ước lượng số trang PDF
  const pageMatches = str.match(/\/Type\s*\/Page\b/g)
  const pageCount = pageMatches ? pageMatches.length : 1

  // 3. Phân định Text Layer và Raster Image
  const hasFont = str.includes('/Font') || str.includes('/BaseFont')
  const hasTextOps = /\(([^)]+)\)\s*Tj/g.test(str) || /\[([^\]]+)\]\s*TJ/g.test(str) || /BT[\s\S]*?ET/g.test(str)

  const textExtract = extractTextFromBuffer(buffer, 'test.pdf')
  const actualTextWords = textExtract.replace(/Chứng từ: test\.pdf/g, '').trim().split(/\s+/).filter(Boolean)
  const hasSufficientText = actualTextWords.length >= 8

  const hasImage = str.includes('/Subtype/Image') || str.includes('/Subtype /Image') || str.includes('/DCTDecode') || str.includes('/JPXDecode')

  const hasTextLayer = (hasFont || hasTextOps) && hasSufficientText
  const isScannedImage = !hasTextLayer || (hasImage && actualTextWords.length < 5)

  return {
    isPdf: true,
    hasTextLayer,
    isScannedImage,
    pageCountEstimate: pageCount,
    containsSuspiciousElements: suspiciousReasons.length > 0,
    suspiciousReasons,
  }
}

