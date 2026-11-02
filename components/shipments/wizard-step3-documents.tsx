'use client'

import { useState, useRef } from 'react'
import {
  UploadCloudIcon,
  FileTextIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  RefreshCwIcon,
  XIcon,
  ArrowLeftIcon,
  CheckIcon,
  ClockIcon,
  ShieldAlertIcon,
  FileIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DOC_TYPE_LABEL } from '@/lib/labels'
import type { DocType } from '@/lib/types'
import { cn } from '@/lib/utils'

export interface UploadQueueItem {
  id: string
  file: File
  docType: DocType
  customTypeName?: string
  progress: number
  status: 'PENDING' | 'UPLOADING' | 'COMPLETED' | 'FAILED'
  error?: string
  uploadedDocId?: string
}

interface ChecklistRequirement {
  id: string
  docType: string
  isMandatory: boolean
  status: string
}

interface WizardStep3DocumentsProps {
  shipmentId: string
  jobNo: string
  requirements: ChecklistRequirement[]
  uploadedDocs: { id: string; type: string; title: string; fileName: string }[]
  loading: boolean
  onBack: () => void
  onFinalizeLater: () => void
  onComplete: () => void
  onDocUploaded: () => void
}

const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
const MAX_FILE_SIZE = 25 * 1024 * 1024 // 25MB

