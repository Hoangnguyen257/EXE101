import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { PublicDocViewer } from './public-doc-viewer'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const share = await prisma.documentShare.findUnique({
    where: { token },
    include: { document: true },
  })

  if (!share || share.isRevoked) {
    return { title: 'Tài liệu không tồn tại - TML Logistics' }
  }

  return {
    title: `${share.document.title} - TML DocManager Chia sẻ an toàn`,
    description: `Chứng từ ${share.document.title} được chia sẻ bảo mật qua TML DocManager.`,
  }
}

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const share = await prisma.documentShare.findUnique({
    where: { token },
    include: {
      document: {
        include: {
          shipment: true,
          customer: true,
          ocrResults: { take: 1, orderBy: { extractedAt: 'desc' } },
        },
      },
    },
  })

  if (!share) {
    notFound()
  }

  const isExpired = share.expiresAt < new Date()
  const isRevoked = share.isRevoked
  const isOverLimit = share.maxViews ? share.viewCount >= share.maxViews : false

  // Khắc phục SEC-02: Không truyền ocrText vào Initial HTML nếu link được bảo vệ bằng mật khẩu
  const hasPassword = Boolean(share.passwordHash)
  const safeOcrText = hasPassword ? '' : (share.document.ocrResults[0]?.rawText || '')

  return (
    <PublicDocViewer
      token={token}
      share={{
        id: share.id,
        hasPassword,
        expiresAt: share.expiresAt.toISOString(),
        allowDownload: share.allowDownload,
        views: share.viewCount,
        isExpired,
        isRevoked,
        isOverLimit,
      }}
      document={{
        id: share.document.id,
        title: share.document.title,
        fileName: share.document.fileName,
        type: share.document.type,
        docDate: share.document.docDate,
        pages: share.document.pages,
        ocrText: safeOcrText,
        shipmentJobNo: share.document.shipment.jobNo,
        customerName: share.document.customer.shortName,
      }}
    />
  )
}
