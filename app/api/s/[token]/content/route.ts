import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { verifyShareAccessToken } from '@/lib/auth/jwt'

export const dynamic = 'force-dynamic'

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const share = await prisma.documentShare.findUnique({
    where: { token },
    include: {
      document: {
        include: {
          ocrResults: { take: 1, orderBy: { extractedAt: 'desc' } },
        },
      },
    },
  })

  if (!share || share.isRevoked || !share.document || share.document.isDeleted) {
    return NextResponse.json({ error: 'Liên kết không tồn tại hoặc tài liệu đã bị xóa.' }, { status: 404 })
  }

  if (share.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Liên kết chia sẻ đã hết hạn.' }, { status: 410 })
  }

  if (share.maxViews && share.viewCount >= share.maxViews) {
    return NextResponse.json({ error: 'Liên kết này đã đạt giới hạn số lượt xem cho phép.' }, { status: 403 })
  }

  // Khắc phục SEC-02: Nếu link có mật khẩu, bắt buộc phải có Share Access Token hợp lệ
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

  // Tăng số lượt xem theo cơ chế Atomic Concurrency Control (ngăn chặn race condition khi nhiều request đồng thời)
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
      return NextResponse.json({ error: 'Liên kết này đã đạt giới hạn số lượt xem cho phép.' }, { status: 403 })
    }
  } else {
    await prisma.documentShare.update({
      where: { id: share.id },
      data: { viewCount: { increment: 1 } },
    })
  }

  const { document: doc } = share
  const ocrText = doc.ocrResults[0]?.rawText || ''

  return NextResponse.json({
    success: true,
    title: doc.title,
    fileName: doc.fileName,
    pages: doc.pages,
    ocrText,
    structuredData: doc.ocrResults[0]?.structuredData || null,
  })
}