export function WizardStep3Documents({
  shipmentId,
  jobNo,
  requirements,
  uploadedDocs,
  loading,
  onBack,
  onFinalizeLater,
  onComplete,
  onDocUploaded,
}: WizardStep3DocumentsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [queue, setQueue] = useState<UploadQueueItem[]>([])
  const [isDragging, setIsDragging] = useState(false)

  // Danh sách các loại chứng từ sẵn có
  const docTypeOptions: { value: DocType; label: string }[] = (
    Object.keys(DOC_TYPE_LABEL) as DocType[]
  ).map((k) => ({
    value: k,
    label: DOC_TYPE_LABEL[k],
  }))

  const handleFilesAdded = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newItems: UploadQueueItem[] = []

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()

      if (!['.pdf', '.jpg', '.jpeg', '.png'].includes(ext)) {
        toast.error(`Tệp tin "${file.name}" không đúng định dạng. Chỉ chấp nhận PDF, JPG, PNG.`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        toast.error(`Tệp tin "${file.name}" vượt quá dung lượng tối đa 25MB.`)
        continue
      }

      // Đoán loại chứng từ theo tên file hoặc checklist còn thiếu
      let guessedType: DocType = 'OTHER'
      const upperName = file.name.toUpperCase()
      if (upperName.includes('BL') || upperName.includes('BILL') || upperName.includes('VANDON')) guessedType = 'BL'
      else if (upperName.includes('INV') || upperName.includes('HOADON')) guessedType = 'INVOICE'
      else if (upperName.includes('PKL') || upperName.includes('PACKING')) guessedType = 'PACKING_LIST'
      else if (upperName.includes('CO') || upperName.includes('ORIGIN')) guessedType = 'CO'
      else if (upperName.includes('CUSTOMS') || upperName.includes('HAIQUAN')) guessedType = 'CUSTOMS'
      else if (upperName.includes('DO') || upperName.includes('DELIVERY')) guessedType = 'DELIVERY_ORDER'
      else if (upperName.includes('AN') || upperName.includes('ARRIVAL')) guessedType = 'ARRIVAL_NOTICE'
      else if (upperName.includes('BOOKING')) guessedType = 'BOOKING'
      else {
        // Tìm loại còn thiếu trong checklist
        const missingReq = requirements.find(
          (r) => r.status === 'MISSING' && !queue.some((q) => q.docType === r.docType)
        )
        if (missingReq) guessedType = missingReq.docType as DocType
      }

      newItems.push({
        id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        file,
        docType: guessedType,
        progress: 0,
        status: 'PENDING',
      })
    }

    if (newItems.length > 0) {
      setQueue((prev) => [...prev, ...newItems])
      // Tự động upload từng file trong danh sách vừa thêm
      newItems.forEach((item) => executeUpload(item))
    }
  }

  const executeUpload = async (item: UploadQueueItem) => {
    // Cập nhật trạng thái item sang UPLOADING
    setQueue((prev) =>
      prev.map((q) => (q.id === item.id ? { ...q, status: 'UPLOADING', progress: 15, error: undefined } : q))
    )

    try {
      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('shipmentId', shipmentId)
      formData.append('type', item.docType)
      if (item.customTypeName) {
        formData.append('customTypeName', item.customTypeName)
      }

      // Giả lập tiến trình upload mượt mà
      const progressTimer = setInterval(() => {
        setQueue((prev) =>
          prev.map((q) => {
            if (q.id === item.id && q.status === 'UPLOADING' && q.progress < 85) {
              return { ...q, progress: q.progress + 15 }
            }
            return q
          })
        )
      }, 200)

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'x-csrf-protection': '1',
        },
        body: formData,
      })

      clearInterval(progressTimer)

      const data = await res.json()

      if (!res.ok) {
        const errorMsg = data.error || 'Tải lên tài liệu thất bại.'
        setQueue((prev) =>
          prev.map((q) => (q.id === item.id ? { ...q, status: 'FAILED', progress: 0, error: errorMsg } : q))
        )
        toast.error(`Tải lên "${item.file.name}" thất bại`, { description: errorMsg })
        return
      }

      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? {
                ...q,
                status: 'COMPLETED',
                progress: 100,
                uploadedDocId: data.document?.id || data.documents?.[0]?.id,
              }
            : q
        )
      )

      toast.success(`Đã tải lên "${item.file.name}"`, {
        description: `Đã lưu trữ qua StorageProvider và cập nhật checklist ${DOC_TYPE_LABEL[item.docType] || item.docType}.`,
      })

      onDocUploaded()
    } catch {
      setQueue((prev) =>
        prev.map((q) =>
          q.id === item.id
            ? { ...q, status: 'FAILED', progress: 0, error: 'Lỗi kết nối máy chủ khi tải lên.' }
            : q
        )
      )
      toast.error(`Lỗi kết nối khi tải lên "${item.file.name}"`)
    }
  }

  const handleRetry = (item: UploadQueueItem) => {
    executeUpload(item)
  }

  const handleRemoveQueueItem = (id: string) => {
    setQueue((prev) => prev.filter((q) => q.id !== id))
  }

  const handleDocTypeChange = (id: string, newType: DocType) => {
    setQueue((prev) =>
      prev.map((q) => (q.id === id ? { ...q, docType: newType } : q))
    )
  }

  // Đối soát checklist yêu cầu với chứng từ đã upload
  const effectiveUploadedDocTypes = new Set([
    ...uploadedDocs.map((d) => d.type),
    ...queue.filter((q) => q.status === 'COMPLETED').map((q) => q.docType),
  ])

  const missingCount = requirements.filter(
    (r) => !effectiveUploadedDocTypes.has(r.docType)
  ).length

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Bước 3: Đính kèm Chứng từ & Hoàn tất Lô hàng</CardTitle>
        <CardDescription>
          Tải lên các chứng từ bắt buộc cho lô hàng <span className="font-semibold text-foreground">{jobNo}</span> qua StorageProvider.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* BẢNG THEO DÕI CHECKLIST YÊU CẦU */}
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2Icon className="size-4 text-primary" />
              <span className="text-sm font-semibold">Danh mục Checklist Chứng từ Yêu cầu</span>
            </div>
            <Badge variant={missingCount === 0 ? 'success' : 'outline'} className="text-xs">
              {missingCount === 0 ? 'Đã đủ bộ chứng từ' : `Còn thiếu ${missingCount} loại chứng từ`}
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {requirements.map((req) => {
              const isUploaded = effectiveUploadedDocTypes.has(req.docType)
              const label = DOC_TYPE_LABEL[req.docType as DocType] || req.docType

              return (
                <div
                  key={req.id || req.docType}
                  className={cn(
                    'flex items-center justify-between rounded-md border p-2 text-xs transition-colors',
                    isUploaded
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-border bg-background text-muted-foreground'
                  )}
                >
                  <span className="font-medium truncate pr-1" title={label}>
                    {label}
                  </span>
                  {isUploaded ? (
                    <Badge variant="success" className="text-[10px] h-4 px-1 shrink-0">
                      Đã có
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0 text-muted-foreground">
                      Thiếu
                    </Badge>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* KHU VỰC KÉO THẢ TỆP TIN */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setIsDragging(false)
            handleFilesAdded(e.dataTransfer.files)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-all',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/50 hover:bg-muted/30'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => handleFilesAdded(e.target.files)}
            className="hidden"
          />

          <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloudIcon className="size-6" />
          </div>

          <p className="text-sm font-semibold text-foreground">
            Kéo thả hoặc nhấn để chọn tệp tin chứng từ
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Hỗ trợ chọn nhiều file: <span className="font-medium">PDF, JPG, PNG</span> (Tối đa 25MB/tệp).
          </p>
        </div>

        {/* DANH SÁCH TỆP ĐANG TẢI LÊN & TIẾN TRÌNH */}
        {queue.length > 0 && (
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Tiến trình tải lên danh sách tệp tin ({queue.length})</Label>
            <div className="space-y-2">
              {queue.map((item) => (
                <div key={item.id} className="rounded-lg border bg-card p-3 shadow-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FileIcon className="size-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate text-foreground" title={item.file.name}>
                          {item.file.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Chọn loại chứng từ cho tệp */}
                      <Select
                        value={item.docType}
                        onValueChange={(val) => handleDocTypeChange(item.id, val as DocType)}
                        disabled={item.status === 'UPLOADING' || item.status === 'COMPLETED'}
                      >
                        <SelectTrigger className="h-8 text-xs w-44">
                          <SelectValue placeholder="Chọn loại chứng từ" />
                        </SelectTrigger>
                        <SelectContent>
                          {docTypeOptions.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {/* Trạng thái / Thử lại / Xóa */}
                      {item.status === 'COMPLETED' && (
                        <span className="flex items-center gap-1 text-xs text-success font-medium">
                          <CheckCircle2Icon className="size-4" /> Thành công
                        </span>
                      )}

                      {item.status === 'FAILED' && (
                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRetry(item)}
                            className="h-8 text-xs gap-1"
                          >
                            <RefreshCwIcon className="size-3" />
                            Thử lại
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveQueueItem(item.id)}
                            className="size-8"
                          >
                            <XIcon className="size-4" />
                          </Button>
                        </div>
                      )}

                      {item.status === 'PENDING' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveQueueItem(item.id)}
                          className="size-8 text-muted-foreground"
                        >
                          <XIcon className="size-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Thanh tiến trình */}
                  {item.status === 'UPLOADING' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>Đang lưu trữ bền vững vào StorageProvider...</span>
                        <span>{item.progress}%</span>
                      </div>
                      <Progress value={item.progress} className="h-1.5" />
                    </div>
                  )}

                  {/* Báo lỗi riêng cho từng file */}
                  {item.status === 'FAILED' && item.error && (
                    <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
                      <ShieldAlertIcon className="size-3.5 shrink-0 mt-0.5" />
                      <span>{item.error}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DANH SÁCH CHỨNG TỪ ĐÃ GẮN VÀO LÔ */}
        {uploadedDocs.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <Label className="text-xs font-semibold text-muted-foreground">
              Chứng từ hiện có trong hồ sơ lô hàng ({uploadedDocs.length})
            </Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {uploadedDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileTextIcon className="size-4 text-primary shrink-0" />
                    <span className="font-medium truncate text-foreground">{doc.title}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                    {DOC_TYPE_LABEL[doc.type as DocType] || doc.type}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* NÚT ĐIỀU HƯỚNG VÀ HOÀN TẤT */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t">
          <Button type="button" variant="outline" onClick={onBack} disabled={loading} className="w-full sm:w-auto gap-2">
            <ArrowLeftIcon className="size-4" />
            Quay lại bước 2
          </Button>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="secondary"
              onClick={onFinalizeLater}
              disabled={loading}
              className="w-full sm:w-auto gap-2"
            >
              <ClockIcon className="size-4" />
              Hoàn tất sau (Lưu lô & bổ sung chứng từ sau)
            </Button>

            <Button
              type="button"
              onClick={onComplete}
              disabled={loading}
              className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90"
            >
              <CheckIcon className="size-4" />
              Hoàn tất lô hàng
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
