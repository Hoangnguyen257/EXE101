import type { Metadata } from 'next'
import { getDashboard, getUsers, getCurrentUser } from '@/lib/data'
import { PageHeader } from '@/components/app/page-header'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { AlertList } from '@/components/dashboard/alert-list'
import { AttentionShipments } from '@/components/dashboard/attention-shipments'
import { DashboardActions } from '@/components/dashboard/dashboard-actions'
import { ROLE_LABEL } from '@/lib/labels'
import type { Role } from '@/lib/types'

export const metadata: Metadata = { title: 'Tổng quan' }

export default async function DashboardPage() {
  const [data, users, currentUser] = await Promise.all([getDashboard(), getUsers(), getCurrentUser()])

  const todayStr = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date())

  const roleText = ROLE_LABEL[currentUser.role as Role] ?? currentUser.role.toUpperCase()

  return (
    <>
      <PageHeader
        title={`Chào mừng, ${currentUser.name}`}
        description={`${todayStr} · Vai trò: ${roleText} · Tình hình chứng từ và lô hàng hôm nay.`}
        actions={<DashboardActions />}
      />
      <KpiCards kpis={data.kpis} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <AttentionShipments shipments={data.attention} />
          <RecentActivity activities={data.activities} users={users} />
        </div>
        <AlertList alerts={data.alerts} />
      </div>
    </>
  )
}
