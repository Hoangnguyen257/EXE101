'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { FileTextIcon, SearchIcon, Trash2Icon, PencilIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DOC_TYPE_LABEL, DOC_TYPE_SHORT, formatDate } from '@/lib/labels'
import { normalize } from '@/lib/search'
import { listDocuments, deleteDocument, type SavedDocument } from '@/lib/storage'
import type { ShipmentWithProgress } from '@/lib/data'
import type { Customer, DocType } from '@/lib/types'
import { REQUIRED_DOC_TYPES } from '@/lib/types'

export function DocumentsListClient({
  shipments,
  customers,
}: {
  shipments: ShipmentWithProgress[]
  customers: Customer[]
}) {
  const [docs, setDocs] = useState<SavedDocument[]>([])
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocType | 'all'>('all')

  const load = async () => setDocs(await listDocuments())

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const nq = normalize(q)
    return docs.filter((d) => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false
      if (!nq) return true
      const shipment = shipments.find((s) => s.id === d.shipmentId)
      const customer = customers.find((c) => c.id === d.customerId)
      const searchable = normalize(`${d.title} ${shipment?.jobNo ?? ''} ${shipment?.blNo ?? ''} ${customer?.name ?? ''} ${d.pages.map((p) => p.ocrText).join(' ')}`)
      return searchable.includes(nq)
    })
  }, [docs, q, typeFilter, shipments, customers])

  const handleDelete = async (id: string) => {
    if (!confirm('Xóa chứng từ này?')) return
    await deleteDocument(id)
    load()
  }

  const typeItems = [
    { value: 'all', label: 'Mọi loại' },
    ...REQUIRED_DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_SHORT[t] })),
  ]

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
        <FileTextIcon className="size-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chưa có chứng từ nào được lưu.</p>
        <Button variant="outline" render={<Link href="/scan" />}>
          Quét chứng từ đầu tiên
        </Button>
      </div>
    )
  }

  return (
    <Card className="gap-0 py-0">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Tìm trong nội dung OCR, số Job, Bill..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select items={typeItems} value={typeFilter} onValueChange={(v) => setTypeFilter((v as DocType | 'all') ?? 'all')}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {typeItems.map((i) => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Tiêu đề</TableHead>
            <TableHead>Loại</TableHead>
            <TableHead>Lô hàng</TableHead>
            <TableHead>Khách hàng</TableHead>
            <TableHead>Ngày</TableHead>
            <TableHead>Trang</TableHead>
            <TableHead className="pr-4 text-right">Thao tác</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((doc) => {
            const shipment = shipments.find((s) => s.id === doc.shipmentId)
            const customer = customers.find((c) => c.id === doc.customerId)
            return (
              <TableRow key={doc.id}>
                <TableCell className="pl-4">
                  <span className="text-sm font-medium">{doc.title}</span>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{DOC_TYPE_SHORT[doc.type]}</Badge>
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {shipment?.jobNo ?? doc.shipmentId}
                </TableCell>
                <TableCell className="text-sm">{customer?.shortName ?? '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDate(doc.docDate)}</TableCell>
                <TableCell className="text-sm">{doc.pages.length}</TableCell>
                <TableCell className="pr-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon" render={<Link href={`/documents/${doc.id}/edit`} />}>
                      <PencilIcon className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(doc.id)}>
                      <Trash2Icon className="size-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      <div className="border-t px-4 py-3 text-sm text-muted-foreground">
        Hiển thị {filtered.length} / {docs.length} chứng từ
      </div>
    </Card>
  )
}
