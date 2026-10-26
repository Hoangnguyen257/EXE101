import type { Metadata } from 'next'
import { OcrContent } from '@/components/scan/ocr-content'

export const metadata: Metadata = { title: 'Nhận dạng chữ (OCR)' }

export default function OcrPage() {
  return <OcrContent />
}
