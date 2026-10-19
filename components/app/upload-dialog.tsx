'use client'

import { useEffect, useRef, useState } from 'react'
import { CloudUploadIcon, FileTextIcon, SparklesIcon, Trash2Icon, WandSparklesIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Spinner } from '@/components/ui/spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DOC_TYPE_LABEL, DOC_TYPE_SHORT, formatSize } from '@/lib/labels'
import type { ShipmentWithProgress } from '@/lib/data'
import type { Customer, DocType } from '@/lib/types'
import type { UploadPreset } from './app-provider'

interface PendingFile {
  id: string
  name: string
  sizeKb: number
  type: DocType
  confidence: number
  shipmentId: string
  progress: number
}

const TYPE_RULES: { type: DocType; pattern: RegExp; confidence: number }[] = [
  { type: 'ARRIVAL_NOTICE', pattern: /(arrival|notice|(^|[^a-z])an|giay[-_ ]?bao|tb[-_ ]?den)([^a-z]|$)/i, confidence: 96 },
  { type: 'DELIVERY_ORDER', pattern: /(edo|delivery|(^|[^a-z])d[-_ ]?o)([^a-z]|$)/i, confidence: 94 },
  { type: 'BL', pattern: /(^|[^a-z])(b[-_ ]?l|bill|hbl|mbl|awb|lading)([^a-z]|$)/i, confidence: 92 },
  { type: 'INVOICE', pattern: /(invoice|inv|hoa[-_ ]?don|ci)([^a-z]|$)/i, confidence: 90 },
  { type: 'PACKING_LIST', pattern: /(packing|pl|p[-_ ]list)([^a-z]|$)/i, confidence: 90 },
  { type: 'BOOKING', pattern: /(booking|bkg|bk)([^a-z]|$)/i, confidence: 88 },
  { type: 'CUSTOMS', pattern: /(customs|to[-_ ]?khai|tkhq|tk|declaration)([^a-z]|$)/i, confidence: 87 },
  { type: 'CO', pattern: /(^|[^a-z])(c[-_ ]?o|origin|form[-_ ]?e)([^a-z]|$)/i, confidence: 85 },
]

export function suggestDocType(fileName: string): { type: DocType; confidence: number } {
  const base = fileName.replace(/\.[a-z0-9]+$/i, '')
  for (const rule of TYPE_RULES) if (rule.pattern.test(base)) return { type: rule.type, confidence: rule.confidence }
  return { type: 'OTHER', confidence: 40 }
}

function suggestShipment(fileName: string, shipments: ShipmentWithProgress[]) {
  const n = fileName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return shipments.find((s) => n.includes(s.jobNo.replace(/[^A-Z0-9]/g, '')) || n.includes(s.blNo.replace(/[^A-Z0-9]/g, '')))
}

const SAMPLE_FILES = [
  { name: 'BL_ONEYSGNA77512_final.pdf', size: 412 * 1024 },
  { name: 'Invoice_TML-SE2610-0147.pdf', size: 236 * 1024 },
  { name: 'DO_COSU6421887310.pdf', size: 188 * 1024 },
  { name: 'scan_0931.pdf', size: 1520 * 1024 },
]

const DOC_TYPE_ITEMS = (Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] }))

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: UploadPreset
  initialFiles?: File[]
  shipments: ShipmentWithProgress[]
  customers: Customer[]
  onUploaded: () => void
}

