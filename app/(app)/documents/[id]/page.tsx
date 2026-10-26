import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getDocument, getUsers } from '@/lib/data'
import { DocumentDetailView } from '@/components/documents/document-detail-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const data = await getDocument(id)
  if (!data) return { title: 'Chứng từ không tồn tại' }
  return {
    title: `${data.document.title} - ${data.shipment.jobNo}`,
    description: `Chi tiết chứng từ ${data.document.title}, thuộc lô hàng ${data.shipment.jobNo}`,
  }
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [data, users] = await Promise.all([getDocument(id), getUsers()])

  if (!data) {
    notFound()
  }

  return (
    <DocumentDetailView
      document={data.document}
      shipment={data.shipment}
      customer={data.customer}
      archiveBox={data.archiveBox}
      users={users}
    />
  )
}
