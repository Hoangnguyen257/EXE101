'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangleIcon, RotateCcwIcon, ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function DocumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Lỗi phân hệ Chứng từ:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full border-destructive/30 shadow-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangleIcon className="size-6" />
          </div>
          <CardTitle className="text-xl">Không thể tải chứng từ</CardTitle>
          <CardDescription>
            Đã xảy ra sự cố khi truy vấn hoặc hiển thị chứng từ. Vui lòng thử lại hoặc quay lại danh sách.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-muted p-3 text-xs font-mono text-muted-foreground break-words">
            {error.message || 'Lỗi không xác định.'}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 justify-center">
          <Button variant="outline" size="sm" render={<Link href="/documents" />} nativeButton={false}>
            <ArrowLeftIcon className="mr-1.5 size-4" />
            Về danh sách chứng từ
          </Button>
          <Button size="sm" onClick={() => reset()} className="gap-1.5">
            <RotateCcwIcon className="size-4" />
            Thử lại
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

