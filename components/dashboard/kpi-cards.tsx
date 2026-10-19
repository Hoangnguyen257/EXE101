import Link from 'next/link'
import { ClockAlertIcon, FileStackIcon, PackageXIcon, SearchIcon } from 'lucide-react'
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
      label: 'Tổng chứng từ',
      value: nf.format(kpis.totalDocuments),
      foot: `+${kpis.newThisWeek} trong 7 ngày qua`,
      icon: FileStackIcon,
      href: '/shipments',
      tone: 'bg-primary/10 text-primary',
    },
    {
      label: 'Lô hàng thiếu chứng từ',
      value: nf.format(kpis.shipmentsMissing),
      foot: `trên ${kpis.activeShipments} lô đang xử lý`,
      icon: PackageXIcon,
      href: '/shipments?missing=1',
      tone: 'bg-destructive/10 text-destructive',
    },
    {
      label: 'Sắp hết hạn lưu trữ',
      value: nf.format(kpis.expiringSoon),
      foot: 'trong 90 ngày tới',
      icon: ClockAlertIcon,
      href: '/alerts?tab=retention',
      tone: 'bg-warning/15 text-warning-foreground dark:text-warning',
    },
    {
      label: 'Lượt tìm kiếm hôm nay',
      value: nf.format(kpis.searchesToday),
      foot: '38% tìm theo nội dung OCR',
      icon: SearchIcon,
      href: '/audit',
      tone: 'bg-success/12 text-success',
    },
  ]

  return (
    <section aria-label="Chỉ số chính" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <Link key={k.label} href={k.href} className="group rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
          <Card className="h-full transition-colors group-hover:border-primary/40">
            <CardHeader>
              <CardDescription>{k.label}</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">{k.value}</CardTitle>
              <CardAction>
                <div className={`flex size-10 items-center justify-center rounded-lg ${k.tone}`}>
                  <k.icon className="size-5" />
                </div>
              </CardAction>
            </CardHeader>
            <CardFooter className="text-sm text-muted-foreground">{k.foot}</CardFooter>
          </Card>
        </Link>
      ))}
    </section>
  )
}