export function UploadDialog({ open, onOpenChange, preset, initialFiles, shipments, customers, onUploaded }: UploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docDate, setDocDate] = useState('2026-10-19')
  const [defaultShipment, setDefaultShipment] = useState(preset?.shipmentId ?? '')

  const shipmentItems = shipments.map((s) => ({ value: s.id, label: `${s.jobNo} · ${s.customerName}` }))

  const addFiles = (list: { name: string; size: number }[]) => {
    setFiles((prev) => [
      ...prev,
      ...list.map((f, i) => {
        const suggestion = preset?.docType && list.length === 1 ? { type: preset.docType, confidence: 100 } : suggestDocType(f.name)
        return {
          id: `${Date.now()}_${i}_${f.name}`,
          name: f.name,
          sizeKb: Math.max(1, Math.round(f.size / 1024)),
          type: suggestion.type,
          confidence: suggestion.confidence,
          shipmentId: suggestShipment(f.name, shipments)?.id ?? defaultShipment,
          progress: 0,
        }
      }),
    ])
  }

  const seeded = useRef(false)
  useEffect(() => {
    if (seeded.current || !initialFiles?.length) return
    seeded.current = true
    addFiles(initialFiles)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiles])

  const update = (id: string, patch: Partial<PendingFile>) =>
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)))

  const applyDefaultShipment = (id: string) => {
    setDefaultShipment(id)
    setFiles((prev) => prev.map((f) => (f.shipmentId ? f : { ...f, shipmentId: id })))
  }

  const unassigned = files.filter((f) => !f.shipmentId).length

  const handleUpload = () => {
    setUploading(true)
    const timer = window.setInterval(() => {
      setFiles((prev) => {
        const next = prev.map((f) => ({ ...f, progress: Math.min(100, f.progress + 12 + Math.random() * 22) }))
        if (next.every((f) => f.progress >= 100)) {
          window.clearInterval(timer)
          window.setTimeout(() => {
            setUploading(false)
            onUploaded()
            toast.success(`Đã tải lên ${next.length} chứng từ`, {
              description: 'OCR đang trích xuất nội dung — có thể tìm kiếm sau ít giây.',
            })
            onOpenChange(false)
          }, 350)
        }
        return next
      })
    }, 220)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !uploading && onOpenChange(o)}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Tải lên chứng từ</DialogTitle>
          <DialogDescription>
            Kéo thả nhiều file cùng lúc. Hệ thống tự nhận diện loại chứng từ và lô hàng từ tên file.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragging(false)
              addFiles(Array.from(e.dataTransfer.files))
            }}
            disabled={uploading}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
              dragging ? 'border-primary bg-accent' : 'border-border bg-muted/40 hover:border-primary/50 hover:bg-accent/50',
            )}
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CloudUploadIcon className="size-6" />
            </div>
            <p className="font-medium">{dragging ? 'Thả file vào đây' : 'Kéo thả file vào đây hoặc bấm để chọn'}</p>
            <p className="text-sm text-muted-foreground">PDF, JPG, PNG, XLSX · tối đa 50 MB mỗi file</p>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.docx"
            className="sr-only"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />

          {files.length === 0 ? (
            <div className="flex items-center justify-center">
              <Button variant="ghost" size="sm" onClick={() => addFiles(SAMPLE_FILES)}>
                <WandSparklesIcon data-icon="inline-start" />
                Dùng file mẫu để thử
              </Button>
            </div>
          ) : (
            <>
              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="upload-default-shipment">Gán cho Job / Lô hàng (mặc định)</FieldLabel>
                  <Select items={shipmentItems} value={defaultShipment || null} onValueChange={(v) => v && applyDefaultShipment(v as string)}>
                    <SelectTrigger id="upload-default-shipment" className="w-full">
                      <SelectValue placeholder="Chọn lô hàng" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {shipmentItems.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="upload-date">Ngày chứng từ</FieldLabel>
                  <Input id="upload-date" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
                </Field>
              </FieldGroup>

              <ul className="flex flex-col gap-2" aria-label="Danh sách file chờ tải lên">
                {files.map((f) => {
                  const shipment = shipments.find((s) => s.id === f.shipmentId)
                  const customer = customers.find((c) => c.id === shipment?.customerId)
                  return (
                    <li key={f.id} className="flex flex-col gap-3 rounded-lg border bg-card p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                          <FileTextIcon className="size-4" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <p className="truncate text-sm font-medium">{f.name}</p>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                            <span>{formatSize(f.sizeKb)}</span>
                            <span aria-hidden>·</span>
                            <span className="inline-flex items-center gap-1">
                              <SparklesIcon className="size-3 text-primary" />
                              {f.type === 'OTHER'
                                ? 'Chưa nhận diện được — vui lòng chọn loại'
                                : `Gợi ý: ${DOC_TYPE_SHORT[f.type]} (${f.confidence}%)`}
                            </span>
                            {customer && (
                              <>
                                <span aria-hidden>·</span>
                                <span>{customer.shortName}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setFiles((prev) => prev.filter((x) => x.id !== f.id))}
                          disabled={uploading}
                          aria-label={`Bỏ ${f.name}`}
                        >
                          <Trash2Icon />
                        </Button>
                      </div>
                      {uploading ? (
                        <Progress value={f.progress} aria-label={`Tiến độ tải ${f.name}`} />
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Select items={DOC_TYPE_ITEMS} value={f.type} onValueChange={(v) => v && update(f.id, { type: v as DocType, confidence: 100 })}>
                            <SelectTrigger size="sm" className="w-full" aria-label="Loại chứng từ">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {DOC_TYPE_ITEMS.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                          <Select items={shipmentItems} value={f.shipmentId || null} onValueChange={(v) => v && update(f.id, { shipmentId: v as string })}>
                            <SelectTrigger size="sm" className="w-full" aria-label="Lô hàng" aria-invalid={!f.shipmentId}>
                              <SelectValue placeholder="Chưa gán lô hàng" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                {shipmentItems.map((s) => (
                                  <SelectItem key={s.value} value={s.value}>
                                    {s.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {files.length > 0 && (
              <span className="flex items-center gap-2">
                {files.length} file
                {unassigned > 0 && <Badge variant="warning">{unassigned} chưa gán lô</Badge>}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Hủy
            </Button>
            <Button onClick={handleUpload} disabled={!files.length || unassigned > 0 || uploading}>
              {uploading ? <Spinner data-icon="inline-start" /> : <CloudUploadIcon data-icon="inline-start" />}
              {uploading ? 'Đang tải lên...' : `Tải lên ${files.length || ''}`.trim()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
