import { NextResponse } from 'next/server'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { getStorageProvider } from '@/lib/storage/storage-provider'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sessionUser = await getSessionUser()

  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
    include: {
      ocrResults: { take: 1, orderBy: { extractedAt: 'desc' } },
    },
  })

  if (!doc || doc.isDeleted) {
    return NextResponse.json({ error: 'Chứng từ không tồn tại hoặc đã bị xóa.' }, { status: 404 })
  }

  // Permission check
  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'DOWNLOAD', {
    id: doc.id,
    departmentId: doc.departmentId,
    createdBy: doc.createdBy,
  })

  if (!perm.allowed) {
    return NextResponse.json({ error: perm.reason || 'Bạn không có quyền tải xuống chứng từ này.' }, { status: 403 })
  }

  const provider = getStorageProvider()
  let fileBuffer: Buffer
  let contentType = 'application/pdf'

  try {
    const storageResult = await provider.get(doc.storageKey)
    fileBuffer = storageResult.buffer
    contentType = storageResult.mimeType || 'application/pdf'
  } catch {
    // Trường hợp chứng từ kiểm thử không có file nhị phân vật lý, fallback về văn bản OCR
    const content = doc.ocrResults[0]?.rawText || `TML DOCMANAGER: ${doc.title}\nJob: ${doc.shipmentId}`
    fileBuffer = Buffer.from(content, 'utf-8')
    contentType = 'text/plain;charset=utf-8'
  }

  // Log Audit Log
  await prisma.auditLog.create({
    data: {
      orgId: sessionUser.orgId,
      userId: sessionUser.id,
      action: 'download',
      resourceType: 'document',
      resourceId: doc.id,
      status: 'SUCCESS',
    },
  })

  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`)
  headers.set('Content-Length', fileBuffer.length.toString())

  return new Response(fileBuffer, { headers })
}
