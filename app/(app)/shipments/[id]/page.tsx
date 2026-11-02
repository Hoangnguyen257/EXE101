import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getShipment, getUsers } from '@/lib/data'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { ShipmentDetailView } from '@/components/shipments/shipment-detail-view'
import { AccessDenied } from '@/components/app/access-denied'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const data = await getShipment(id)
  if (!data) return { title: 'Lô hàng không tồn tại' }
  return {
    title: `Lô hàng ${data.shipment.jobNo} - ${data.customer?.shortName || 'Chưa xác định'}`,
    description: `Hồ sơ chứng từ lô hàng ${data.shipment.jobNo}, vận đơn ${data.shipment.blNo || 'Chưa có'}`,
  }
}

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/login')
  }

  const [data, users] = await Promise.all([getShipment(id), getUsers()])

  if (!data) {
    notFound()
  }

  // Nếu lô hàng đang ở trạng thái draft (soạn dở), chuyển hướng mở lại Wizard đúng bước dở dang
  if (data.shipment.status === 'draft') {
    redirect(`/shipments/new?id=${data.shipment.id}&step=${data.shipment.draftStep || 1}`)
  }

  // Khắc phục SEC-10: Kiểm tra quyền xem Lô hàng cấp Resource kết hợp thành viên tham gia
  const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'VIEW', {
    id: data.shipment.id,
    departmentId: (data.shipment as any).departmentId || null,
    ownerId: data.shipment.ownerId,
    assignedUserIds: data.participants.map((p: any) => p.userId),
  })

  if (!perm.allowed) {
    return (
      <AccessDenied
        title="Không có quyền truy cập lô hàng"
        description="Lô hàng này thuộc phòng ban hoặc người phụ trách khác."
        reason={perm.reason}
      />
    )
  }

  return (
    <ShipmentDetailView
      shipment={data.shipment}
      customer={data.customer}
      owner={data.owner}
      documents={data.documents}
      activities={data.activities}
      goods={data.goods}
      goodsList={data.goodsList}
      users={users}
      initialParticipants={data.participants}
    />
  )
}
