import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyShareAccessToken } from '@/lib/auth/jwt'
import { getStorageProvider } from '@/lib/storage/storage-provider'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const share = await prisma.documentShare.findUnique({
    where: { token },
    include: {
      document: true,
    },
  })

  // Chứng từ đã xóa mềm hoặc không tồn tại hoặc link bị thu hồi -> 404
  if (!share || share.isRevoked || !share.document || share.document.isDeleted) {
    return NextResponse.json({ error: 'Liên kết không tồn tại hoặc tài liệu đã bị xóa.' }, { status: 404 })
  }

  if (share.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Liên kết chia sẻ đã hết hạn.' }, { status: 410 })
  }

  if (share.maxViews && share.viewCount >= share.maxViews) {
    return NextResponse.json({ error: 'Liên kết này đã đạt giới hạn số lượt xem cho phép.' }, { status: 403 })
  }

  // Kiểm tra Share Access Credential nếu link có mật khẩu bảo vệ
  if (share.passwordHash) {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get(`tml_share_access_${token}`)?.value
    const authHeader = req.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

    const credential = cookieToken || bearerToken

    if (!credential) {
      return NextResponse.json(
        { error: 'Yêu cầu xác thực mật khẩu trước khi xem nội dung tài liệu.' },
        { status: 401 }
      )
    }

    const verified = await verifyShareAccessToken(credential)
    if (!verified || verified.shareId !== share.id || verified.token !== share.token) {
      return NextResponse.json(
        { error: 'Chứng thực truy cập không hợp lệ hoặc đã hết hạn.' },
        { status: 403 }
      )
    }
  }

  const { document: doc } = share

  const storageObj = await prisma.storageObject.findUnique({
    where: { storageKey: doc.storageKey },
  })

  const provider = getStorageProvider()
  let fileBuffer: Buffer
  let contentType: string

  try {
    const exists = await provider.exists(doc.storageKey)
    if (!exists) {
      return NextResponse.json({ error: 'Tập tin không tồn tại trên hệ thống lưu trữ.' }, { status: 404 })
    }
    const storageResult = await provider.get(doc.storageKey)
    fileBuffer = storageResult.buffer
    contentType = storageObj?.mimeType || storageResult.mimeType || 'application/octet-stream'
  } catch {
    return NextResponse.json({ error: 'Không thể truy xuất tập tin từ hệ thống lưu trữ.' }, { status: 404 })
  }

  // Thiết lập Header để hiển thị trực tiếp (Inline) trên trình duyệt thay vì ép tải về
  const safeName = doc.fileName || 'document'
  const asciiFallback = safeName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const utf8Encoded = encodeURIComponent(safeName)
  const contentDisposition = `inline; filename="${asciiFallback}"; filename*=UTF-8''${utf8Encoded}`

  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', contentDisposition)
  headers.set('Content-Length', fileBuffer.length.toString())
  headers.set('Cache-Control', 'private, max-age=3600')

  return new Response(fileBuffer, { headers })
}
