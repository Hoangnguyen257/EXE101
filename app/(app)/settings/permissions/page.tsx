import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getPermissions } from '@/lib/data'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { PageHeader } from '@/components/app/page-header'
import { PermissionsContent } from '@/components/settings/permissions-content'
import { AccessDenied } from '@/components/app/access-denied'

export const metadata: Metadata = { title: 'Phân quyền' }

export default async function PermissionsPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/login')
  }

  // Khắc phục SEC-10: Kiểm tra quyền quản trị phân quyền
  const perm = await PermissionService.check(sessionUser, 'SETTINGS', 'MANAGE')
  if (!perm.allowed) {
    return (
      <AccessDenied
        title="Không có quyền quản lý Phân quyền"
        description="Chỉ Quản trị viên (ADMIN) mới có quyền truy cập và thiết lập ma trận phân quyền hệ thống."
        reason={perm.reason}
      />
    )
  }

  const data = await getPermissions()

  return (
    <>
      <PageHeader
        title="Phân quyền"
        description="Cấu hình quyền truy cập theo phòng ban, vai trò và loại tài nguyên"
      />
      <PermissionsContent data={data} />
    </>
  )
}
