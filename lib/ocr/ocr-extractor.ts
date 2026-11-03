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
 * Chuẩn hóa ký tự và định dạng logistics, khôi phục bảng mã tiếng Việt bị lỗi (mojibake)
 */
export function normalizeLogisticsText(text: string): string {
  if (!text) return ''
  let normalized = text.normalize('NFC')

  // Khắc phục lỗi font đơn byte (WinAnsi/MacRoman) khi ghi chuỗi UTF-8 vào PDF
  const DIACRITIC_REPLACEMENTS: [RegExp, string][] = [
    [/V[ÆÂ]”›n\s*˜\s*˘¡n/gi, 'Vận đơn'],
    [/V[ÆÂ]”›n\s*đơn/gi, 'Vận đơn'],
    [/Hˆ‡a\s*˜\s*˘¡n/gi, 'Hóa đơn'],
    [/Hóa\s*˜\s*˘¡n/gi, 'Hóa đơn'],
    [/Phi[ÆÂ]”¿u\s*˜\s*ˆ‡ng\s*gˆ‡i/gi, 'Phiếu đóng gói'],
    [/Phiếu\s*đóng\s*gói/gi, 'Phiếu đóng gói'],
    [/Thˆ·ng\s*bˆ¡o\s*hˆ\s*ng\s*˜\s*[ÆÂ]”¿n/gi, 'Thông báo hàng đến'],
    [/Thông\s*báo\s*hàng\s*đến/gi, 'Thông báo hàng đến'],
    [/˜\s*˘\s*[ÆÂ]»\s*ng\s*bi[ÆÂ]»\s*n/gi, 'đường biển'],
    [/th˘\s*˘¡ng\s*m[ÆÂ]”¡i/gi, 'thương mại'],
    [/C[ẢA]NG\s*X[ẾE]P\s*H[ÀA]NG/gi, 'CẢNG XẾP HÀNG'],
    [/C[ẢA]NG\s*D[ỠO]\s*H[ÀA]NG/gi, 'CẢNG DỠ HÀNG'],
    [/L[ỆE]NH\s*GIAO\s*H[ÀA]NG\s*[ĐD]I[ỆE]N\s*T[ỬU]/gi, 'LỆNH GIAO HÀNG ĐIỆN TỬ'],
    [/T[ỜO]\s*KHAI\s*H[ẢA]I\s*QUAN/gi, 'TỜ KHAI HẢI QUAN'],
  ]

  for (const [pattern, replacement] of DIACRITIC_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement)
  }

  // Chuẩn hóa khoảng trống cuối dòng và hạn chế nhiều dòng trống liên tiếp
  return normalized
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

export interface PdfLayoutResult {
  text: string
  pageCount: number
  hasTextLayer: boolean
  isScannedImage: boolean
  pages: Array<{ pageNumber: number; text: string }>
}

/**
 * Trích xuất bố cục văn bản 2D đa chiều từ PDF (Preserving Layout & Tables)
 */
