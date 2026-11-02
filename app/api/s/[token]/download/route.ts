import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'
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
      document: {
        include: { ocrResults: true },
      },
    },
  })

  if (!share || share.isRevoked) {
    return NextResponse.json({ error: 'Liên kết không tồn tại hoặc đã bị thu hồi.' }, { status: 404 })
  }

  if (share.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Liên kết chia sẻ đã hết hạn.' }, { status: 410 })
  }

  if (!share.allowDownload) {
    return NextResponse.json(
      { error: 'Tài liệu này chỉ cho phép xem trực tuyến, không được phép tải xuống.' },
      { status: 403 }
    )
  }

  if (share.maxViews && share.viewCount >= share.maxViews) {
    return NextResponse.json({ error: 'Liên kết này đã đạt giới hạn số lượt tải/xem cho phép.' }, { status: 403 })
  }

  // Khắc phục SEC-01: Kiểm tra Share Access Credential nếu link có mật khẩu
  if (share.passwordHash) {
    const cookieStore = await cookies()
    const cookieToken = cookieStore.get(`tml_share_access_${token}`)?.value
    const authHeader = req.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null

    const credential = cookieToken || bearerToken

    if (!credential) {
      return NextResponse.json(
        { error: 'Yêu cầu xác thực mật khẩu trước khi tải xuống tài liệu.' },
        { status: 401 }
      )
    }

    const verified = await verifyShareAccessToken(credential)
    if (!verified || verified.shareId !== share.id || verified.token !== share.token) {
      return NextResponse.json(
        { error: 'Chứng thực truy cập không hợp lệ hoặc đã hết hạn. Vui lòng xác thực lại mật khẩu.' },
        { status: 403 }
      )
    }
  }

  const { document: doc } = share

  // Lấy mimeType từ StorageObject đã lưu (không hardcode application/pdf)
  const storageObj = await prisma.storageObject.findUnique({
    where: { storageKey: doc.storageKey },
  })

  // Đọc file thông qua StorageProvider (không ghép đường dẫn từ doc.fileName)
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
    // Yêu cầu: file không tồn tại thì trả 404 và ghi audit FAILED. Cấm trả text OCR giả làm file.
    await prisma.auditLog.create({
      data: {
        orgId: doc.orgId,
        userId: share.createdBy,
        action: 'download',
        resourceType: 'document',
        resourceId: doc.id,
        status: 'FAILED',
        diffJson: JSON.stringify({ viaShareToken: token, reason: 'FILE_NOT_FOUND' }),
      },
    })
    return NextResponse.json({ error: 'Tập tin không tồn tại trên hệ thống lưu trữ.' }, { status: 404 })
  }

  // Tăng số lượt xem/tải theo cơ chế Atomic Concurrency Control (ngăn chặn race condition khi nhiều request đồng thời)
  if (share.maxViews !== null && share.maxViews !== undefined) {
    const updateResult = await prisma.documentShare.updateMany({
      where: {
        id: share.id,
        isRevoked: false,
        viewCount: { lt: share.maxViews },
      },
      data: { viewCount: { increment: 1 } },
    })

    if (updateResult.count === 0) {
      return NextResponse.json({ error: 'Liên kết này đã đạt giới hạn số lượt tải/xem cho phép.' }, { status: 403 })
    }
  } else {
    await prisma.documentShare.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    })
  }

  // Ghi Audit Log tải tài liệu qua link chia sẻ
  await prisma.auditLog.create({
    data: {
      orgId: doc.orgId,
      userId: share.createdBy,
      action: 'download',
      resourceType: 'document',
      resourceId: doc.id,
      status: 'SUCCESS',
      diffJson: JSON.stringify({ viaShareToken: token }),
    },
  })

  // Định dạng Content-Disposition chuẩn RFC 5987 / RFC 6266 (filename*=UTF-8''...)
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
