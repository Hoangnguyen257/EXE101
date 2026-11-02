import type { Metadata } from 'next'
import Link from 'next/link'
import { PlusIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getCustomers, getShipments } from '@/lib/data'
import { PageHeader } from '@/components/app/page-header'
import { ShipmentsTable } from '@/components/shipments/shipments-table'
import { DashboardActions } from '@/components/dashboard/dashboard-actions'

export const metadata: Metadata = { title: 'Lô hàng' }

export default async function ShipmentsPage({ searchParams }: { searchParams: Promise<{ missing?: string }> }) {
  const [{ missing }, shipments, customers] = await Promise.all([searchParams, getShipments(), getCustomers()])

  return (
    <>
      <PageHeader
        title="Lô hàng"
        description={`${shipments.length} lô hàng · theo dõi đủ bộ chứng từ cho từng Job`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button render={<Link href="/shipments/new" />} nativeButton={false}>
              <PlusIcon data-icon="inline-start" />
              Tạo lô hàng mới
            </Button>
            <DashboardActions />
          </div>
        }
      />
      <ShipmentsTable shipments={shipments} customers={customers} initialMissingOnly={missing === '1'} />
    </>
  )
}
