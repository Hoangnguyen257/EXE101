import type { Metadata } from 'next'
import { getAuditLogs, getUsers } from '@/lib/data'
import { PageHeader } from '@/components/app/page-header'
import { AuditContent } from '@/components/audit/audit-content'

export const metadata: Metadata = { title: 'Nhật ký truy cập' }

export default async function AuditPage() {
  const [logs, users] = await Promise.all([getAuditLogs(), getUsers()])

  return (
    <>
      <PageHeader
        title="Nhật ký truy cập"
        description={`${logs.length} hoạt động được ghi nhận · tuân thủ quy định bảo mật thông tin`}
      />
      <AuditContent logs={logs} users={users} />
    </>
  )
}
