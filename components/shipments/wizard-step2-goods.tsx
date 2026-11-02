'use client'

import { useState } from 'react'
import {
  PlusIcon,
  Trash2Icon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SaveIcon,
  Building2Icon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  BoxesIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  validateVietnameseTaxCode,
  normalizeAndValidateHsCode,
} from '@/lib/validations/shipment-wizard'
import { cn } from '@/lib/utils'

export interface CustomerOption {
  id: string
  name: string
  shortName: string
  taxCode: string
}

export interface GoodsRow {
  id?: string
  description: string
  hsCode: string
}

export interface Step2Data {
  customerId: string
  // Tạo mới customer inline nếu cần
  newCustomer?: {
    name: string
    shortName: string
    taxCode: string
  }
  goods: GoodsRow[]
  // Tùy chọn
  blNo?: string
  etd?: string
  eta?: string
  carrier?: string
  vessel?: string
  voyage?: string
  containerNo?: string
  incoterms?: string
  notes?: string
}

interface WizardStep2GoodsProps {
  initialData: Step2Data
  customers: CustomerOption[]
  loading: boolean
  onBack: () => void
  onNext: (data: Step2Data) => void
  onSaveDraft: (data: Step2Data) => void
}

export function WizardStep2Goods({
  initialData,
  customers,
  loading,
  onBack,
  onNext,
  onSaveDraft,
}: WizardStep2GoodsProps) {
  const [data, setData] = useState<Step2Data>({
    ...initialData,
    goods: initialData.goods && initialData.goods.length > 0
      ? initialData.goods
      : [{ description: '', hsCode: '' }],
  })

  const [isCreatingCustomer, setIsCreatingCustomer] = useState(data.customerId === 'new')
  const [newCustName, setNewCustName] = useState(data.newCustomer?.name || '')
  const [newCustShortName, setNewCustShortName] = useState(data.newCustomer?.shortName || '')
  const [newCustTaxCode, setNewCustTaxCode] = useState(data.newCustomer?.taxCode || '')

  const [showOptionalFields, setShowOptionalFields] = useState(
    Boolean(
      data.blNo ||
        data.etd ||
        data.eta ||
        data.carrier ||
        data.vessel ||
        data.voyage ||
        data.containerNo ||
        data.incoterms ||
        data.notes
    )
  )

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Chọn khách hàng có sẵn
  const handleSelectCustomer = (val: string) => {
    if (val === 'new') {
      setIsCreatingCustomer(true)
      setData((prev) => ({ ...prev, customerId: 'new' }))
    } else {
      setIsCreatingCustomer(false)
      const found = customers.find((c) => c.id === val)
      setData((prev) => ({
        ...prev,
        customerId: val,
        newCustomer: undefined,
      }))
    }
    if (errors.customer) setErrors((prev) => ({ ...prev, customer: '' }))
  }

  // Quản lý dòng hàng hóa
  const handleAddRow = () => {
    setData((prev) => ({
      ...prev,
      goods: [...prev.goods, { description: '', hsCode: '' }],
    }))
  }

  const handleRemoveRow = (index: number) => {
    if (data.goods.length <= 1) return
    setData((prev) => ({
      ...prev,
      goods: prev.goods.filter((_, idx) => idx !== index),
    }))
  }

  const handleGoodsChange = (index: number, field: 'description' | 'hsCode', val: string) => {
    setData((prev) => {
      const next = [...prev.goods]
      next[index] = { ...next[index], [field]: val }
      return { ...prev, goods: next }
    })
    const errKey = `goods_${index}_${field}`
    if (errors[errKey]) {
      setErrors((prev) => ({ ...prev, [errKey]: '' }))
    }
  }

  // Thẩm định bước 2
  const validate = (): boolean => {
    const errs: Record<string, string> = {}

    // 1. Kiểm tra khách hàng
    if (isCreatingCustomer) {
      if (!newCustName.trim()) {
        errs.newCustName = 'Vui lòng nhập tên công ty / doanh nghiệp.'
      }
      if (!newCustTaxCode.trim()) {
        errs.newCustTaxCode = 'Vui lòng nhập mã số thuế.'
      } else {
        const mstCheck = validateVietnameseTaxCode(newCustTaxCode)
        if (!mstCheck.valid) {
          errs.newCustTaxCode = mstCheck.message || 'Mã số thuế không đúng chuẩn.'
        }
      }
    } else if (!data.customerId || data.customerId === 'new') {
      errs.customer = 'Vui lòng chọn doanh nghiệp/khách hàng hoặc tạo mới.'
    }

    // 2. Kiểm tra hàng hóa & HS Code
    if (!data.goods || data.goods.length === 0) {
      errs.goodsGlobal = 'Bảng hàng hóa bắt buộc phải có ít nhất 1 dòng.'
    } else {
      data.goods.forEach((item, idx) => {
        if (!item.description || !item.description.trim()) {
          errs[`goods_${idx}_description`] = 'Mô tả hàng hóa không được để trống.'
        }
        if (item.hsCode && item.hsCode.trim()) {
          const hsCheck = normalizeAndValidateHsCode(item.hsCode)
          if (!hsCheck.valid) {
            errs[`goods_${idx}_hsCode`] = hsCheck.message || 'Mã HS Code không hợp lệ.'
          }
        }
      })
    }

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const buildSubmissionData = (): Step2Data => {
    return {
      ...data,
      newCustomer: isCreatingCustomer
        ? {
            name: newCustName.trim(),
            shortName: (newCustShortName || newCustName).trim(),
            taxCode: newCustTaxCode.trim(),
          }
        : undefined,
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      onNext(buildSubmissionData())
    }
  }

  const selectedCust = customers.find((c) => c.id === data.customerId)
  const mstValidationResult = isCreatingCustomer && newCustTaxCode
    ? validateVietnameseTaxCode(newCustTaxCode)
    : null

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Bước 2: Thông tin Doanh nghiệp & Chi tiết Hàng hóa</CardTitle>
        <CardDescription>
          Khai báo thông tin khách hàng, mã số thuế thẩm định và danh mục mã HS Code cho từng mặt hàng.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* PHẦN 1: DOANH NGHIỆP / KHÁCH HÀNG */}
          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Building2Icon className="size-4 text-primary" />
                Thông tin Khách hàng / Doanh nghiệp <span className="text-destructive">*</span>
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsCreatingCustomer(!isCreatingCustomer)
                  if (!isCreatingCustomer) {
                    setData((prev) => ({ ...prev, customerId: 'new' }))
                  }
                }}
                className="text-xs text-primary h-7"
              >
                {isCreatingCustomer ? '← Chọn từ danh sách có sẵn' : '+ Tạo mới doanh nghiệp'}
              </Button>
            </div>

            {!isCreatingCustomer ? (
              <div className="space-y-2">
                <Select value={data.customerId} onValueChange={(val) => handleSelectCustomer(val || '')} disabled={loading}>
                  <SelectTrigger className={cn(errors.customer && 'border-destructive')}>
                    <SelectValue placeholder="Chọn doanh nghiệp / khách hàng" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new" className="font-medium text-primary">
                      + Tạo mới doanh nghiệp...
                    </SelectItem>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} — MST: {c.taxCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.customer && <p className="text-xs text-destructive">{errors.customer}</p>}

                {selectedCust && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <span>Mã số thuế:</span>
                    <Badge variant="outline" className="font-mono bg-background">
                      {selectedCust.taxCode}
                    </Badge>
                    <span className="flex items-center gap-1 text-success text-[11px]">
                      <CheckCircle2Icon className="size-3" /> Đã xác thực
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="newCustName">
                      Tên đầy đủ của doanh nghiệp <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="newCustName"
                      placeholder="Công ty Cổ phần Giao nhận..."
                      value={newCustName}
                      onChange={(e) => {
                        setNewCustName(e.target.value)
                        if (errors.newCustName) setErrors({ ...errors, newCustName: '' })
                      }}
                      disabled={loading}
                      className={cn(errors.newCustName && 'border-destructive')}
                    />
                    {errors.newCustName && <p className="text-xs text-destructive">{errors.newCustName}</p>}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="newCustShortName">Tên viết tắt / Tên giao dịch</Label>
                    <Input
                      id="newCustShortName"
                      placeholder="Tên ngắn gọn..."
                      value={newCustShortName}
                      onChange={(e) => setNewCustShortName(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="newCustTaxCode">
                      Mã số thuế (10 hoặc 13 chữ số) <span className="text-destructive">*</span>
                    </Label>
                    {mstValidationResult && (
                      <span
                        className={cn(
                          'text-xs flex items-center gap-1',
                          mstValidationResult.valid ? 'text-success' : 'text-destructive'
                        )}
                      >
                        {mstValidationResult.valid ? (
                          <>
                            <CheckCircle2Icon className="size-3.5" /> MST hợp lệ theo chuẩn Tổng cục Thuế
                          </>
                        ) : (
                          <>
                            <AlertCircleIcon className="size-3.5" /> Sai số kiểm tra checksum
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <Input
                    id="newCustTaxCode"
                    placeholder="Ví dụ: 0100109106 hoặc 0100109106-001"
                    value={newCustTaxCode}
                    onChange={(e) => {
                      setNewCustTaxCode(e.target.value)
                      if (errors.newCustTaxCode) setErrors({ ...errors, newCustTaxCode: '' })
                    }}
                    disabled={loading}
                    className={cn(errors.newCustTaxCode && 'border-destructive font-mono')}
                  />
                  {errors.newCustTaxCode && <p className="text-xs text-destructive">{errors.newCustTaxCode}</p>}
                </div>
              </div>
            )}
          </div>

          {/* PHẦN 2: BẢNG HÀNG HÓA & HS CODE */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <BoxesIcon className="size-4 text-primary" />
                  Danh mục Hàng hóa & Mã HS Code <span className="text-destructive">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tối thiểu 1 dòng hàng. Mô tả hàng hóa là bắt buộc; Mã HS Code không bắt buộc (nếu có: 4-10 chữ số, cho phép dấu chấm).
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddRow}
                disabled={loading}
                className="gap-1.5 text-xs"
              >
                <PlusIcon className="size-3.5" />
                Thêm dòng hàng
              </Button>
            </div>

            {errors.goodsGlobal && <p className="text-xs text-destructive">{errors.goodsGlobal}</p>}

            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="py-2.5 px-3 font-medium w-12 text-center">STT</th>
                    <th className="py-2.5 px-3 font-medium">Mô tả hàng hóa <span className="text-destructive">*</span></th>
                    <th className="py-2.5 px-3 font-medium w-48 sm:w-60">Mã HS Code <span className="text-muted-foreground font-normal">(tùy chọn)</span></th>
                    <th className="py-2.5 px-3 font-medium w-14 text-center">Xóa</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.goods.map((row, idx) => {
                    const descErr = errors[`goods_${idx}_description`]
                    const hsErr = errors[`goods_${idx}_hsCode`]

                    return (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors">
                        <td className="py-2 px-3 text-center text-xs text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <Input
                            placeholder="Ví dụ: Cá tra philê đông lạnh / Đồ gỗ nội thất..."
                            value={row.description}
                            onChange={(e) => handleGoodsChange(idx, 'description', e.target.value)}
                            disabled={loading}
                            className={cn('h-9', descErr && 'border-destructive')}
                          />
                          {descErr && <p className="text-[11px] text-destructive mt-1">{descErr}</p>}
                        </td>
                        <td className="py-2 px-3">
                          <Input
                            placeholder="Không bắt buộc (VD: 0304.62.00)"
                            value={row.hsCode}
                            onChange={(e) => handleGoodsChange(idx, 'hsCode', e.target.value)}
                            disabled={loading}
                            className={cn('h-9 font-mono', hsErr && 'border-destructive')}
                          />
                          {hsErr && <p className="text-[11px] text-destructive mt-1">{hsErr}</p>}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRow(idx)}
                            disabled={loading || data.goods.length <= 1}
                            className="size-8 text-muted-foreground hover:text-destructive disabled:opacity-30"
                          >
                            <Trash2Icon className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PHẦN 3: THÔNG TIN LOGISTICS TÙY CHỌN */}
          <div className="rounded-lg border">
            <button
              type="button"
              onClick={() => setShowOptionalFields(!showOptionalFields)}
              className="flex w-full items-center justify-between p-3.5 text-left text-sm font-medium hover:bg-muted/20"
            >
              <span>Thông tin vận tải bổ sung (B/L, Ngày ETD/ETA, Hãng tàu, Container...)</span>
              {showOptionalFields ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
            </button>

            {showOptionalFields && (
              <div className="p-4 pt-1 border-t space-y-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="blNo">Số vận đơn (B/L No)</Label>
                    <Input
                      id="blNo"
                      placeholder="MAEU262104471"
                      value={data.blNo || ''}
                      onChange={(e) => setData({ ...data, blNo: e.target.value })}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="etd">Ngày khởi hành (ETD)</Label>
                    <Input
                      id="etd"
                      type="date"
                      value={data.etd || ''}
                      onChange={(e) => setData({ ...data, etd: e.target.value })}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="eta">Ngày đến dự kiến (ETA)</Label>
                    <Input
                      id="eta"
                      type="date"
                      value={data.eta || ''}
                      onChange={(e) => setData({ ...data, eta: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="carrier">Hãng vận chuyển (Carrier)</Label>
                    <Input
                      id="carrier"
                      placeholder="Maersk / ONE / Vietnam Airlines..."
                      value={data.carrier || ''}
                      onChange={(e) => setData({ ...data, carrier: e.target.value })}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="vessel">Tên tàu / Chuyến bay (Vessel/Flight)</Label>
                    <Input
                      id="vessel"
                      placeholder="ONE CONTEMPLATION..."
                      value={data.vessel || ''}
                      onChange={(e) => setData({ ...data, vessel: e.target.value })}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="containerNo">Số Container / Seal</Label>
                    <Input
                      id="containerNo"
                      placeholder="MSKU9182344 / 40HC..."
                      value={data.containerNo || ''}
                      onChange={(e) => setData({ ...data, containerNo: e.target.value })}
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="notes">Ghi chú nghiệp vụ chứng từ</Label>
                  <Textarea
                    id="notes"
                    placeholder="Ghi chú nội bộ cho chuyên viên chứng từ..."
                    value={data.notes || ''}
                    onChange={(e) => setData({ ...data, notes: e.target.value })}
                    disabled={loading}
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Nút hành động */}
          <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button type="button" variant="outline" onClick={onBack} disabled={loading} className="gap-2">
                <ArrowLeftIcon className="size-4" />
                Quay lại bước 1
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onSaveDraft(buildSubmissionData())}
                disabled={loading}
                className="gap-2"
              >
                <SaveIcon className="size-4" />
                Lưu nháp
              </Button>
            </div>

            <Button type="submit" disabled={loading} className="w-full sm:w-auto gap-2">
              Tiếp tục bước 3 (Đính kèm chứng từ)
              <ArrowRightIcon className="size-4" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
