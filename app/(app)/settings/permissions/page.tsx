import type { Metadata } from 'next'
import { getPermissions } from '@/lib/data'
import { PageHeader } from '@/components/app/page-header'
import { PermissionsContent } from '@/components/settings/permissions-content'

export const metadata: Metadata = { title: 'Phân quyền' }

export default async function PermissionsPage() {
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
