import Link from 'next/link'
import { ClockAlertIcon, FileStackIcon, PackageXIcon, SearchIcon, ArrowUpRightIcon } from 'lucide-react'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

interface Kpis {
  totalDocuments: number
  newThisWeek: number
  shipmentsMissing: number
  activeShipments: number
  expiringSoon: number
  searchesToday: number
}

const nf = new Intl.NumberFormat('vi-VN')

export function KpiCards({ kpis }: { kpis: Kpis }) {
  const items = [
    {
      label: 'Tổng chứng từ số hóa',
      value: nf.format(kpis.totalDocuments),
      foot: `+${kpis.newThisWeek} chứng từ mới trong 7 ngày`,
      icon: FileStackIcon,
      href: '/documents',
      tone: 'bg-blue-500/10 text-[#0875E8] border border-blue-200/50',
    },
    {
      label: 'Lô hàng thiếu chứng từ',
      value: nf.format(kpis.shipmentsMissing),
      foot: `trên tổng số ${kpis.activeShipments} lô đang xử lý`,
      icon: PackageXIcon,
      href: '/shipments?missing=1',
      tone: 'bg-red-500/10 text-red-600 border border-red-200/50',
    },
    {
      label: 'Sắp hết hạn lưu trữ',
      value: nf.format(kpis.expiringSoon),
      foot: 'cần gia hạn hoặc số hóa trong 90 ngày',
      icon: ClockAlertIcon,
      href: '/alerts?tab=retention',
      tone: 'bg-amber-500/10 text-amber-600 border border-amber-200/50',
    },
    {
      label: 'Lượt tìm kiếm hôm nay',
      value: nf.format(kpis.searchesToday),
      foot: '38% tìm theo nội dung bóc tách OCR',
      icon: SearchIcon,
      href: '/audit',
      tone: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200/50',
    },
  ]

  return (
    <section aria-label="Chỉ số chính" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <Link
          key={k.label}
          href={k.href}
          className="group rounded-2xl focus-visible:ring-2 focus-visible:ring-[#0875E8] focus-visible:outline-none transition-all duration-200 hover:-translate-y-0.5"
        >
          <Card className="h-full rounded-2xl border border-slate-200/90 dark:border-blue-900/40 bg-white dark:bg-[#07182F] shadow-xs group-hover:border-[#0875E8]/40 group-hover:shadow-md transition-all">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {k.label}
                </CardDescription>
                <div className={`flex size-9 items-center justify-center rounded-xl shadow-2xs ${k.tone}`}>
                  <k.icon className="size-4.5" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white tabular-nums pt-1">
                {k.value}
              </CardTitle>
            </CardHeader>
            <CardFooter className="pt-0 text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <span>{k.foot}</span>
              <ArrowUpRightIcon className="size-3.5 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-[#0875E8] transition-opacity" />
            </CardFooter>
          </Card>
        </Link>
      ))}
    </section>
  )
}
