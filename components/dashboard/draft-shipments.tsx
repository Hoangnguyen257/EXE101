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
    <Card className="rounded-2xl border border-amber-500/30 bg-amber-500/5 shadow-xs">
      <CardHeader className="border-b border-amber-500/15 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <FileEditIcon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Lô đang soạn dở ({shipments.length})
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Các lô hàng đã khởi tạo nhưng chưa hoàn tất quy trình thiết lập hồ sơ
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/shipments" />} nativeButton={false} className="text-xs text-amber-700 dark:text-amber-300">
            Xem danh sách
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="flex flex-col divide-y divide-amber-500/15">
          {shipments.map((s) => (
            <li key={s.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">{s.jobNo}</span>
                  <Badge variant="outline" className="border-amber-400 bg-amber-100/60 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 text-[10px] font-mono">
                    Bước {s.draftStep || 1}/3
                  </Badge>
                </div>
                <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {s.origin || 'Chưa chọn'} → {s.destination || 'Chưa chọn'}
                  {s.customerName ? ` · ${s.customerName}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1 text-xs font-medium h-8 rounded-lg shadow-xs"
                  render={<Link href={`/shipments/new?id=${s.id}&step=${s.draftStep || 1}`} />}
                  nativeButton={false}
                >
                  <span>Tiếp tục</span>
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
