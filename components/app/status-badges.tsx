import { CircleCheckIcon, CircleDashedIcon, CloudCheckIcon, LockIcon, RefreshCwIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { SHIPMENT_STATUS_LABEL, formatRelative } from '@/lib/labels'
import type { ShipmentStatus } from '@/lib/types'

const STATUS_VARIANT: Record<ShipmentStatus, 'info' | 'secondary' | 'warning' | 'success' | 'outline'> = {
  booking: 'secondary',
  in_transit: 'info',
  arrived: 'info',
  on_yard: 'secondary',
  customs: 'warning',
  delivered: 'success',
  closed: 'outline',
}

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{SHIPMENT_STATUS_LABEL[status]}</Badge>
}

export function DocPresenceBadge({ present }: { present: boolean }) {
  return present ? (
    <Badge variant="success">
      <CircleCheckIcon data-icon="inline-start" />
      Đã có
    </Badge>
  ) : (
    <Badge variant="destructive">
      <CircleDashedIcon data-icon="inline-start" />
      Còn thiếu
    </Badge>
  )
}

export function LockBadge({ userName, since }: { userName: string; since: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<Badge variant="warning" />}>
        <LockIcon data-icon="inline-start" />
        {userName} đang sửa
      </TooltipTrigger>
      <TooltipContent>Bắt đầu chỉnh sửa {formatRelative(since)}. Bạn chỉ có thể xem cho đến khi file được mở khóa.</TooltipContent>
    </Tooltip>
  )
}

export function SyncBadge({ state }: { state: 'synced' | 'syncing' }) {
  return state === 'synced' ? (
    <Badge variant="success" aria-live="polite">
      <CloudCheckIcon data-icon="inline-start" />
      Đã đồng bộ
    </Badge>
  ) : (
    <Badge variant="info" aria-live="polite">
      <RefreshCwIcon data-icon="inline-start" className="animate-spin" />
      Đang đồng bộ
    </Badge>
  )
}
