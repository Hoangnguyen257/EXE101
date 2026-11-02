'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FileTextIcon, SearchIcon, Trash2Icon, PencilIcon, ExternalLinkIcon, EyeIcon } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DOC_TYPE_SHORT, formatDate } from '@/lib/labels'
import { normalize } from '@/lib/search'
import type { ShipmentWithProgress } from '@/lib/data'
import type { Customer, DocType, DocumentFile } from '@/lib/types'
import { REQUIRED_DOC_TYPES } from '@/lib/types'

interface UnifiedDoc {
  id: string
  title: string
  type: DocType
  customTypeName?: string
  shipmentId: string
  customerId: string
  docDate: string
  pagesCount: number
  ocrText: string
  source: 'database'
}

export function DocumentsListClient({
  shipments,
  customers,
  initialDocuments = [],
}: {
  shipments: ShipmentWithProgress[]
  customers: Customer[]
  initialDocuments?: DocumentFile[]
}) {
  const [q, setQ] = useState('')
  const [typeFilter, setTypeFilter] = useState<DocType | 'all'>('all')

  // Danh sách chính thức chỉ lấy từ cơ sở dữ liệu máy chủ (database)
  const allDocs = useMemo<UnifiedDoc[]>(() => {
    return initialDocuments.map((d) => ({
      id: d.id,
      title: d.title,
      type: d.type,
      customTypeName: d.customTypeName,
      shipmentId: d.shipmentId,
      customerId: d.customerId,
      docDate: d.docDate,
      pagesCount: d.pages,
      ocrText: d.ocrText,
      source: 'database',
    }))
  }, [initialDocuments])

  const filtered = useMemo(() => {
    const nq = normalize(q)
    return allDocs.filter((d) => {
      if (typeFilter !== 'all' && d.type !== typeFilter) return false
      if (!nq) return true
      const shipment = shipments.find((s) => s.id === d.shipmentId)
      const customer = customers.find((c) => c.id === d.customerId)
      const searchable = normalize(
        `${d.title} ${d.customTypeName ?? ''} ${shipment?.jobNo ?? ''} ${shipment?.blNo ?? ''} ${customer?.name ?? ''} ${d.ocrText}`
      )
      return searchable.includes(nq)
    })
  }, [allDocs, q, typeFilter, shipments, customers])

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chứng từ này?')) return
    try {
      await fetch(`/api/documents/${id}/delete`, { method: 'POST' })
      window.location.reload()
    } catch {
      // Fallback
    }
  }

  const typeItems = [
    { value: 'all', label: 'Mọi loại chứng từ' },
    ...REQUIRED_DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_SHORT[t] })),
    { value: 'OTHER', label: 'Khác' },
  ]

  if (allDocs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed py-16 text-center">
        <FileTextIcon className="size-12 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Chưa có chứng từ nào trong kho dữ liệu.</p>
        <Button variant="outline" render={<Link href="/scan" />} nativeButton={false}>
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
            placeholder="Tìm theo tiêu đề, số Job, Bill, nội dung OCR..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select items={typeItems} value={typeFilter} onValueChange={(v) => setTypeFilter((v as DocType | 'all') ?? 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {typeItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-4">Tiêu đề chứng từ</TableHead>
              <TableHead>Loại</TableHead>
              <TableHead>Lô hàng (Job)</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>Ngày lập</TableHead>
              <TableHead className="text-center">Số trang</TableHead>
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
                    <Link
                      href={`/documents/${doc.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {doc.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {doc.type === 'OTHER' && doc.customTypeName ? doc.customTypeName : DOC_TYPE_SHORT[doc.type] ?? doc.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {shipment ? (
                      <Link href={`/shipments/${shipment.id}`} className="hover:text-primary hover:underline">
                        {shipment.jobNo}
                      </Link>
                    ) : (
                      doc.shipmentId
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{customer?.shortName ?? '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(doc.docDate)}</TableCell>
                  <TableCell className="text-center text-sm">{doc.pagesCount}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        render={<Link href={`/documents/${doc.id}`} />}
                        nativeButton={false}
                        title="Xem chi tiết"
                      >
                        <EyeIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        render={<Link href={`/documents/${doc.id}/edit`} />}
                        nativeButton={false}
                        title="Chỉnh sửa nội dung"
                      >
                        <PencilIcon className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(doc.id)}
                        title="Xóa chứng từ"
                      >
                        <Trash2Icon className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <div className="border-t px-4 py-3 text-sm text-muted-foreground">
        Hiển thị {filtered.length} / {allDocs.length} chứng từ trong kho dữ liệu
      </div>
    </Card>
  )
}
