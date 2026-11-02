import Link from 'next/link'
import { ClockAlertIcon, FileWarningIcon, ArrowRightIcon, BellIcon } from 'lucide-react'
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
    <Card className="h-fit rounded-2xl border border-slate-200/90 dark:border-blue-900/40 bg-white dark:bg-[#07182F] shadow-xs">
      <CardHeader className="border-b border-slate-100 dark:border-blue-900/30 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
            <BellIcon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Cảnh báo ưu tiên
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Danh sách nhắc việc & hạn chót cần xử lý
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/alerts" />} nativeButton={false} className="text-xs text-[#0875E8] hover:text-[#0661c4]">
            Tất cả
            <ArrowRightIcon className="ml-1 size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-3">
        <ul className="flex flex-col gap-2.5">
          {alerts.map((a) => {
            const Icon = a.kind === 'missing' ? FileWarningIcon : ClockAlertIcon
            return (
              <li key={a.id}>
                <Link
                  href={a.documentId ? `/documents/${a.documentId}` : `/shipments/${a.shipmentId}`}
                  className="flex gap-3 rounded-xl border border-slate-200/80 dark:border-blue-900/30 p-3 transition-all hover:bg-slate-50/80 dark:hover:bg-slate-900/40 hover:border-[#0875E8]/30"
                >
                  <div
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-lg',
                      a.severity === 'high'
                        ? 'bg-red-500/10 text-red-600 border border-red-200/50'
                        : 'bg-amber-500/10 text-amber-600 border border-amber-200/50',
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{a.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{a.description}</p>
                    <div className="flex items-center gap-2 pt-0.5">
                      <Badge variant={SEVERITY_VARIANT[a.severity]} className="text-[9px] font-mono font-bold px-1.5 py-0.2">
                        {SEVERITY_LABEL[a.severity]}
                      </Badge>
                      <span className="font-mono text-[10px] text-muted-foreground">{dueLabel(a.dueDate)}</span>
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
