'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAppContext } from '@/components/app/app-provider'
import { DOC_TYPE_LABEL } from '@/lib/labels'
import { REQUIRED_DOC_TYPES, type DocType } from '@/lib/types'
import { saveDocument, newDocId, type ScannedPage } from '@/lib/storage'
import { normalize } from '@/lib/search'

export function SaveDocDialog({
  html,
  ocrPages,
  onClose,
}: {
  html: string
  ocrPages: (ScannedPage & { id: string })[]
  onClose: () => void
}) {
  const router = useRouter()
  const { shipments, customers } = useAppContext()
  const [shipmentId, setShipmentId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [type, setType] = useState<DocType>('BL')
  const [customTypeName, setCustomTypeName] = useState('')
  const [docDate, setDocDate] = useState(new Date().toISOString().slice(0, 10))
  const [archiveBoxId, setArchiveBoxId] = useState('')
  const [retentionUntil, setRetentionUntil] = useState('')
  const [shipmentQ, setShipmentQ] = useState('')
  const [saving, setSaving] = useState(false)

  const filteredShipments = shipments.filter((s) =>
    !shipmentQ || normalize(`${s.jobNo} ${s.blNo} ${s.customerName}`).includes(normalize(shipmentQ)),
  )

  const docTypeItems = [
    ...REQUIRED_DOC_TYPES.map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] })),
    { value: 'OTHER' as DocType, label: 'Khác (tự nhập)' },
  ]

  const handleSave = async () => {
    if (!shipmentId || !customerId || !type || !docDate) return
    if (type === 'OTHER' && !customTypeName.trim()) return
    setSaving(true)
    const id = newDocId()
    const shipment = shipments.find((s) => s.id === shipmentId)!
    const displayLabel = type === 'OTHER' && customTypeName.trim() ? customTypeName.trim() : DOC_TYPE_LABEL[type]
    await saveDocument({
      id,
      shipmentId,
      customerId,
      type,
      customTypeName: type === 'OTHER' ? customTypeName.trim() : undefined,
      title: `${displayLabel} ${shipment.jobNo}`,
      docDate,
      archiveBoxId: archiveBoxId || undefined,
      retentionUntil: retentionUntil || undefined,
      pages: ocrPages.map(({ id: _, ...p }) => p),
      editedHtml: html,
      history: [{ at: new Date().toISOString(), html, label: 'Tạo mới' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditLog: [{ action: 'create', at: new Date().toISOString() }],
    })
    setSaving(false)
    onClose()
    router.push('/documents')
  }

  const qrValue = archiveBoxId ? `TML-BOX:${archiveBoxId}` : ''

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lưu chứng từ</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          {/* Job/Shipment */}
          <div className="flex flex-col gap-1.5">
            <Label>Lô hàng (Job) *</Label>
            <Input
              placeholder="Tìm số Job, số Bill..."
              value={shipmentQ}
              onChange={(e) => setShipmentQ(e.target.value)}
            />
            {shipmentQ && (
              <div className="max-h-40 overflow-y-auto rounded-lg border bg-popover shadow-md">
                {filteredShipments.slice(0, 8).map((s) => (
                  <button
                    key={s.id}
                    className="flex w-full flex-col px-3 py-2 text-left hover:bg-muted"
                    onClick={() => {
                      setShipmentId(s.id)
                      setCustomerId(s.customerId)
                      setShipmentQ(`${s.jobNo} – ${s.blNo}`)
                    }}
                  >
                    <span className="font-mono text-sm font-medium">{s.jobNo}</span>
                    <span className="text-xs text-muted-foreground">{s.blNo} · {s.customerName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Customer (auto-filled) */}
          <div className="flex flex-col gap-1.5">
            <Label>Khách hàng *</Label>
            <Input
              readOnly
              value={customers.find((c) => c.id === customerId)?.name ?? ''}
              placeholder="Tự động điền từ lô hàng"
            />
          </div>

          {/* Doc type */}
          <div className="flex flex-col gap-1.5">
            <Label>Loại chứng từ *</Label>
            <Select items={docTypeItems} value={type} onValueChange={(v) => setType((v as DocType) ?? 'BL')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {docTypeItems.map((d) => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          {/* Custom doc type name if type === 'OTHER' */}
          {type === 'OTHER' && (
            <div className="flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <Label>Tên loại chứng từ tùy chỉnh *</Label>
              <Input
                placeholder="Nhập tên loại chứng từ (VD: Giấy kiểm dịch, Bảo hiểm...)"
                value={customTypeName}
                onChange={(e) => setCustomTypeName(e.target.value)}
                autoFocus
              />
            </div>
          )}

          {/* Doc date */}
          <div className="flex flex-col gap-1.5">
            <Label>Ngày chứng từ *</Label>
            <Input type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
          </div>

          {/* Archive box */}
          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label>Mã hộp lưu trữ vật lý</Label>
              <Input placeholder="ARC-2610-001" value={archiveBoxId} onChange={(e) => setArchiveBoxId(e.target.value)} />
            </div>
            {qrValue && (
              <div className="flex flex-col items-center gap-1">
                <Label>QR</Label>
                <QRCodeSVG value={qrValue} size={64} />
              </div>
            )}
          </div>

          {/* Retention */}
          <div className="flex flex-col gap-1.5">
            <Label>Ngày hết hạn lưu trữ</Label>
            <Input type="date" value={retentionUntil} onChange={(e) => setRetentionUntil(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button onClick={handleSave} disabled={saving || !shipmentId || !docDate || (type === 'OTHER' && !customTypeName.trim())}>
            {saving ? 'Đang lưu...' : 'Lưu chứng từ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
