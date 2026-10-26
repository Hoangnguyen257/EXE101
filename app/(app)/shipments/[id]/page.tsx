import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getShipment, getUsers } from '@/lib/data'
import { ShipmentDetailView } from '@/components/shipments/shipment-detail-view'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const data = await getShipment(id)
  if (!data) return { title: 'Lô hàng không tồn tại' }
  return {
    title: `Lô hàng ${data.shipment.jobNo} - ${data.customer.shortName}`,
    description: `Hồ sơ chứng từ lô hàng ${data.shipment.jobNo}, vận đơn ${data.shipment.blNo}`,
  }
}

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [data, users] = await Promise.all([getShipment(id), getUsers()])

  if (!data) {
    notFound()
  }

  return (
    <ShipmentDetailView
      shipment={data.shipment}
      customer={data.customer}
      owner={data.owner}
      documents={data.documents}
      activities={data.activities}
      goods={data.goods}
      users={users}
    />
  )
}
