import type { Metadata } from 'next'
import { PageHeader } from '@/components/app/page-header'
import { DocumentsListClient } from '@/components/documents/documents-list-client'
import { getCustomers, getShipments } from '@/lib/data'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScanLineIcon } from 'lucide-react'

export const metadata: Metadata = { title: 'Chứng từ đã lưu' }

export default async function DocumentsPage() {
  const [shipments, customers] = await Promise.all([getShipments(), getCustomers()])
  return (
    <>
      <PageHeader
        title="Chứng từ đã lưu"
        description="Toàn bộ chứng từ được quét và lưu trên thiết bị (IndexedDB)."
        actions={
        <Button render={<Link href="/scan" />}>
          <ScanLineIcon className="mr-2 size-4" />Quét chứng từ mới
        </Button>
        }
      />
      <DocumentsListClient shipments={shipments} customers={customers} />
    </>
  )
}
