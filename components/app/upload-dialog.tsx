'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  AlertCircleIcon,
  CameraIcon,
  CloudUploadIcon,
  FileTextIcon,
  SparklesIcon,
  Trash2Icon,
  WandSparklesIcon,
} from 'lucide-react'
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
  customTypeName?: string
  confidence: number
  suggestedShipment?: ShipmentWithProgress
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
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(base)) return { type: rule.type, confidence: rule.confidence }
  }
  return { type: 'OTHER', confidence: 40 }
}

function suggestShipment(fileName: string, shipments: ShipmentWithProgress[]) {
  const n = fileName.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return shipments.find((s) => {
    const jobKey = s.jobNo.replace(/[^A-Z0-9]/g, '')
    const blKey = (s.blNo || '').replace(/[^A-Z0-9]/g, '')
    return (jobKey && n.includes(jobKey)) || (blKey && n.includes(blKey))
  })
}

const SAMPLE_FILES = [
  { name: 'BL_MAEU262104471.pdf', size: 412 * 1024 },
  { name: 'Invoice_INV-2026-VN-994.pdf', size: 236 * 1024 },
  { name: 'DO_COSU6421887310.pdf', size: 188 * 1024 },
]

const DOC_TYPE_ITEMS = (Object.keys(DOC_TYPE_LABEL) as DocType[]).map((t) => ({
  value: t,
  label: t === 'OTHER' ? 'Khác (tự nhập)' : DOC_TYPE_LABEL[t],
}))

interface UploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: UploadPreset
  initialFiles?: File[]
  shipments: ShipmentWithProgress[]
  customers: Customer[]
  onUploaded: () => void
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024 // 25MB

