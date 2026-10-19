'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PackageSearchIcon, PlaneIcon, SearchIcon, ShipIcon, TruckIcon, XIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty'
import { ShipmentStatusBadge } from '@/components/app/status-badges'
import { DOC_TYPE_SHORT, SHIPMENT_STATUS_LABEL, formatDate } from '@/lib/labels'
import { normalize } from '@/lib/search'
import type { ShipmentWithProgress } from '@/lib/data'
import type { Customer, ShipmentStatus } from '@/lib/types'

const MODE_ICON = { sea: ShipIcon, air: PlaneIcon, road: TruckIcon }
const MODE_LABEL = { sea: 'Đường biển', air: 'Hàng không', road: 'Đường bộ' }

export function ShipmentsTable({
  shipments,
  customers,
  initialMissingOnly,
}: {
  shipments: ShipmentWithProgress[]
  customers: Customer[]
  initialMissingOnly: boolean
}) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [customer, setCustomer] = useState('all')
  const [status, setStatus] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [missingOnly, setMissingOnly] = useState(initialMissingOnly)

  const customerItems = [{ value: 'all', label: 'Tất cả khách hàng' }, ...customers.map((c) => ({ value: c.id, label: c.shortName }))]
  const statusItems = [
    { value: 'all', label: 'Mọi trạng thái' },
    ...(Object.keys(SHIPMENT_STATUS_LABEL) as ShipmentStatus[]).map((s) => ({ value: s, label: SHIPMENT_STATUS_LABEL[s] })),
  ]

  const filtered = useMemo(() => {
    const nq = normalize(q)
    return shipments.filter((s) => {
      if (nq && !normalize(`${s.jobNo} ${s.blNo} ${s.customerName} ${s.origin} ${s.destination}`).includes(nq)) return false
      if (customer !== 'all' && s.customerId !== customer) return false
      if (status !== 'all' && s.status !== status) return false
      if (from && s.etd < from) return false
      if (to && s.etd > to) return false
      if (missingOnly && s.missingTypes.length === 0) return false
      return true
    })
  }, [shipments, q, customer, status, from, to, missingOnly])

  const hasFilters = q || customer !== 'all' || status !== 'all' || from || to || missingOnly
  const reset = () => {
    setQ('')
    setCustomer('all')
    setStatus('all')
    setFrom('')
    setTo('')
    setMissingOnly(false)
  }

  return (
    <Card className="gap-0 py-0">
      <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:flex-wrap lg:items-center">
        <InputGroup className="lg:max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput placeholder="Số Job, số Bill, cảng..." value={q} onChange={(e) => setQ(e.target.value)} aria-label="Lọc lô hàng" />
        </InputGroup>
        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
          <Select items={customerItems} value={customer} onValueChange={(v) => setCustomer((v as string) ?? 'all')}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Lọc theo khách hàng">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {customerItems.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Select items={statusItems} value={status} onValueChange={(v) => setStatus((v as string) ?? 'all')}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Lọc theo trạng thái">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {statusItems.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="ETD từ ngày" className="w-full sm:w-36" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="ETD đến ngày" className="w-full sm:w-36" />
        </div>
        <div className="flex items-center gap-3 lg:ml-auto">
          <div className="flex items-center gap-2">
            <Switch id="missing-only" checked={missingOnly} onCheckedChange={setMissingOnly} />
            <Label htmlFor="missing-only">Chỉ lô thiếu chứng từ</Label>
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={reset}>
              <XIcon data-icon="inline-start" />
              Xóa lọc
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty className="py-16">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PackageSearchIcon />
            </EmptyMedia>
            <EmptyTitle>Không có lô hàng phù hợp</EmptyTitle>
            <EmptyDescription>Thử bỏ bớt bộ lọc hoặc tìm theo số Bill thay vì số Job.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" onClick={reset}>
              Xóa tất cả bộ lọc
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Job / Bill</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead className="hidden md:table-cell">Tuyến</TableHead>
              <TableHead className="hidden lg:table-cell">ETD / ETA</TableHead>
              <TableHead>Trạng thái</TableHead>
              <TableHead className="w-48 pr-4">Chứng từ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => {
              const ModeIcon = MODE_ICON[s.mode]
              return (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => router.push(`/shipments/${s.id}`)}>
                  <TableCell className="pl-4">
                    <Link href={`/shipments/${s.id}`} className="flex flex-col gap-0.5 hover:text-primary" onClick={(e) => e.stopPropagation()}>
                      <span className="font-mono text-sm font-medium">{s.jobNo}</span>
                      <span className="font-mono text-xs text-muted-foreground">{s.blNo}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-40 truncate">{s.customerName}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2 text-sm">
                      <ModeIcon className="size-4 shrink-0 text-muted-foreground" aria-label={MODE_LABEL[s.mode]} />
                      <span className="truncate">
                        {s.origin.split(',')[0]} → {s.destination.split(',')[0]}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground tabular-nums lg:table-cell">
                    {formatDate(s.etd)} – {formatDate(s.eta)}
                  </TableCell>
                  <TableCell>
                    <ShipmentStatusBadge status={s.status} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <Progress value={s.progress} className="flex-1" aria-label={`Đủ ${s.progress}% chứng từ`} />
                        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{s.progress}%</span>
                      </div>
                      {s.missingTypes.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {s.missingTypes.map((t) => (
                            <Badge key={t} variant="destructive" className="h-4 px-1.5 text-[10px]">
                              {DOC_TYPE_SHORT[t]}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-success">Đủ bộ chứng từ</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      <div className="border-t px-4 py-3 text-sm text-muted-foreground">
        Hiển thị {filtered.length} / {shipments.length} lô hàng
      </div>
    </Card>
  )
}
