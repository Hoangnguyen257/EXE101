import type { Metadata } from 'next'
import { PageHeader } from '@/components/app/page-header'
import { DocumentsListClient } from '@/components/documents/documents-list-client'
import { getCustomers, getDocuments, getShipments } from '@/lib/data'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScanLineIcon } from 'lucide-react'

export const metadata: Metadata = { title: 'Chứng từ đã lưu' }

export default async function DocumentsPage() {
  const [shipments, customers, documents] = await Promise.all([getShipments(), getCustomers(), getDocuments()])

  return (
    <>
      <PageHeader
        title="Quản lý Chứng từ"
        description="Toàn bộ chứng từ đã được lưu trữ an toàn trong kho dữ liệu tập trung của doanh nghiệp."
        actions={
          <Button render={<Link href="/scan" />} nativeButton={false}>
            <ScanLineIcon className="mr-2 size-4" />
            Quét chứng từ mới
          </Button>
        }
      />
      <DocumentsListClient shipments={shipments} customers={customers} initialDocuments={documents} />
    </>
  )
}
