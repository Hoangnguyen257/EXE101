'use client'

import { SearchIcon, UploadIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useApp } from '@/components/app/app-provider'

export function DashboardActions() {
  const { openSearch, openUpload } = useApp()
  return (
    <>
      <Button variant="outline" onClick={openSearch}>
        <SearchIcon data-icon="inline-start" />
        Tìm chứng từ
      </Button>
      <Button onClick={() => openUpload()}>
        <UploadIcon data-icon="inline-start" />
        Tải lên chứng từ
      </Button>
    </>
  )
}
