import type { Metadata } from 'next'
import { getAlerts } from '@/lib/data'
import { PageHeader } from '@/components/app/page-header'
import { AlertsContent } from '@/components/alerts/alerts-content'

export const metadata: Metadata = { title: 'Cảnh báo' }

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ tab }, alerts] = await Promise.all([searchParams, getAlerts()])

  return (
    <>
      <PageHeader
        title="Cảnh báo"
        description={`${alerts.length} cảnh báo cần xử lý · ưu tiên theo mức độ và thời hạn`}
      />
      <AlertsContent alerts={alerts} initialTab={tab === 'retention' ? 'retention' : 'missing'} />
    </>
  )
}
