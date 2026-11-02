'use client'

import { useState } from 'react'
import { ShipIcon, PlaneIcon, TruckIcon, RefreshCwIcon, ArrowRightIcon, SaveIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface DepartmentItem {
  id: string
  name: string
  code: string
}

interface Step1Data {
  jobNo: string
  departmentId: string
  mode: 'sea' | 'air' | 'road'
  origin: string
  destination: string
}

interface WizardStep1BasicProps {
  initialData: Step1Data
  allowedDepartments: DepartmentItem[]
  loading: boolean
  onNext: (data: Step1Data) => void
  onSaveDraft: (data: Step1Data) => void
}

const MODES = [
  { id: 'sea', label: 'Đường biển (Sea)', icon: ShipIcon, desc: 'Container FCL / LCL' },
  { id: 'air', label: 'Đường hàng không (Air)', icon: PlaneIcon, desc: 'Vận chuyển Air Cargo' },
  { id: 'road', label: 'Đường bộ (Road)', icon: TruckIcon, desc: 'Xe tải / Xe kéo biên giới' },
] as const

const COMMON_PORTS = [
  'Cát Lái, Việt Nam (VNSGN)',
  'Hải Phòng, Việt Nam (VNHPH)',
  'Đà Nẵng, Việt Nam (VNDAD)',
  'Cái Mép, Việt Nam (VNCMT)',
  'Tân Sơn Nhất, Việt Nam (SGN)',
  'Nội Bài, Việt Nam (HAN)',
  'Singapore Port (SGSIN)',
  'Rotterdam, Hà Lan (NLRTM)',
  'Shanghai, Trung Quốc (CNSHA)',
  'Los Angeles, Hoa Kỳ (USLAX)',
  'Hamburg, Đức (DEHAM)',
]

export function WizardStep1Basic({
  initialData,
  allowedDepartments,
  loading,
  onNext,
  onSaveDraft,
}: WizardStep1BasicProps) {
  const [data, setData] = useState<Step1Data>(initialData)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!data.jobNo || !data.jobNo.trim()) {
      errs.jobNo = 'Mã hồ sơ lô hàng (Job No) không được để trống.'
    }
    if (!data.departmentId) {
      errs.departmentId = 'Vui lòng chọn phòng ban phụ trách lô hàng.'
    }
    if (!data.origin || !data.origin.trim()) {
      errs.origin = 'Điểm xuất phát (Origin) không được để trống.'
    }
    if (!data.destination || !data.destination.trim()) {
      errs.destination = 'Điểm đến (Destination) không được để trống.'
    }
    if (
      data.origin &&
      data.destination &&
      data.origin.trim().toLowerCase() === data.destination.trim().toLowerCase()
    ) {
      errs.destination = 'Điểm đến không được trùng với điểm xuất phát.'
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleGenerateJobNo = () => {
    const prefix = data.mode === 'air' ? 'AE' : data.mode === 'road' ? 'RD' : 'SE'
    const date = new Date()
    const year = String(date.getFullYear()).slice(-2)
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const rand = Math.floor(1000 + Math.random() * 9000)
    setData((prev) => ({ ...prev, jobNo: `TML-${prefix}${year}${month}-${rand}` }))
    if (errors.jobNo) setErrors((prev) => ({ ...prev, jobNo: '' }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onNext(data)
    }
  }

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Bước 1: Khởi tạo thông tin cơ sở lô hàng</CardTitle>
        <CardDescription>
          Định danh mã Job, phòng ban phụ trách, phương thức vận chuyển và tuyến hành trình.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Hàng 1: Mã Job & Phòng ban */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="jobNo">
                  Mã hồ sơ lô hàng (Job No) <span className="text-destructive">*</span>
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateJobNo}
                  className="h-7 text-xs text-primary gap-1"
                >
                  <RefreshCwIcon className="size-3" />
                  Sinh mã tự động
                </Button>
              </div>
              <Input
                id="jobNo"
                placeholder="TML-SE2611-1024"
                value={data.jobNo}
                onChange={(e) => {
                  setData({ ...data, jobNo: e.target.value })
                  if (errors.jobNo) setErrors({ ...errors, jobNo: '' })
                }}
                disabled={loading}
                className={cn(errors.jobNo && 'border-destructive focus-visible:ring-destructive')}
              />
              {errors.jobNo && <p className="text-xs text-destructive">{errors.jobNo}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="departmentId">
                Phòng ban phụ trách <span className="text-destructive">*</span>
              </Label>
              <Select
                value={data.departmentId}
                onValueChange={(val) => {
                  const safeVal = val || ''
                  setData({ ...data, departmentId: safeVal })
                  if (errors.departmentId) setErrors({ ...errors, departmentId: '' })
                }}
                disabled={loading}
              >
                <SelectTrigger id="departmentId" className={cn(errors.departmentId && 'border-destructive')}>
                  <SelectValue placeholder="Chọn phòng ban phụ trách" />
                </SelectTrigger>
                <SelectContent>
                  {allowedDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name} ({dept.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.departmentId && <p className="text-xs text-destructive">{errors.departmentId}</p>}
            </div>
          </div>

          {/* Hàng 2: Phương thức vận chuyển */}
          <div className="space-y-2">
            <Label>
              Phương thức vận chuyển <span className="text-destructive">*</span>
            </Label>
            <div className="grid gap-3 sm:grid-cols-3">
              {MODES.map((m) => {
                const Icon = m.icon
                const isSelected = data.mode === m.id
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setData({ ...data, mode: m.id as any })}
                    disabled={loading}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border p-3.5 text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5 text-primary shadow-sm'
                        : 'border-border hover:bg-muted/40 text-muted-foreground'
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border',
                        isSelected ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-background'
                      )}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <div className={cn('text-sm font-semibold', isSelected ? 'text-foreground' : '')}>{m.label}</div>
                      <div className="text-xs text-muted-foreground">{m.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Hàng 3: Điểm xuất phát & Điểm đích */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="origin">
                Điểm xuất phát (Origin / Cảng đi) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="origin"
                list="ports-list"
                placeholder="Ví dụ: Cát Lái, Việt Nam (VNSGN)"
                value={data.origin}
                onChange={(e) => {
                  setData({ ...data, origin: e.target.value })
                  if (errors.origin) setErrors({ ...errors, origin: '' })
                }}
                disabled={loading}
                className={cn(errors.origin && 'border-destructive')}
              />
              {errors.origin && <p className="text-xs text-destructive">{errors.origin}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination">
                Điểm đến (Destination / Cảng dỡ) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="destination"
                list="ports-list"
                placeholder="Ví dụ: Rotterdam, Hà Lan (NLRTM)"
                value={data.destination}
                onChange={(e) => {
                  setData({ ...data, destination: e.target.value })
                  if (errors.destination) setErrors({ ...errors, destination: '' })
                }}
                disabled={loading}
                className={cn(errors.destination && 'border-destructive')}
              />
              {errors.destination && <p className="text-xs text-destructive">{errors.destination}</p>}
            </div>

            <datalist id="ports-list">
              {COMMON_PORTS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
          </div>

          {/* Nút hành động */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onSaveDraft(data)}
              disabled={loading || !data.jobNo}
              className="w-full sm:w-auto gap-2"
            >
              <SaveIcon className="size-4" />
              Lưu nháp bước 1
            </Button>

            <Button type="submit" disabled={loading} className="w-full sm:w-auto gap-2">
              Tiếp tục bước 2
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
