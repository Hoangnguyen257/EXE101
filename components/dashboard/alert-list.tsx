import Link from 'next/link'
import { ClockAlertIcon, FileWarningIcon } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { daysUntil } from '@/lib/labels'
import type { AlertItem } from '@/lib/types'
import { cn } from '@/lib/utils'

export const SEVERITY_LABEL = { high: 'Khẩn', medium: 'Sắp đến hạn', low: 'Theo dõi' } as const
export const SEVERITY_VARIANT = { high: 'destructive', medium: 'warning', low: 'secondary' } as const

export function dueLabel(iso: string) {
  const d = daysUntil(iso)
  if (d < 0) return `Quá hạn ${-d} ngày`
  if (d === 0) return 'Hôm nay'
  return `Còn ${d} ngày`
}

export function AlertList({ alerts }: { alerts: AlertItem[] }) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Cảnh báo</CardTitle>
        <CardDescription>Ưu tiên xử lý từ trên xuống</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/alerts" />} nativeButton={false}>
            Tất cả
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2">
          {alerts.map((a) => {
            const Icon = a.kind === 'missing' ? FileWarningIcon : ClockAlertIcon
            return (
              <li key={a.id}>
                <Link
                  href={a.documentId ? `/documents/${a.documentId}` : `/shipments/${a.shipmentId}`}
                  className="flex gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60"
                >
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-md',
                      a.severity === 'high' ? 'bg-destructive/10 text-destructive' : 'bg-warning/15 text-warning-foreground dark:text-warning',
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{a.description}</p>
                    <div className="flex items-center gap-2">
                      <Badge variant={SEVERITY_VARIANT[a.severity]}>{SEVERITY_LABEL[a.severity]}</Badge>
                      <span className="text-xs text-muted-foreground">{dueLabel(a.dueDate)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
