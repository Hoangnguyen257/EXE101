import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, SESSION_COOKIE_NAME } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { getStorageProvider } from '@/lib/storage/storage-provider'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Trích xuất token từ Authorization header hoặc Cookie trên Request nếu Next.js context chưa khởi tạo
  const authHeader = req.headers.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : undefined
  const cookieHeader = req.headers.get('cookie')
  const cookieToken = cookieHeader?.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))?.split('=')[1]
  const sessionUser = await getSessionUser(bearerToken || cookieToken)

  if (!sessionUser) {
    return NextResponse.json({ error: 'Chưa đăng nhập' }, { status: 401 })
  }

  const doc = await prisma.document.findUnique({
    where: { id },
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

  // 1. Lấy thông tin mimeType từ StorageObject đã lưu (không hardcode application/pdf)
  const storageObj = await prisma.storageObject.findUnique({
    where: { storageKey: doc.storageKey },
  })

  const provider = getStorageProvider()
  let fileBuffer: Buffer
  let contentType: string

  try {
    const exists = await provider.exists(doc.storageKey)
    if (!exists) {
      throw new Error('Tập tin không tồn tại trên hệ thống lưu trữ.')
    }
    const storageResult = await provider.get(doc.storageKey)
    fileBuffer = storageResult.buffer
    contentType = storageObj?.mimeType || storageResult.mimeType || 'application/octet-stream'
  } catch {
    // Yêu cầu: File không tồn tại thì trả 404 và ghi audit FAILED. Cấm trả text OCR giả làm file.
    await prisma.auditLog.create({
      data: {
        orgId: sessionUser.orgId,
        userId: sessionUser.id,
        action: 'download',
        resourceType: 'document',
        resourceId: doc.id,
        status: 'FAILED',
      },
    })
    return NextResponse.json(
      { error: 'Tập tin không tồn tại trên hệ thống lưu trữ.' },
      { status: 404 }
    )
  }

  // Ghi Audit Log thành công
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

  // Định dạng Content-Disposition chuẩn RFC 5987 / RFC 6266 (filename*=UTF-8''...)
  // Tuyệt đối không ghép đường dẫn từ doc.fileName
  const safeName = doc.fileName || 'document'
  const asciiFallback = safeName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const utf8Encoded = encodeURIComponent(safeName)
  const contentDisposition = `attachment; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`

  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', contentDisposition)
  headers.set('Content-Length', fileBuffer.length.toString())

  return new Response(fileBuffer, { headers })
}
