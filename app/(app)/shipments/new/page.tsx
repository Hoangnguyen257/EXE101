import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { AccessDenied } from '@/components/app/access-denied'
import { ShipmentWizardView } from '@/components/shipments/shipment-wizard-view'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Khởi tạo lô hàng mới (Wizard)',
  description: 'Quy trình khởi tạo lô hàng, khai báo hàng hóa & HS Code và đính kèm chứng từ vận tải TML.',
}

export default async function NewShipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>
}) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/login')
  }

  // Phân quyền theo ma trận Việc 3: STAFF không có quyền tạo lô hàng
  const perm = await PermissionService.check(sessionUser, 'SHIPMENTS', 'CREATE')
  if (!perm.allowed) {
    return (
      <AccessDenied
        title="Không có quyền tạo lô hàng"
        description="Chỉ Quản trị viên (ADMIN) hoặc Quản lý phòng ban (MANAGER) mới được cấp quyền khởi tạo lô hàng."
        reason={perm.reason}
      />
    )
  }

  const { id: shipmentId } = await searchParams

  // Lấy danh sách phòng ban mà người dùng được phép phụ trách
  const allowedDepartments =
    sessionUser.role === 'ADMIN'
      ? (await prisma.department.findMany({
          select: { id: true, name: true, code: true },
          orderBy: { name: 'asc' },
        }))
      : sessionUser.departments.map((d) => ({
          id: d.id,
          name: d.name,
          code: d.code,
        }))

  // Lấy danh sách khách hàng doanh nghiệp trong tổ chức
  const customers = await prisma.customer.findMany({
    where: { orgId: sessionUser.orgId },
    select: { id: true, name: true, shortName: true, taxCode: true },
    orderBy: { name: 'asc' },
  })

  // Nếu có id bản nháp truyền vào qua URL
  let initialShipment: any = null
  if (shipmentId) {
    initialShipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: true,
        goods: { orderBy: { orderIndex: 'asc' } },
        requirements: true,
        documents: {
          where: { isDeleted: false },
          include: { versions: { orderBy: { versionNumber: 'desc' } } },
        },
      },
    })
  }

  // Sinh mã Job gợi ý
  const date = new Date()
  const year = String(date.getFullYear()).slice(-2)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const rand = Math.floor(1000 + Math.random() * 9000)
  const suggestedJobNo = `TML-SE${year}${month}-${rand}`

  return (
    <ShipmentWizardView
      allowedDepartments={allowedDepartments}
      customers={customers}
      suggestedJobNo={suggestedJobNo}
      initialShipment={initialShipment}
    />
  )
}
