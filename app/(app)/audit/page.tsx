import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuditLogs, getUsers } from '@/lib/data'
import { getSessionUser } from '@/lib/auth/auth-service'
import { PermissionService } from '@/lib/auth/permission-service'
import { PageHeader } from '@/components/app/page-header'
import { AuditContent } from '@/components/audit/audit-content'
import { AccessDenied } from '@/components/app/access-denied'

export const metadata: Metadata = { title: 'Nhật ký truy cập' }

export default async function AuditPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    redirect('/login')
  }

  // Khắc phục SEC-10: Kiểm tra quyền xem Audit Log ở Server Component
  const perm = await PermissionService.check(sessionUser, 'AUDIT', 'VIEW')
  if (!perm.allowed) {
    return (
      <AccessDenied
        title="Không có quyền xem Nhật ký truy cập"
        description="Chỉ Quản trị viên hệ thống hoặc Quản lý được ủy quyền mới có quyền truy cập Audit Logs toàn doanh nghiệp."
        reason={perm.reason}
      />
    )
  }

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
