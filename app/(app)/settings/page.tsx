import type { Metadata } from 'next'
import { getSettings } from '@/lib/data'
import { PageHeader } from '@/components/app/page-header'
import { SettingsContent } from '@/components/settings/settings-content'

export const metadata: Metadata = { title: 'Cài đặt' }

export default async function SettingsPage() {
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
