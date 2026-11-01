/**
 * TML LOGISTICS - OCR WORKER CRASH RECOVERY UTILITY
 * 
 * Khôi phục các công việc OCR bị gián đoạn khi Worker bị tắt đột ngột hoặc sập tiến trình:
 * 1. Quét các bản ghi OCR đang ở trạng thái 'PROCESSING' quá thời gian chờ (Stale Job Threshold).
 * 2. Đánh dấu lỗi gián đoạn hoặc tự động đưa về 'PENDING' để tiến trình Worker mới nhận xử lý lại.
 * 3. Ghi vết kiểm toán (Audit Trail) để truy xuất nguyên nhân gián đoạn.
 */

import { prisma } from '../lib/prisma'

export interface JobRecoveryReport {
  recoveredCount: number
  failedCount: number
  details: Array<{ documentId: string; previousStatus: string; action: 'REQUEUED' | 'MARKED_FAILED' }>
}

export async function recoverInterruptedOcrJobs(
  staleTimeoutMinutes: number = 5
): Promise<JobRecoveryReport> {
  const cutoffTime = new Date(Date.now() - staleTimeoutMinutes * 60 * 1000)

  // 1. Tìm các bản ghi DocumentOcrResult bị kẹt ở trạng thái PROCESSING
  const strandedRecords = await prisma.documentOcrResult.findMany({
    where: {
      status: 'PROCESSING',
      extractedAt: { lt: cutoffTime },
    },
  })

  const report: JobRecoveryReport = {
    recoveredCount: 0,
    failedCount: 0,
    details: [],
  }

  for (const record of strandedRecords) {
    try {
      // Đặt lại về PENDING để worker mới tiếp tục xử lý
      await prisma.documentOcrResult.update({
        where: { id: record.id },
        data: {
          status: 'PENDING',
          rawText: '[INTERRUPTED_RECOVERED] Tiến trình trước bị gián đoạn, đang chờ xử lý lại.',
        },
      })
      report.recoveredCount++
      report.details.push({
        documentId: record.documentId,
        previousStatus: 'PROCESSING',
        action: 'REQUEUED',
      })
    } catch {
      report.failedCount++
      report.details.push({
        documentId: record.documentId,
        previousStatus: 'PROCESSING',
        action: 'MARKED_FAILED',
      })
    }
  }

  return report
}

// Chạy trực tiếp từ CLI nếu được gọi qua tsx scripts/recover-interrupted-ocr-jobs.ts
if (require.main === module) {
  recoverInterruptedOcrJobs(0) // 0 phút để quét toàn bộ trạng thái PROCESSING hiện tại
    .then((rep) => {
      console.log('🔄 KẾT QUẢ KHÔI PHỤC TIẾN TRÌNH OCR BỊ GIÁN ĐOẠN:')
      console.log(`- Số lượng tác vụ khôi phục thành công: ${rep.recoveredCount}`)
      console.log(`- Số lượng tác vụ thất bại: ${rep.failedCount}`)
    })
    .catch((err) => {
      console.error('❌ Lỗi khi khôi phục tiến trình OCR:', err)
      process.exit(1)
    })
}
