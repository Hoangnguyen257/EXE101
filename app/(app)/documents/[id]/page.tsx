import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getDocument, getUsers } from '@/lib/data'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { DocumentDetailView } from '@/components/documents/document-detail-view'
import { AccessDenied } from '@/components/app/access-denied'

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
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/login')
  }

  const [data, users] = await Promise.all([getDocument(id), getUsers()])

  if (!data) {
    notFound()
  }

  // Khắc phục SEC-10: Kiểm tra quyền truy cập chi tiết chứng từ ở cấp Resource
  const perm = await PermissionService.check(sessionUser, 'DOCUMENTS', 'VIEW', {
    id: data.document.id,
    departmentId: (data.document as any).departmentId || null,
    createdBy: data.document.uploadedBy,
  })

  if (!perm.allowed) {
    return (
      <AccessDenied
        title="Không có quyền truy cập chứng từ"
        description="Chứng từ này thuộc phòng ban khác hoặc không nằm trong danh sách chứng từ bạn được phân công / chia sẻ."
        reason={perm.reason}
      />
    )
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
