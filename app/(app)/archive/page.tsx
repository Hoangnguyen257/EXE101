import type { Metadata } from 'next'
import { getArchive } from '@/lib/data'
import { PageHeader } from '@/components/app/page-header'
import { ArchiveContent } from '@/components/archive/archive-content'

export const metadata: Metadata = { title: 'Lưu trữ vật lý' }

export default async function ArchivePage() {
  const data = await getArchive()

  return (
    <>
      <PageHeader
        title="Lưu trữ vật lý"
        description={`${data.boxes.length} thùng lưu trữ · ${data.documents.filter((d) => d.archiveBoxId).length} chứng từ đã lưu kho`}
      />
      <ArchiveContent data={data} />
    </>
  )
}
