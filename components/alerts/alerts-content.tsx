'use client'

import { useState } from 'react'
import { ClockAlertIcon, FileWarningIcon } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { daysUntil } from '@/lib/labels'
import type { AlertItem } from '@/lib/types'

const SEVERITY_LABEL = { high: 'Khẩn', medium: 'Sắp đến hạn', low: 'Theo dõi' } as const
const SEVERITY_VARIANT = { high: 'destructive', medium: 'warning', low: 'secondary' } as const

function dueLabel(iso: string) {
  const d = daysUntil(iso)
  if (d < 0) return `Quá hạn ${-d} ngày`
  if (d === 0) return 'Hôm nay'
  return `Còn ${d} ngày`
}

function AlertRow({ alert: a }: { alert: AlertItem }) {
  const Icon = a.kind === 'missing' ? FileWarningIcon : ClockAlertIcon
  return (
    <li>
      <Link
        href={a.documentId ? `/documents/${a.documentId}` : `/shipments/${a.shipmentId}`}
        className="flex gap-3 rounded-lg border p-4 transition-colors hover:bg-muted/60"
      >
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-md',
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
}

export function AlertsContent({ alerts, initialTab }: { alerts: AlertItem[]; initialTab: 'missing' | 'retention' }) {
  const [tab, setTab] = useState(initialTab)

  const missing = alerts.filter((a) => a.kind === 'missing')
  const retention = alerts.filter((a) => a.kind === 'retention')

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'missing' | 'retention')}>
      <TabsList>
        <TabsTrigger value="missing">
          Thiếu chứng từ
          {missing.length > 0 && (
            <Badge variant="destructive" className="ml-2 px-1.5 text-xs">
              {missing.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="retention">
          Hết hạn lưu trữ
          {retention.length > 0 && (
            <Badge variant="warning" className="ml-2 px-1.5 text-xs">
              {retention.length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="missing" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Lô hàng thiếu chứng từ</CardTitle>
            <CardDescription>Danh sách lô hàng cần bổ sung chứng từ trước hạn ETA</CardDescription>
          </CardHeader>
          <CardContent>
            {missing.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Không có cảnh báo thiếu chứng từ
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {missing.map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="retention" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Chứng từ sắp hết hạn lưu trữ</CardTitle>
            <CardDescription>Chứng từ cần gia hạn hoặc tiêu hủy theo quy định 5 năm</CardDescription>
          </CardHeader>
          <CardContent>
            {retention.length === 0 ? (
              <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Không có chứng từ sắp hết hạn
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {retention.map((a) => (
                  <AlertRow key={a.id} alert={a} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
