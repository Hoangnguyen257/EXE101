'use client'

import Link from 'next/link'
import {
  ArrowLeftIcon,
  ShipIcon,
  PlaneIcon,
  TruckIcon,
  UploadIcon,
  CameraIcon,
  CheckCircle2Icon,
  AlertCircleIcon,
  ClockIcon,
  BuildingIcon,
  MapPinIcon,
  UserIcon,
  CalendarIcon,
  PackageIcon,
  FileTextIcon,
  Share2Icon,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { ShipmentStatusBadge } from '@/components/app/status-badges'
import { DocumentChecklist } from '@/components/shipments/document-checklist'
import { useApp } from '@/components/app/app-provider'
import { formatDate, formatRelative, AUDIT_ACTION_LABEL, SHIPMENT_STATUS_LABEL } from '@/lib/labels'
import type { ShipmentWithProgress } from '@/lib/data'
import type { Activity, Customer, DocumentFile, User } from '@/lib/types'

const MODE_CONFIG = {
  sea: { label: 'Đường biển (Sea)', icon: ShipIcon, color: 'text-blue-500' },
  air: { label: 'Đường hàng không (Air)', icon: PlaneIcon, color: 'text-sky-500' },
  road: { label: 'Đường bộ (Road)', icon: TruckIcon, color: 'text-amber-500' },
}

interface ShipmentDetailViewProps {
  shipment: ShipmentWithProgress
  customer: Customer
  owner: User
  documents: DocumentFile[]
  activities: Activity[]
  goods: string
  users: User[]
}

export function ShipmentDetailView({
  shipment,
  customer,
  owner,
  documents,
  activities,
  goods,
  users,
}: ShipmentDetailViewProps) {
  const { openUpload, openShare } = useApp()
  const ModeIcon = MODE_CONFIG[shipment.mode]?.icon ?? ShipIcon
  const modeLabel = MODE_CONFIG[shipment.mode]?.label ?? 'Vận tải'

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id

  return (
    <div className="flex flex-col gap-6">
      {/* Back button & Breadcrumb */}
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/shipments" />} className="-ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeftIcon className="mr-1.5 size-4" />
          Quay lại danh sách lô hàng
        </Button>
      </div>

      {/* Main Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {shipment.jobNo}
            </h1>
            <ShipmentStatusBadge status={shipment.status} />
            <Badge variant="outline" className="flex items-center gap-1.5 font-normal">
              <ModeIcon className="size-3.5 text-primary" />
              <span>{modeLabel}</span>
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            B/L: <span className="font-mono font-medium text-foreground">{shipment.blNo}</span> · Khách hàng: <span className="font-medium text-foreground">{customer.name}</span>
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() => openUpload({ shipmentId: shipment.id })}
          >
            <UploadIcon data-icon="inline-start" />
            Tải lên chứng từ
          </Button>
          <Button
            size="sm"
            variant="outline"
            render={<Link href="/scan" />}
          >
            <CameraIcon data-icon="inline-start" />
            Quét chứng từ
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (documents[0]) {
                openShare({
                  id: documents[0].id,
                  title: `Hồ sơ ${shipment.jobNo}`,
                  fileName: documents[0].fileName,
                })
              }
            }}
          >
            <Share2Icon data-icon="inline-start" />
            Chia sẻ hồ sơ
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {/* Progress */}
        <Card className="gap-2 p-4">
          <span className="text-xs text-muted-foreground">Tiến độ hồ sơ</span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold">{shipment.progress}%</span>
            <span className="text-xs text-muted-foreground">{shipment.presentTypes.length}/{shipment.requiredTypes.length} đủ</span>
          </div>
          <Progress value={shipment.progress} className="h-1.5" />
        </Card>

        {/* Total required */}
        <Card className="gap-2 p-4">
          <span className="text-xs text-muted-foreground">Yêu cầu bắt buộc</span>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{shipment.requiredTypes.length}</span>
            <span className="text-xs text-muted-foreground">loại chứng từ</span>
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {shipment.origin.toUpperCase().includes('VN') ? 'Theo chuẩn Hàng Xuất' : 'Theo chuẩn Hàng Nhập'}
          </span>
        </Card>

        {/* Present docs */}
        <Card className="gap-2 p-4">
          <span className="text-xs text-muted-foreground">Tập tin đã có</span>
          <div className="flex items-center gap-2">
            <CheckCircle2Icon className="size-5 text-emerald-500" />
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {shipment.presentTypes.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground truncate">Đã sẵn sàng trên hệ thống</span>
        </Card>

        {/* Missing docs */}
        <Card className="gap-2 p-4">
          <span className="text-xs text-muted-foreground">Tập tin còn thiếu</span>
          <div className="flex items-center gap-2">
            <AlertCircleIcon className="size-5 text-destructive" />
            <span className="text-2xl font-bold text-destructive">
              {shipment.missingTypes.length}
            </span>
          </div>
          <span className="text-xs text-muted-foreground truncate">
            {shipment.missingTypes.length === 0 ? 'Đã đủ bộ chứng từ' : 'Cần bổ sung hoàn thiện'}
          </span>
        </Card>
      </div>

      {/* Shipment Details Overview (Lô hàng này cụ thể là gì) */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin chi tiết lô hàng</CardTitle>
          <CardDescription>Chi tiết vận hành, lộ trình cảng đi/đến và thông tin khách hàng</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          {/* Column 1: Operation & Route */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Thông tin vận chuyển
            </h3>

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mã Job / Hồ sơ:</span>
                <span className="font-mono font-medium">{shipment.jobNo}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Số Vận đơn (B/L):</span>
                <span className="font-mono font-medium">{shipment.blNo}</span>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Hàng hóa & Mã HS:</span>
                <span className="text-right font-medium">{goods}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <MapPinIcon className="size-4 text-primary" />
                  Tuyến đường:
                </span>
                <span className="font-medium text-right">
                  {shipment.origin} → {shipment.destination}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="size-4 text-muted-foreground" />
                  Lịch trình (ETD / ETA):
                </span>
                <span className="font-medium text-right">
                  {formatDate(shipment.etd)} → {formatDate(shipment.eta)}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Customer & Handler */}
          <div className="flex flex-col gap-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Khách hàng & Người phụ trách
            </h3>

            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3.5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground shrink-0 flex items-center gap-1.5">
                  <BuildingIcon className="size-4 text-muted-foreground" />
                  Doanh nghiệp:
                </span>
                <span className="text-right font-medium">{customer.name}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tên viết tắt:</span>
                <span className="font-medium">{customer.shortName}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mã số thuế:</span>
                <span className="font-mono font-medium">{customer.taxCode}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <UserIcon className="size-4 text-muted-foreground" />
                  Người phụ trách:
                </span>
                <div className="text-right">
                  <div className="font-medium">{owner.name}</div>
                  <div className="text-xs text-muted-foreground">{owner.email}</div>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Trạng thái lô hàng:</span>
                <span className="font-medium">{SHIPMENT_STATUS_LABEL[shipment.status]}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Document Checklist: What files exist, what files are missing */}
      <DocumentChecklist
        shipment={shipment}
        documents={documents}
        users={users}
      />

      {/* Activities / History */}
      {activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Nhật ký hoạt động lô hàng</CardTitle>
            <CardDescription>Các thao tác kiểm tra, tải lên và chia sẻ liên quan đến lô hàng này</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {activities.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {userName(a.userId).slice(0, 1)}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium">
                        {userName(a.userId)} đã {AUDIT_ACTION_LABEL[a.action]?.toLowerCase() ?? a.action}
                      </span>
                      <span className="text-xs text-muted-foreground">{a.description}</span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatRelative(a.at)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
