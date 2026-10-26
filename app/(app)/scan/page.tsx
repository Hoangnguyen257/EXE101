import type { Metadata } from 'next'
import { ScanContent } from '@/components/scan/scan-content'

export const metadata: Metadata = { title: 'Quét chứng từ' }

export default function ScanPage() {
  return <ScanContent />
}
