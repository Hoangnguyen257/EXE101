'use client'

import { useState } from 'react'
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
  UserPlusIcon,
  Trash2Icon,
  CalendarIcon,
  PackageIcon,
  FileTextIcon,
  Share2Icon,
  UsersIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
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

export interface ShipmentParticipantItem {
  id: string
  userId: string
  roleInShipment: string
  assignedAt: string
  user?: {
    id: string
    name: string
    email: string
    initials: string
    roleCode: string
  }
}

interface ShipmentDetailViewProps {
  shipment: ShipmentWithProgress
  customer: Customer
  owner: User
  documents: DocumentFile[]
  activities: Activity[]
  goods: string
  goodsList?: { id: string; description: string; hsCode: string; orderIndex: number }[]
  users: User[]
  initialParticipants?: ShipmentParticipantItem[]
}

export function ShipmentDetailView({
  shipment,
  customer,
  owner,
  documents,
  activities,
  goods,
  goodsList,
  users,
  initialParticipants,
}: ShipmentDetailViewProps) {
  const { openUpload, openShare } = useApp()
  const ModeIcon = MODE_CONFIG[shipment.mode]?.icon ?? ShipIcon
  const modeLabel = MODE_CONFIG[shipment.mode]?.label ?? 'Vận tải'

  const [participants, setParticipants] = useState<ShipmentParticipantItem[]>(initialParticipants || [])
  const [isAssignOpen, setIsAssignOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState('')
  const [selectedRole, setSelectedRole] = useState('DOC_SPECIALIST')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAddParticipant = async () => {
    if (!selectedUserId) {
      toast.error('Vui lòng chọn nhân viên cần phân công.')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/shipments/${shipment.id}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId, roleInShipment: selectedRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Không thành công', { description: data.error })
        return
      }
      toast.success('Phân công thành công', { description: data.message })
      setParticipants((prev) => {
        const filtered = prev.filter((p) => p.userId !== selectedUserId)
        return [...filtered, data.participant]
      })
      setIsAssignOpen(false)
      setSelectedUserId('')
    } catch {
      toast.error('Lỗi kết nối khi phân công nhân sự.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveParticipant = async (userId: string) => {
    try {
      const res = await fetch(`/api/shipments/${shipment.id}/participants?userId=${userId}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error('Không thể gỡ bỏ', { description: data.error })
        return
      }
      toast.success('Đã gỡ bỏ phân công nhân sự.')
      setParticipants((prev) => prev.filter((p) => p.userId !== userId))
    } catch {
      toast.error('Lỗi kết nối khi gỡ bỏ phân công.')
    }
  }

  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id

  return (
    <div className="flex flex-col gap-6">
      {/* Back button & Breadcrumb */}
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/shipments" />} nativeButton={false} className="-ml-2 text-muted-foreground hover:text-foreground">
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
            B/L: <span className="font-mono font-medium text-foreground">{shipment.blNo || 'Chưa cập nhật'}</span> · Khách hàng: <span className="font-medium text-foreground">{customer?.name || 'Chưa xác định'}</span>
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
            nativeButton={false}
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
                <span className="font-mono font-medium">{shipment.blNo || 'Chưa cập nhật'}</span>
              </div>
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground shrink-0">Hàng hóa & Mã HS:</span>
                <span className="text-right font-medium">{goods || 'Hàng hóa thông thường'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <MapPinIcon className="size-4 text-primary" />
                  Tuyến đường:
                </span>
                <span className="font-medium text-right">
                  {shipment.origin || 'Chưa xác định'} → {shipment.destination || 'Chưa xác định'}
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
                <span className="text-right font-medium">{customer?.name || 'Chưa xác định'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tên viết tắt:</span>
                <span className="font-medium">{customer?.shortName || 'Chưa xác định'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mã số thuế:</span>
                <span className="font-mono font-medium">{customer?.taxCode || 'Chưa cập nhật'}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <UserIcon className="size-4 text-muted-foreground" />
                  Người phụ trách:
                </span>
                <div className="text-right">
                  <div className="font-medium">{owner?.name || 'Chưa phân công'}</div>
                  <div className="text-xs text-muted-foreground">{owner?.email || '—'}</div>
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

      {/* Shipment Goods & HS Code Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageIcon className="size-4 text-primary" />
            Bảng kê Hàng hóa & Mã HS Code
          </CardTitle>
          <CardDescription>
            Danh mục chi tiết các mặt hàng vận chuyển và mã phân loại HS Code tương ứng
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goodsList && goodsList.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="py-2.5 px-3 font-medium w-12 text-center">STT</th>
                    <th className="py-2.5 px-3 font-medium">Mô tả mặt hàng</th>
                    <th className="py-2.5 px-3 font-medium w-48 text-right pr-4">Mã HS Code</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {goodsList.map((g, idx) => (
                    <tr key={g.id || idx} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-3 text-center text-xs text-muted-foreground font-mono">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        {g.description}
                      </td>
                      <td className="py-2.5 px-3 text-right pr-4">
                        <Badge variant="outline" className="font-mono bg-background text-xs">
                          {g.hsCode}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-3.5 text-sm">
              <span className="text-muted-foreground">Mô tả hàng hóa chung: </span>
              <span className="font-medium text-foreground">{goods || 'Hàng hóa thông thường'}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Shipment Participants Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex flex-col gap-1">
            <CardTitle className="text-base flex items-center gap-2">
              <UsersIcon className="size-4 text-primary" />
              Nhân sự phân công tham gia lô hàng
            </CardTitle>
            <CardDescription>
              Các nhân viên từ các phòng ban nghiệp vụ (Chứng từ, Khai thác, Hải quan) được phân công phụ trách lô hàng này
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={() => setIsAssignOpen(true)}>
            <UserPlusIcon className="mr-1.5 size-4" />
            Phân công nhân sự
          </Button>
        </CardHeader>
        <CardContent>
          {participants.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-2">
              Chưa có nhân sự phụ thêm nào được phân công. Người phụ trách chính: <span className="font-medium text-foreground">{owner.name}</span>.
            </p>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {participants.map((p) => {
                const assignedUser = p.user || users.find((u) => u.id === p.userId)
                return (
                  <div
                    key={p.id || p.userId}
                    className="flex items-center justify-between rounded-lg border bg-muted/20 p-3 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {assignedUser?.initials || assignedUser?.name?.slice(0, 2) || 'NV'}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{assignedUser?.name || p.userId}</span>
                        <span className="text-xs text-muted-foreground">{p.roleInShipment}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveParticipant(p.userId)}
                      title="Gỡ bỏ phân công"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog phân công nhân sự */}
      <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Phân công nhân viên vào lô hàng</DialogTitle>
            <DialogDescription>
              Nhân viên được phân công sẽ có toàn quyền xem và xử lý chứng từ trong lô hàng {shipment.jobNo}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="assignUser">Chọn nhân viên</Label>
              <Select value={selectedUserId} onValueChange={(val) => setSelectedUserId(val ?? '')}>
                <SelectTrigger id="assignUser" className="w-full">
                  <SelectValue placeholder="-- Chọn nhân viên trong tổ chức --" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.id !== owner.id && !participants.some((p) => p.userId === u.id))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignRole">Vai trò nhiệm vụ trong lô hàng</Label>
              <Select value={selectedRole} onValueChange={(val) => setSelectedRole(val ?? 'DOC_SPECIALIST')}>
                <SelectTrigger id="assignRole" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DOC_SPECIALIST">Chuyên viên Chứng từ (DOC Specialist)</SelectItem>
                  <SelectItem value="CUSTOMS_STAFF">Nhân viên Hải quan (Customs Staff)</SelectItem>
                  <SelectItem value="OPS_STAFF">Nhân viên Giao nhận / Khai thác (Ops Staff)</SelectItem>
                  <SelectItem value="STAFF">Nhân viên phụ trách chung (Staff)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsAssignOpen(false)} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button onClick={handleAddParticipant} disabled={isSubmitting || !selectedUserId}>
              {isSubmitting ? 'Đang lưu...' : 'Xác nhận phân công'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
