'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon, FileStackIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { WizardStepper } from './wizard-stepper'
import { WizardStep1Basic } from './wizard-step1-basic'
import { WizardStep2Goods, type Step2Data } from './wizard-step2-goods'
import { WizardStep3Documents } from './wizard-step3-documents'

interface DepartmentItem {
  id: string
  name: string
  code: string
}

interface CustomerItem {
  id: string
  name: string
  shortName: string
  taxCode: string
}

interface ShipmentWizardViewProps {
  allowedDepartments: DepartmentItem[]
  customers: CustomerItem[]
  suggestedJobNo: string
  initialShipment?: any
}

export function ShipmentWizardView({
  allowedDepartments,
  customers,
  suggestedJobNo,
  initialShipment,
}: ShipmentWizardViewProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [shipmentId, setShipmentId] = useState<string | null>(initialShipment?.id || searchParams.get('id') || null)
  const [currentStep, setCurrentStep] = useState<number>(initialShipment?.draftStep || 1)
  const [maxStepAllowed, setMaxStepAllowed] = useState<number>(initialShipment?.draftStep || 1)
  const [loading, setLoading] = useState(false)

  // Dữ liệu bước 1
  const [step1Data, setStep1Data] = useState({
    jobNo: initialShipment?.jobNo || suggestedJobNo,
    departmentId: initialShipment?.departmentId || allowedDepartments[0]?.id || '',
    mode: initialShipment?.mode || 'sea',
    origin: initialShipment?.origin || '',
    destination: initialShipment?.destination || '',
  })

  // Dữ liệu bước 2
  const [step2Data, setStep2Data] = useState<Step2Data>({
    customerId: initialShipment?.customerId || '',
    goods: initialShipment?.goods && initialShipment.goods.length > 0
      ? initialShipment.goods.map((g: any) => ({
          id: g.id,
          description: g.description,
          hsCode: g.hsCode,
        }))
      : [{ description: '', hsCode: '' }],
    blNo: initialShipment?.blNo || '',
    etd: initialShipment?.etd || '',
    eta: initialShipment?.eta || '',
    carrier: initialShipment?.extra?.carrier || '',
    vessel: initialShipment?.extra?.vessel || '',
    voyage: initialShipment?.extra?.voyage || '',
    containerNo: initialShipment?.extra?.containerNo || '',
    incoterms: initialShipment?.extra?.incoterms || '',
    notes: initialShipment?.extra?.notes || '',
  })

  // Dữ liệu checklist & tài liệu của bước 3
  const [requirements, setRequirements] = useState<any[]>(initialShipment?.requirements || [])
  const [uploadedDocs, setUploadedDocs] = useState<any[]>(initialShipment?.documents || [])

  // Nạp lại thông tin lô hàng từ server khi có shipmentId
  const refreshShipmentData = async (id: string) => {
    try {
      const res = await fetch(`/api/shipments/wizard?id=${encodeURIComponent(id)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.shipment) {
          const s = data.shipment
          setStep1Data({
            jobNo: s.jobNo,
            departmentId: s.departmentId || '',
            mode: s.mode,
            origin: s.origin || '',
            destination: s.destination || '',
          })
          setStep2Data({
            customerId: s.customerId || '',
            goods: s.goods && s.goods.length > 0 ? s.goods : [{ description: '', hsCode: '' }],
            blNo: s.blNo || '',
            etd: s.etd || '',
            eta: s.eta || '',
            carrier: s.extra?.carrier || '',
            vessel: s.extra?.vessel || '',
            voyage: s.extra?.voyage || '',
            containerNo: s.extra?.containerNo || '',
            incoterms: s.extra?.incoterms || '',
            notes: s.extra?.notes || '',
          })
          setRequirements(s.requirements || [])
          setUploadedDocs(s.documents || [])
          setMaxStepAllowed(Math.max(s.draftStep || 1, maxStepAllowed))
        }
      }
    } catch (e) {
      console.error('Lỗi nạp lại thông tin lô hàng:', e)
    }
  }

  // Tự động khôi phục từ localStorage nếu chưa có shipmentId
  useEffect(() => {
    if (!shipmentId) {
      const savedDraftId = localStorage.getItem('tml_shipment_wizard_draft_id')
      if (savedDraftId) {
        setShipmentId(savedDraftId)
        router.replace(`/shipments/new?id=${savedDraftId}`)
        refreshShipmentData(savedDraftId)
      }
    } else {
      localStorage.setItem('tml_shipment_wizard_draft_id', shipmentId)
    }
  }, [shipmentId])

  // XỬ LÝ LƯU BƯỚC 1 (Next hoặc Lưu nháp)
  const handleStep1Submit = async (data: typeof step1Data, isDraft = false) => {
    setLoading(true)
    try {
      const res = await fetch('/api/shipments/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-protection': '1' },
        body: JSON.stringify({
          step: 1,
          isDraftSave: isDraft,
          shipmentId,
          ...data,
        }),
      })

      const resData = await res.json()

      if (!res.ok) {
        toast.error('Lỗi lưu bước 1', { description: resData.error || 'Vui lòng kiểm tra lại thông tin.' })
        setLoading(false)
        return
      }

      setStep1Data(data)
      const newId = resData.shipmentId || shipmentId
      setShipmentId(newId)
      localStorage.setItem('tml_shipment_wizard_draft_id', newId)
      window.history.replaceState(null, '', `/shipments/new?id=${newId}`)

      if (isDraft) {
        toast.success('Đã lưu bản nháp bước 1', { description: `Mã Job: ${data.jobNo}` })
      } else {
        setMaxStepAllowed((prev) => Math.max(prev, 2))
        setCurrentStep(2)
        toast.success('Hoàn thành bước 1. Chuyển sang bước 2.')
      }
    } catch {
      toast.error('Không thể kết nối đến máy chủ.')
    } finally {
      setLoading(false)
    }
  }

  // XỬ LÝ LƯU BƯỚC 2 (Next hoặc Lưu nháp)
  const handleStep2Submit = async (data: Step2Data, isDraft = false) => {
    if (!shipmentId) {
      toast.error('Chưa có thông tin lô hàng bước 1.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/shipments/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-protection': '1' },
        body: JSON.stringify({
          step: 2,
          isDraftSave: isDraft,
          shipmentId,
          ...data,
        }),
      })

      const resData = await res.json()

      if (!res.ok) {
        toast.error('Lỗi lưu bước 2', { description: resData.error || 'Vui lòng kiểm tra lại thông tin hàng hóa & MST.' })
        setLoading(false)
        return
      }

      setStep2Data(data)
      await refreshShipmentData(shipmentId)

      if (isDraft) {
        toast.success('Đã lưu bản nháp thông tin hàng hóa.')
      } else {
        setMaxStepAllowed(3)
        setCurrentStep(3)
        toast.success('Hoàn tất bước 2. Đã mở bước 3 (Đính kèm chứng từ).')
      }
    } catch {
      toast.error('Không thể kết nối đến máy chủ.')
    } finally {
      setLoading(false)
    }
  }

  // HOÀN TẤT SAU (Lưu lô, chuyển booking, chuyển trang chi tiết)
  const handleFinalizeLater = async () => {
    if (!shipmentId) return
    setLoading(true)
    try {
      const res = await fetch('/api/shipments/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-protection': '1' },
        body: JSON.stringify({
          step: 3,
          finalizeLater: true,
          shipmentId,
        }),
      })

      const resData = await res.json()

      if (!res.ok) {
        toast.error('Lỗi hoàn tất sau', { description: resData.error })
        setLoading(false)
        return
      }

      localStorage.removeItem('tml_shipment_wizard_draft_id')
      toast.success('Đã lưu lô hàng thành công. Chuyển đến trang chi tiết.')
      router.push(`/shipments/${shipmentId}`)
    } catch {
      toast.error('Không thể kết nối đến máy chủ.')
      setLoading(false)
    }
  }

  // HOÀN TẤT TOÀN BỘ LÔ HÀNG
  const handleComplete = async () => {
    if (!shipmentId) return
    setLoading(true)
    try {
      const res = await fetch('/api/shipments/wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-protection': '1' },
        body: JSON.stringify({
          step: 3,
          complete: true,
          shipmentId,
        }),
      })

      const resData = await res.json()

      if (!res.ok) {
        toast.error('Lỗi hoàn tất lô hàng', { description: resData.error })
        setLoading(false)
        return
      }

      localStorage.removeItem('tml_shipment_wizard_draft_id')
      toast.success('Khởi tạo lô hàng thành công!', { description: `Mã Job: ${step1Data.jobNo}` })
      router.push(`/shipments/${shipmentId}`)
    } catch {
      toast.error('Không thể kết nối đến máy chủ.')
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header điều hướng */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link href="/shipments" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeftIcon className="size-4" />
              Danh sách lô hàng
            </Link>
            <span>/</span>
            <span className="text-foreground font-medium">Tạo lô hàng mới</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileStackIcon className="size-6 text-primary" />
            Khởi tạo Lô hàng Mới (Wizard)
          </h1>
        </div>

        {shipmentId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Mã nháp:</span>
            <code className="rounded bg-muted px-2 py-1 font-mono text-foreground font-medium border">
              {step1Data.jobNo}
            </code>
          </div>
        )}
      </div>

      {/* Stepper hiển thị tiến trình 3 bước */}
      <WizardStepper
        currentStep={currentStep}
        maxStepAllowed={maxStepAllowed}
        onStepClick={(step) => {
          if (step <= maxStepAllowed) {
            setCurrentStep(step)
          }
        }}
      />

      {/* Nội dung từng bước */}
      {currentStep === 1 && (
        <WizardStep1Basic
          initialData={step1Data}
          allowedDepartments={allowedDepartments}
          loading={loading}
          onNext={(data) => handleStep1Submit(data, false)}
          onSaveDraft={(data) => handleStep1Submit(data, true)}
        />
      )}

      {currentStep === 2 && (
        <WizardStep2Goods
          initialData={step2Data}
          customers={customers}
          loading={loading}
          onBack={() => setCurrentStep(1)}
          onNext={(data) => handleStep2Submit(data, false)}
          onSaveDraft={(data) => handleStep2Submit(data, true)}
        />
      )}

      {currentStep === 3 && (
        <WizardStep3Documents
          shipmentId={shipmentId || ''}
          jobNo={step1Data.jobNo}
          requirements={requirements}
          uploadedDocs={uploadedDocs}
          loading={loading}
          onBack={() => setCurrentStep(2)}
          onFinalizeLater={handleFinalizeLater}
          onComplete={handleComplete}
          onDocUploaded={() => shipmentId && refreshShipmentData(shipmentId)}
        />
      )}
    </div>
  )
}

