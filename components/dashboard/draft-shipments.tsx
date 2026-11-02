import Link from 'next/link'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowRightIcon, FileEditIcon } from 'lucide-react'
import type { ShipmentWithProgress } from '@/lib/data'

export function DraftShipments({ shipments }: { shipments: ShipmentWithProgress[] }) {
  if (!shipments || shipments.length === 0) {
    return null
  }

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileEditIcon className="size-5 text-amber-600 dark:text-amber-400" />
          <CardTitle>Lô đang soạn dở ({shipments.length})</CardTitle>
        </div>
        <CardDescription>Các lô hàng đã khởi tạo nhưng chưa hoàn tất quy trình</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/shipments" />} nativeButton={false}>
            Xem danh sách
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-amber-500/20">
          {shipments.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm font-semibold">{s.jobNo}</span>
                  <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-300">
                    Bước {s.draftStep || 1}/3
                  </Badge>
                </div>
                <span className="truncate text-xs text-muted-foreground">
                  {s.origin || 'Chưa chọn'} → {s.destination || 'Chưa chọn'}
                  {s.customerName ? ` · ${s.customerName}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                  render={<Link href={`/shipments/new?id=${s.id}&step=${s.draftStep || 1}`} />}
                  nativeButton={false}
                >
                  Tiếp tục
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