export async function extractTextFromPdfWithLayout(buffer: Buffer): Promise<PdfLayoutResult> {
  const result: PdfLayoutResult = {
    text: '',
    pageCount: 1,
    hasTextLayer: false,
    isScannedImage: false,
    pages: [],
  }

  try {
    const parser = new PDFParse({ data: buffer })
    const doc = await (parser as any).load()
    const numPages = doc.numPages || 1
    result.pageCount = numPages

    const extractedPageTexts: string[] = []

    for (let p = 1; p <= numPages; p++) {
      const page = await doc.getPage(p)
      const content = await page.getTextContent()
      const rawItems = (content.items || []).filter(
        (i: any) => typeof i?.str === 'string' && i.str.length > 0
      )

      let pageFormattedText = ''

      if (rawItems.length >= 2) {
        // Trích xuất theo tọa độ không gian 2D để tái tạo chuẩn xác bố cục tài liệu
        const items = [...rawItems].sort((a: any, b: any) => {
          const yDiff = b.transform[5] - a.transform[5]
          if (Math.abs(yDiff) > 3.5) return yDiff
          return a.transform[4] - b.transform[4]
        })

        const lines: Array<{ y: number; items: any[] }> = []
        let currentLine: any[] = []
        let currentY: number | null = null

        for (const item of items) {
          const itemY = item.transform[5]
          const itemH = item.height || 10

          if (currentY === null || Math.abs(itemY - currentY) <= Math.max(3.5, itemH * 0.4)) {
            currentLine.push(item)
            if (currentY === null) currentY = itemY
          } else {
            lines.push({ y: currentY, items: currentLine })
            currentLine = [item]
            currentY = itemY
          }
        }
        if (currentLine.length > 0 && currentY !== null) {
          lines.push({ y: currentY, items: currentLine })
        }

        const formattedLines: string[] = []
        let prevY: number | null = null

        for (const line of lines) {
          if (prevY !== null && prevY - line.y > 18) {
            formattedLines.push('') // Khoảng cách đoạn văn (Section break)
          }
          prevY = line.y

          line.items.sort((a, b) => a.transform[4] - b.transform[4])
          let lineStr = ''
          let lastX = 0

          for (const it of line.items) {
            const x = it.transform[4]
            if (lastX > 0) {
              const gap = x - lastX
              if (gap > 28) {
                lineStr += '    ' // Cột bảng (Table column tab)
              } else if (gap > 12) {
                lineStr += '  ' // Khoảng cách giữa các trường dữ liệu
              } else if (gap > 2 && !lineStr.endsWith(' ') && !it.str.startsWith(' ')) {
                lineStr += ' '
              }
            }
            lineStr += it.str
            lastX = x + (it.width || 0)
          }

          formattedLines.push(lineStr.trimEnd())
        }

        pageFormattedText = formattedLines.join('\n').trim()
      }

      // Nếu trang không có Text Layer (scan ảnh thuần túy hoặc chữ < 15 ký tự)
      const cleanChars = pageFormattedText.replace(/\s+/g, '')
      if (cleanChars.length < 15) {
        try {
          const shot = await parser.getScreenshot({ scale: 1.5 })
          const targetPageShot = shot.pages.find((sp: any) => sp.pageNumber === p) || shot.pages[p - 1]
          if (targetPageShot?.dataUrl) {
            const base64Data = targetPageShot.dataUrl.replace(/^data:image\/[a-z]+;base64,/, '')
            const imgBuffer = Buffer.from(base64Data, 'base64')
            const ocrRes = await recognizeImageWithTesseract(imgBuffer)
            if (ocrRes.text && ocrRes.text.length > 10) {
              pageFormattedText = ocrRes.text
              result.isScannedImage = true
            }
          }
        } catch (ocrErr) {
          console.warn(`Lỗi OCR dự phòng cho trang ${p}:`, ocrErr)
        }
      } else {
        result.hasTextLayer = true
      }

      const normalizedPage = normalizeLogisticsText(pageFormattedText)
      extractedPageTexts.push(normalizedPage)
      result.pages.push({ pageNumber: p, text: normalizedPage })

      if (typeof page.cleanup === 'function') {
        page.cleanup()
      }
    }

    await parser.destroy()
    result.text = extractedPageTexts.join('\n\n--- HẾT TRANG ---\n\n').trim()
    return result
  } catch (err) {
    console.warn('Lỗi phân tích cú pháp PDF layout, chuyển sang cơ chế fallback:', err)
    const fallback = extractTextFromBuffer(buffer, 'document.pdf')
    result.text = normalizeLogisticsText(fallback)
    return result
  }
}

/**
 * Trích xuất văn bản từ tập tin PDF có Text Layer bằng thư viện pdf-parse thật sự với bảo toàn định dạng
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const layoutResult = await extractTextFromPdfWithLayout(buffer)
  return layoutResult.text
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Sinh tài liệu HTML có cấu trúc chuẩn mực cho trình soạn thảo TipTap và giao diện xem chi tiết
 * Giữ nguyên bố cục gốc: Bảng biểu, các trường Logistics, khoảng cách dòng, cột và định dạng
 */
