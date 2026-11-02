import Link from 'next/link'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { DOC_TYPE_SHORT } from '@/lib/labels'
import type { ShipmentWithProgress } from '@/lib/data'
import { ShipmentStatusBadge } from '@/components/app/status-badges'
import { AlertCircleIcon, ArrowRightIcon } from 'lucide-react'

export function AttentionShipments({ shipments }: { shipments: ShipmentWithProgress[] }) {
  return (
    <Card className="rounded-2xl border border-slate-200/90 dark:border-blue-900/40 bg-white dark:bg-[#07182F] shadow-xs">
      <CardHeader className="border-b border-slate-100 dark:border-blue-900/30 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
            <AlertCircleIcon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Lô hàng cần bổ sung chứng từ
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Các lô đang xử lý chưa hoàn tất bộ hồ sơ hải quan & vận tải bắt buộc
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/shipments?missing=1" />} nativeButton={false} className="text-xs text-[#0875E8] hover:text-[#0661c4]">
            Xem tất cả
            <ArrowRightIcon className="ml-1 size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-2">
        <ul className="flex flex-col divide-y divide-slate-100 dark:divide-blue-900/20">
          {shipments.map((s) => (
            <li key={s.id}>
              <Link
                href={`/shipments/${s.id}`}
                className="-mx-2 flex flex-col gap-3 rounded-xl px-3 py-3.5 transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-900/40 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tracking-wide">
                      {s.jobNo}
                    </span>
                    <ShipmentStatusBadge status={s.status} />
                  </div>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {s.customerName} · {s.origin} → {s.destination}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 sm:justify-end">
                  {s.missingTypes.filter((t) => (t as string) !== 'ARRIVAL_NOTICE').map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="border-red-200 bg-red-50 text-[10px] font-mono text-red-600 dark:bg-red-950/40 dark:border-red-900"
                    >
                      {DOC_TYPE_SHORT[t]}
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2 sm:w-32">
                  <Progress value={s.progress} className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800" aria-label={`Tiến độ ${s.jobNo}`} />
                  <span className="w-8 text-right font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    {s.progress}%
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
