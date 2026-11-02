import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { getStorageProvider } from '@/lib/storage/storage-provider'
import { OCRWorkerService } from '@/lib/ocr/ocr-worker'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionUser = await getSessionUser(req)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    include: { shipment: { include: { participants: true } } },
  })

  if (!doc || doc.isDeleted) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại hoặc đã bị xóa.' }, { status: 404 })
  }

  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'EDIT', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
    ownerId: doc.shipment?.ownerId,
    assignedUserIds: doc.shipment?.participants?.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền yêu cầu OCR cho chứng từ này.' }, { status: 403 })
  }

  try {
    const storage = getStorageProvider()
    const fileResult = await storage.get(doc.storageKey)
    const fileBuffer = fileResult.buffer

    // Đưa vào hàng đợi với trạng thái PENDING
    const job = await OCRWorkerService.enqueueJob(doc.id, doc.fileName, fileBuffer)

    // Khởi chạy ngầm tiến trình xử lý OCR
    OCRWorkerService.processJob(job.id, fileBuffer).catch((err) => {
      console.error(`Background OCR Job ${job.id} failed:`, err)
    })

    return NextResponse.json({
      success: true,
      message: 'Đã tiếp nhận yêu cầu OCR vào hàng đợi xử lý.',
      jobId: job.id,
      status: job.status,
    })
  } catch (error: any) {
    console.error('Lỗi khởi tạo tác vụ OCR:', error)
    return NextResponse.json({ error: error.message || 'Lỗi khi khởi tạo OCR.' }, { status: 500 })
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionUser = await getSessionUser(req)
  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      shipment: { include: { participants: true } },
      ocrResults: { orderBy: { extractedAt: 'desc' }, take: 1 },
    },
  })

  if (!doc || doc.isDeleted) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại.' }, { status: 404 })
  }

  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'VIEW', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
    ownerId: doc.shipment?.ownerId,
    assignedUserIds: doc.shipment?.participants?.map((p) => p.userId),
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: 'Không có quyền truy cập.' }, { status: 403 })
  }

  const latestOcr = doc.ocrResults[0]
  return NextResponse.json({
    documentId: doc.id,
    ocrResult: latestOcr
      ? {
          status: latestOcr.status,
          confidenceScore: latestOcr.confidenceScore,
          rawText: latestOcr.rawText,
          structuredData: latestOcr.structuredData ? JSON.parse(latestOcr.structuredData) : null,
          extractedAt: latestOcr.extractedAt.toISOString(),
        }
      : null,
  })
}

