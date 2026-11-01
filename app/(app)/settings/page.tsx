import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSettings } from '@/lib/data'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { PageHeader } from '@/components/app/page-header'
import { SettingsContent } from '@/components/settings/settings-content'
import { AccessDenied } from '@/components/app/access-denied'

export const metadata: Metadata = { title: 'Cài đặt' }

export default async function SettingsPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/login')
  }

  // Khắc phục SEC-10: Kiểm tra quyền xem Settings hệ thống
  const perm = await PermissionService.check(sessionUser, 'SETTINGS', 'VIEW')
  if (!perm.allowed) {
    return (
      <AccessDenied
        title="Không có quyền truy cập Cài đặt hệ thống"
        description="Bạn không có quyền quản lý cấu hình tổ chức và phòng ban."
        reason={perm.reason}
      />
    )
  }

  const data = await getSettings()

  return (
    <>
      <PageHeader
        title="Cài đặt"
        description="Quản lý tổ chức, chi nhánh, phòng ban và người dùng"
      />
      <SettingsContent data={data} />
    </>
  )
}
