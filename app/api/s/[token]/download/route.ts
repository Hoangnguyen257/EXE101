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

  // Đọc file thông qua StorageProvider
  const provider = getStorageProvider()
  let fileBuffer: Buffer
  let contentType = 'application/pdf'

  try {
    const storageResult = await provider.get(doc.storageKey)
    fileBuffer = storageResult.buffer
    contentType = storageResult.mimeType || 'application/pdf'
  } catch {
    const content = doc.ocrResults[0]?.rawText || `TML DOCMANAGER: ${doc.title}\nJob: ${doc.shipmentId}`
    fileBuffer = Buffer.from(content, 'utf-8')
    contentType = 'text/plain;charset=utf-8'
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

  const headers = new Headers()
  headers.set('Content-Type', contentType)
  headers.set('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`)
  headers.set('Content-Length', fileBuffer.length.toString())

  return new Response(fileBuffer, { headers })
}