export function UploadDialog({
  open,
  onOpenChange,
  preset,
  initialFiles,
  shipments,
  customers,
  onUploaded,
}: UploadDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<PendingFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [docDate, setDocDate] = useState('2026-10-19')
  const [selectedShipmentId, setSelectedShipmentId] = useState(preset?.shipmentId ?? '')

  useEffect(() => {
    if (preset?.shipmentId) {
      setSelectedShipmentId(preset.shipmentId)
    }
  }, [preset?.shipmentId])

  const shipmentItems = shipments.map((s) => ({
    value: s.id,
    label: `${s.jobNo} · ${s.customerName || 'Chưa xác định'}${s.blNo ? ` · B/L: ${s.blNo}` : ''}`,
  }))

  const rawFilesRef = useRef<Map<string, File>>(new Map())

  const addFiles = (list: (File | { name: string; size: number })[]) => {
    const validItems: PendingFile[] = []

    for (let i = 0; i < list.length; i++) {
      const f = list[i]
      if (f.size > MAX_FILE_SIZE_BYTES) {
        toast.error(`Tập tin "${f.name}" (${formatSize(Math.round(f.size / 1024))}) vượt quá giới hạn tối đa 25MB.`)
        continue
      }

      const id = `${Date.now()}_${i}_${f.name}`
      if ('slice' in f && typeof (f as any).slice === 'function') {
        rawFilesRef.current.set(id, f as File)
      } else {
        const blob = new Blob([`TML LOGISTICS DOCUMENT\nFile: ${f.name}\nSize: ${f.size}`], { type: 'application/pdf' })
        const mockFile = new File([blob], f.name, { type: 'application/pdf' })
        rawFilesRef.current.set(id, mockFile)
      }

      const suggestion = preset?.docType && list.length === 1 ? { type: preset.docType, confidence: 100 } : suggestDocType(f.name)
      const suggested = suggestShipment(f.name, shipments)

      validItems.push({
        id,
        name: f.name,
        sizeKb: Math.max(1, Math.round(f.size / 1024)),
        type: suggestion.type,
        confidence: suggestion.confidence,
        suggestedShipment: suggested,
        progress: 0,
      })
    }

    setFiles((prev) => [...prev, ...validItems])
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

  const handleUpload = async () => {
    if (!selectedShipmentId) {
      toast.error('Vui lòng chọn Lô hàng / Job trước khi tải lên.')
      return
    }

    setUploading(true)
    let uploadSuccessCount = 0

    try {
      for (const item of files) {
        const formData = new FormData()
        formData.set('shipmentId', selectedShipmentId)
        formData.set('docDate', docDate)
        formData.set('docType', item.type)
        if (item.customTypeName) {
          formData.set('customTypeName', item.customTypeName)
        }

        const realFile = rawFilesRef.current.get(item.id)
        if (realFile) {
          formData.append('files', realFile)
        }

        const res = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: {
            'x-csrf-protection': '1',
          },
          body: formData,
        })

        if (res.ok) {
          uploadSuccessCount++
          setFiles((prev) => prev.map((f) => (f.id === item.id ? { ...f, progress: 100 } : f)))
        } else {
          let errorMsg = ''
          try {
            const errData = await res.json()
            errorMsg = errData.error || errData.message || ''
          } catch {
            errorMsg = `Lỗi phản hồi HTTP ${res.status}: ${res.statusText || 'Máy chủ không xử lý được yêu cầu'}`
          }
          toast.error(`Lỗi tải lên tập tin "${item.name}":`, { description: errorMsg || 'Máy chủ từ chối yêu cầu tải lên.' })
        }
      }

      if (uploadSuccessCount > 0) {
        toast.success(`Đã tải lên ${uploadSuccessCount}/${files.length} chứng từ thành công!`)
        onUploaded()
        onOpenChange(false)
        setFiles([])
      }
    } catch (err: any) {
      console.error('Lỗi khi gửi upload:', err)
      toast.error('Lỗi kết nối khi tải chứng từ lên.')
    } finally {
      setUploading(false)
    }
  }

  const activeShipment = shipments.find((s) => s.id === selectedShipmentId)
  const activeCustomer = customers.find((c) => c.id === activeShipment?.customerId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Tải lên chứng từ</DialogTitle>
          <DialogDescription>
            Đính kèm chứng từ vào lô hàng. Hệ thống tự động phân loại và trích xuất thông tin.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
          {/* Ô CHỌN LÔ HÀNG DUY NHẤT CHO CẢ LƯỢT TẢI */}
          <FieldGroup className="grid gap-4 sm:grid-cols-2 rounded-lg border bg-muted/20 p-3.5">
            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="upload-single-shipment">
                Gán cho Job / Lô hàng <span className="text-destructive">*</span>
              </FieldLabel>
              <Select
                items={shipmentItems}
                value={selectedShipmentId || null}
                onValueChange={(v) => v && setSelectedShipmentId(v as string)}
              >
                <SelectTrigger id="upload-single-shipment" className={cn('w-full', !selectedShipmentId && 'border-amber-500')}>
                  <SelectValue placeholder="-- Chọn lô hàng áp dụng --" />
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
              {activeCustomer && (
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  Doanh nghiệp: <span className="font-medium text-foreground">{activeCustomer.name}</span>
                </p>
              )}
            </Field>

            <Field className="sm:col-span-1">
              <FieldLabel htmlFor="upload-date">Ngày chứng từ</FieldLabel>
              <Input id="upload-date" type="date" value={docDate} onChange={(e) => setDocDate(e.target.value)} />
            </Field>
          </FieldGroup>

          {/* DROPZONE: CHỈ NHẬN PDF, JPG, PNG TỐI ĐA 25MB */}
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
              'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors',
              dragging ? 'border-primary bg-accent' : 'border-border bg-muted/40 hover:border-primary/50 hover:bg-accent/50'
            )}
          >
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CloudUploadIcon className="size-5" />
            </div>
            <p className="font-medium text-sm">
              {dragging ? 'Thả file vào đây' : 'Kéo thả file vào đây hoặc bấm để chọn'}
            </p>
            <p className="text-xs text-muted-foreground">PDF, JPG, PNG · tối đa 25 MB mỗi file</p>
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            className="sr-only"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />

          {files.length === 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                render={<Link href="/scan" onClick={() => onOpenChange(false)} />}
                nativeButton={false}
              >
                <CameraIcon data-icon="inline-start" />
                Chụp ảnh / Quét qua Camera
              </Button>
              <Button variant="ghost" size="sm" onClick={() => addFiles(SAMPLE_FILES)}>
                <WandSparklesIcon data-icon="inline-start" />
                Dùng file mẫu để thử
              </Button>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5" aria-label="Danh sách file chờ tải lên">
              {files.map((f) => {
                const hasSuggestedDifferent =
                  f.suggestedShipment && f.suggestedShipment.id !== selectedShipmentId

                return (
                  <li key={f.id} className="flex flex-col gap-2.5 rounded-lg border bg-card p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <FileTextIcon className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <span>{formatSize(f.sizeKb)}</span>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1 text-primary">
                            <SparklesIcon className="size-3" />
                            {f.type === 'OTHER'
                              ? 'Chưa nhận diện được — vui lòng chọn loại'
                              : `Gợi ý: ${DOC_TYPE_SHORT[f.type]} (${f.confidence}%)`}
                          </span>
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

                    {/* GỢI Ý LÔ HÀNG NẾU TÊN FILE TRÙNG KHỚP LÔ KHÁC (KHÔNG TỰ ĐỔI NGẦM) */}
                    {hasSuggestedDifferent && (
                      <div className="flex items-center justify-between rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-300">
                        <span>
                          Gợi ý từ tên file: Có phải lô <strong>{f.suggestedShipment?.jobNo}</strong>?
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-amber-800 dark:text-amber-200 underline hover:no-underline"
                          onClick={() => {
                            if (f.suggestedShipment) {
                              setSelectedShipmentId(f.suggestedShipment.id)
                              toast.info(`Đã áp dụng lô "${f.suggestedShipment.jobNo}" cho cả lượt tải.`)
                            }
                          }}
                        >
                          Áp dụng cho lượt tải này
                        </Button>
                      </div>
                    )}

                    {uploading ? (
                      <Progress value={f.progress} aria-label={`Tiến độ tải ${f.name}`} />
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="w-full">
                          <Select
                            items={DOC_TYPE_ITEMS}
                            value={f.type}
                            onValueChange={(v) => v && update(f.id, { type: v as DocType, confidence: 100 })}
                          >
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
                        </div>
                        {f.type === 'OTHER' && (
                          <Input
                            className="h-8 text-xs"
                            placeholder="Nhập tên loại chứng từ..."
                            value={f.customTypeName ?? ''}
                            onChange={(e) => update(f.id, { customTypeName: e.target.value })}
                          />
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            {!selectedShipmentId ? (
              <span className="flex items-center gap-1 text-destructive font-medium">
                <AlertCircleIcon className="size-3.5" />
                Vui lòng chọn Lô hàng / Job ở phía trên
              </span>
            ) : (
              <span>
                {files.length} tập tin sẽ được gán vào <strong>{activeShipment?.jobNo}</strong>
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
              Hủy
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!files.length || !selectedShipmentId || uploading}
              title={!selectedShipmentId ? 'Vui lòng chọn lô hàng trước khi tải lên' : undefined}
            >
              {uploading ? <Spinner data-icon="inline-start" /> : <CloudUploadIcon data-icon="inline-start" />}
              {uploading ? 'Đang tải lên...' : `Tải lên ${files.length ? `(${files.length})` : ''}`.trim()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
