import type { Metadata } from 'next'
import { getDashboard, getUsers } from '@/lib/data'
import { PageHeader } from '@/components/app/page-header'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { AlertList } from '@/components/dashboard/alert-list'
import { AttentionShipments } from '@/components/dashboard/attention-shipments'
import { DashboardActions } from '@/components/dashboard/dashboard-actions'

export const metadata: Metadata = { title: 'Tổng quan' }

export default async function DashboardPage() {
  const [data, users] = await Promise.all([getDashboard(), getUsers()])

  return (
    <>
      <PageHeader
        title="Chào buổi sáng, Thu Hà"
        description="Thứ Hai, 19/10/2026 · Đây là tình hình chứng từ của tổ chức hôm nay."
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
