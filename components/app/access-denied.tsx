import Link from 'next/link'
import { ShieldAlertIcon, ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface AccessDeniedProps {
  title?: string
  description?: string
  reason?: string
}

export function AccessDenied({
  title = 'Từ chối truy cập (Access Denied)',
  description = 'Bạn không có đủ quyền hạn để xem hoặc thực hiện thao tác trên trang này.',
  reason,
}: AccessDeniedProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <Card className="max-w-md text-center shadow-lg border-destructive/20">
        <CardHeader>
          <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlertIcon className="size-7" />
          </div>
          <CardTitle className="text-xl text-foreground">{title}</CardTitle>
          <CardDescription className="text-sm">{description}</CardDescription>
        </CardHeader>
        {reason && (
          <CardContent>
            <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground font-mono">
              Lý do kỹ thuật: {reason}
            </div>
          </CardContent>
        )}
        <CardFooter className="flex justify-center gap-3">
          <Link href="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeftIcon className="mr-1.5 size-4" />
              Về Bảng điều khiển
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
