import Link from 'next/link'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DOC_TYPE_SHORT } from '@/lib/labels'
import type { ShipmentWithProgress } from '@/lib/data'
import { ShipmentStatusBadge } from '@/components/app/status-badges'

export function AttentionShipments({ shipments }: { shipments: ShipmentWithProgress[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lô hàng cần bổ sung chứng từ</CardTitle>
        <CardDescription>Các lô đang xử lý chưa đủ bộ chứng từ bắt buộc</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/shipments?missing=1" />} nativeButton={false}>
            Xem tất cả
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {shipments.map((s) => (
            <li key={s.id}>
              <Link href={`/shipments/${s.id}`} className="-mx-2 flex flex-col gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/60 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-medium">{s.jobNo}</span>
                    <ShipmentStatusBadge status={s.status} />
                  </div>
                  <span className="truncate text-sm text-muted-foreground">
                    {s.customerName} · {s.origin} → {s.destination}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  {s.missingTypes.map((t) => (
                    <Badge key={t} variant="destructive">
                      {DOC_TYPE_SHORT[t]}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 sm:w-32">
                  <Progress value={s.progress} className="flex-1" aria-label={`Tiến độ ${s.jobNo}`} />
                  <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{s.progress}%</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
