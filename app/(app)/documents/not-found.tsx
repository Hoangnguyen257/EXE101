import Link from 'next/link'
import { FileQuestionIcon, ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function DocumentNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md w-full text-center shadow-md">
        <CardHeader>
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <FileQuestionIcon className="size-6" />
          </div>
          <CardTitle className="text-xl">Chứng từ không tồn tại</CardTitle>
          <CardDescription>
            Chứng từ bạn đang tìm kiếm có thể đã bị xóa, hết thời hạn lưu trữ hoặc bạn không có quyền xem.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Button size="sm" render={<Link href="/documents" />} nativeButton={false}>
            <ArrowLeftIcon className="mr-1.5 size-4" />
            Quay lại danh sách chứng từ
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

