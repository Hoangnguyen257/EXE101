import type { AuditAction, DocType, PermissionAction, Role, ShipmentStatus } from './types'

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  BL: 'Vận đơn (B/L)',
  INVOICE: 'Hóa đơn (Invoice)',
  PACKING_LIST: 'Phiếu đóng gói (Packing List)',
  BOOKING: 'Xác nhận đặt chỗ (Booking)',
  DELIVERY_ORDER: 'Lệnh giao hàng điện tử (eDO)',
  ARRIVAL_NOTICE: 'Thông báo hàng đến (Arrival Notice)',
  CUSTOMS: 'Tờ khai hải quan (TKHQ)',
  CO: 'Chứng nhận xuất xứ (C/O)',
  OTHER: 'Khác',
}

export const DOC_TYPE_SHORT: Record<DocType, string> = {
  BL: 'B/L',
  INVOICE: 'Invoice',
  PACKING_LIST: 'Packing List',
  BOOKING: 'Booking',
  DELIVERY_ORDER: 'eDO',
  ARRIVAL_NOTICE: 'Arrival Notice',
  CUSTOMS: 'TKHQ',
  CO: 'C/O',
  OTHER: 'Khác',
}

export const SHIPMENT_STATUS_LABEL: Record<ShipmentStatus, string> = {
  draft: 'Đang soạn dở',
  booking: 'Đặt chỗ',
  in_transit: 'Đang vận chuyển',
  arrived: 'Cập cảng',
  on_yard: 'Trên bãi',
  customs: 'Thông quan',
  delivered: 'Đã giao',
  closed: 'Đã đóng hồ sơ',
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Chủ sở hữu',
  manager: 'Quản lý',
  team_lead: 'Trưởng nhóm',
  staff: 'Nhân viên',
  viewer: 'Người xem',
}

export const ACTION_LABEL: Record<PermissionAction, string> = {
  view: 'Xem',
  edit: 'Sửa',
  download: 'Tải xuống',
  delete: 'Xóa',
}

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  view: 'Xem',
  download: 'Tải xuống',
  edit: 'Sửa',
  update: 'Sửa',
  delete: 'Xóa',
  upload: 'Tải lên',
  share: 'Chia sẻ',
  restore: 'Khôi phục',
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  approve: 'Phê duyệt',
  create: 'Tạo',
  permission_change: 'Đổi phân quyền',
  share_expired_auto_revoked: 'Thu hồi link quá hạn',
}

/**
 * Định dạng ngày giờ chuẩn Việt Nam (Asia/Ho_Chi_Minh):
 * Hiển thị rõ ràng: 02/11/2026 · 3:45 CH (Chiều)
 */
export function formatAuditTimestamp(iso?: string | null): string {
  if (!iso || !iso.trim()) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'

  const datePart = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)

  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: 'numeric',
      hour12: false,
    }).format(d)
  )

  const minute = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    minute: '2-digit',
  })
    .format(d)
    .padStart(2, '0')

  const period = hour < 12 ? 'Sáng' : hour < 18 ? 'Chiều' : 'Tối'
  const hour12 = hour % 12 === 0 ? 12 : hour % 12
  const ampm = hour < 12 ? 'SA' : 'CH'

  return `${datePart} · ${hour12}:${minute} ${ampm} (${period})`
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDate = (iso?: string | null) => {
  if (!iso || !iso.trim()) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return dateFmt.format(d)
}

export const formatDateTime = (iso?: string | null) => {
  if (!iso || !iso.trim()) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return dateTimeFmt.format(d)
}

export const NOW = new Date('2026-10-19T09:30:00+07:00')

export function formatRelative(iso?: string | null, now: Date = new Date()) {
  if (!iso || !iso.trim()) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  const diff = (now.getTime() - d.getTime()) / 1000
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày trước`
  return formatDate(iso)
}

export function daysUntil(iso?: string | null, now: Date = new Date()) {
  if (!iso || !iso.trim()) return 0
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 0
  return Math.ceil((d.getTime() - now.getTime()) / 86400000)
}

export function formatSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}
