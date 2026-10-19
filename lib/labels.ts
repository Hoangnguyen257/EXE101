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

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  view: 'Xem',
  download: 'Tải xuống',
  edit: 'Chỉnh sửa',
  delete: 'Xóa',
  upload: 'Tải lên',
  share: 'Chia sẻ',
  restore: 'Khôi phục',
}

const dateFmt = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatDate = (iso: string) => dateFmt.format(new Date(iso))
export const formatDateTime = (iso: string) => dateTimeFmt.format(new Date(iso))

export const NOW = new Date('2026-10-19T09:30:00+07:00')

export function formatRelative(iso: string, now: Date = NOW) {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} ngày trước`
  return formatDate(iso)
}

export function daysUntil(iso: string, now: Date = NOW) {
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000)
}

export function formatSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`
}
