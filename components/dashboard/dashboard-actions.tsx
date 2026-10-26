'use client'

import Link from 'next/link'
import { ScanLineIcon, SearchIcon, UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/components/app/app-provider'

export function DashboardActions() {
  const { openSearch, openUpload } = useApp()
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={openSearch}>
        <SearchIcon data-icon="inline-start" />
        Tìm chứng từ
      </Button>
      <Button variant="outline" render={<Link href="/scan" />}>
        <ScanLineIcon data-icon="inline-start" />
        Quét / Chụp ảnh
      </Button>
      <Button onClick={() => openUpload()}>
        <UploadIcon data-icon="inline-start" />
        Tải lên chứng từ
      </Button>
    </div>
  )
}