export function generateStructuredDocumentHtml(
  title: string,
  formattedText: string,
  logistics: ExtractedLogisticsData
): string {
  const safeTitle = escapeHtml(title)
  const safeText = escapeHtml(formattedText || '')

  const metaRows: string[] = []
  if (logistics.blNo) {
    metaRows.push(`<tr><td class="border border-slate-300 p-2 font-medium bg-slate-50">Số Vận đơn (B/L No):</td><td class="border border-slate-300 p-2 font-mono font-semibold text-primary">${escapeHtml(logistics.blNo)}</td></tr>`)
  }
  if (logistics.jobNo) {
    metaRows.push(`<tr><td class="border border-slate-300 p-2 font-medium bg-slate-50">Mã Lô hàng (Job No):</td><td class="border border-slate-300 p-2 font-mono font-semibold">${escapeHtml(logistics.jobNo)}</td></tr>`)
  }
  if (logistics.invoiceNo) {
    metaRows.push(`<tr><td class="border border-slate-300 p-2 font-medium bg-slate-50">Số Hóa đơn (Invoice):</td><td class="border border-slate-300 p-2 font-mono">${escapeHtml(logistics.invoiceNo)}</td></tr>`)
  }
  if (logistics.containerNo) {
    const allContainers = logistics.containers && logistics.containers.length > 1
      ? logistics.containers.join(', ')
      : logistics.containerNo
    metaRows.push(`<tr><td class="border border-slate-300 p-2 font-medium bg-slate-50">Số Container:</td><td class="border border-slate-300 p-2 font-mono font-semibold">${escapeHtml(allContainers)}</td></tr>`)
  }
  if (logistics.portOfLoading) {
    metaRows.push(`<tr><td class="border border-slate-300 p-2 font-medium bg-slate-50">Cảng xếp hàng (POL):</td><td class="border border-slate-300 p-2">${escapeHtml(logistics.portOfLoading)}</td></tr>`)
  }
  if (logistics.portOfDischarge) {
    metaRows.push(`<tr><td class="border border-slate-300 p-2 font-medium bg-slate-50">Cảng dỡ hàng (POD):</td><td class="border border-slate-300 p-2">${escapeHtml(logistics.portOfDischarge)}</td></tr>`)
  }
  if (logistics.vesselName) {
    metaRows.push(`<tr><td class="border border-slate-300 p-2 font-medium bg-slate-50">Tàu &amp; Chuyến (Vessel/Voy):</td><td class="border border-slate-300 p-2 font-mono">${escapeHtml(logistics.vesselName)}</td></tr>`)
  }
  if (logistics.docDate) {
    metaRows.push(`<tr><td class="border border-slate-300 p-2 font-medium bg-slate-50">Ngày chứng từ:</td><td class="border border-slate-300 p-2 font-mono">${escapeHtml(logistics.docDate)}</td></tr>`)
  }

  let metaTableHtml = ''
  if (metaRows.length > 0) {
    metaTableHtml = `
      <div class="ocr-meta-section my-4">
        <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Thông tin nghiệp vụ Logistics</h3>
        <table class="border-collapse border border-slate-300 w-full text-sm">
          <tbody>
            ${metaRows.join('')}
          </tbody>
        </table>
      </div>
    `
  }

  const textBodyHtml = `
    <div class="ocr-content-section my-4">
      <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Nội dung văn bản nhận dạng</h3>
      <pre class="font-mono text-sm leading-relaxed whitespace-pre-wrap p-4 bg-slate-50/80 rounded-lg border border-slate-200 text-slate-800">${safeText}</pre>
    </div>
  `

  return `
    <div class="ocr-document-wrapper">
      <h2 class="text-xl font-bold text-slate-900 border-b pb-2 mb-3">${safeTitle}</h2>
      ${metaTableHtml}
      ${textBodyHtml}
    </div>
  `.trim()
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

  // Đối với PDF: trích xuất các chuỗi text stream hiển thị trong PDF syntax với bảo tồn ngắt dòng
  if (ext === '.pdf') {
    const extractedLines: string[] = []
    let currentLineChunks: string[] = []

    // Match các khối chữ (Text) Tj, [(T)(e)] TJ, và toán tử ngắt dòng Td, TD, T*
    const tokenRegex = /(\((?:[^)\\]|\\.)*\)\s*Tj|\[([^\]]*)\]\s*TJ|(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(?:Td|TD)|T\*)/g
    let match: RegExpExecArray | null

    while ((match = tokenRegex.exec(textContent)) !== null) {
      const token = match[0]

      if (token.includes('Tj')) {
        const textMatch = token.match(/\((.*?)\)\s*Tj/)
        if (textMatch && textMatch[1].trim()) {
          currentLineChunks.push(textMatch[1].replace(/\\([()\\])/g, '$1'))
        }
      } else if (token.includes('TJ')) {
        const innerArray = match[2] || ''
        const parts = innerArray.match(/\((.*?)\)/g)
        if (parts) {
          const str = parts.map((p) => p.slice(1, -1).replace(/\\([()\\])/g, '$1')).join('')
          if (str.trim()) currentLineChunks.push(str)
        }
      } else if (token.includes('Td') || token.includes('TD') || token === 'T*') {
        if (currentLineChunks.length > 0) {
          extractedLines.push(currentLineChunks.join('   '))
          currentLineChunks = []
        }
      }
    }

    if (currentLineChunks.length > 0) {
      extractedLines.push(currentLineChunks.join('   '))
    }

    if (extractedLines.length > 0) {
      return normalizeLogisticsText(extractedLines.join('\n'))
    }

    // Nếu không khớp toán tử PDF cấu trúc, lọc các chuỗi ascii/unicode có nghĩa
    const asciiMatches = textContent.match(/[A-Za-z0-9\s.,/#:;_\-()]{4,}/g)
    if (asciiMatches && asciiMatches.length > 10) {
      return normalizeLogisticsText(asciiMatches.slice(0, 200).join('\n'))
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

