// Domain types mirror the Supabase schema in scripts/001_schema.sql.
// Every tenant-owned row carries `orgId` so Row-Level Security can scope by organization.

export type DocType =
  | 'BL'
  | 'INVOICE'
  | 'PACKING_LIST'
  | 'BOOKING'
  | 'DELIVERY_ORDER'
  | 'ARRIVAL_NOTICE'
  | 'CUSTOMS'
  | 'CO'
  | 'OTHER'

export const REQUIRED_DOC_TYPES: DocType[] = [
  'BL',
  'INVOICE',
  'PACKING_LIST',
  'BOOKING',
  'DELIVERY_ORDER',
  'ARRIVAL_NOTICE',
  'CUSTOMS',
  'CO',
]

/**
 * Danh sách chứng từ theo chiều hàng:
 * - Hàng Xuất (VN -> xuất): B/L, Booking, Packing list, C/O, TKHQ, Invoice
 * - Hàng Nhập (Nhập -> VN): Arrival Notice, D/O (eDO), Packing List, C/O, TKHQ, Invoice, B/L
 */
export function getRequiredDocTypes(shipment: { origin: string; destination?: string }): DocType[] {
  const isExport = shipment.origin.toUpperCase().includes('VN')
  if (isExport) {
    return ['BL', 'BOOKING', 'PACKING_LIST', 'CO', 'CUSTOMS', 'INVOICE']
  }
  return ['ARRIVAL_NOTICE', 'DELIVERY_ORDER', 'PACKING_LIST', 'CO', 'CUSTOMS', 'INVOICE', 'BL']
}

/**
 * Trạng thái theo chiều hàng:
 * - Hàng Xuất (VN -> xuất): Đặt chỗ, Thông quan, Đã giao
 * - Hàng Nhập (Nhập -> VN): Cập cảng, Trên bãi, Thông quan, Đã giao
 */
export type ShipmentStatus = 'booking' | 'in_transit' | 'arrived' | 'on_yard' | 'customs' | 'delivered' | 'closed'

export function getValidShipmentStatuses(shipment: { origin: string; destination?: string }): ShipmentStatus[] {
  const isExport = shipment.origin.toUpperCase().includes('VN')
  if (isExport) {
    return ['booking', 'customs', 'delivered', 'closed']
  }
  return ['arrived', 'on_yard', 'customs', 'delivered', 'closed']
}

export type Role = 'owner' | 'manager' | 'team_lead' | 'staff' | 'viewer'

export type PermissionAction = 'view' | 'edit' | 'download' | 'delete'

export type AuditAction = 'view' | 'download' | 'edit' | 'delete' | 'upload' | 'share' | 'restore'

export interface Organization {
  id: string
  name: string
  taxCode: string
  address: string
  plan: string
}

export interface Branch {
  id: string
  orgId: string
  name: string
  city: string
  address: string
  userCount: number
}

export interface Department {
  id: string
  orgId: string
  name: string
  head: string
  userCount: number
}

export interface User {
  id: string
  orgId: string
  name: string
  email: string
  role: Role
  departmentId: string
  branchId: string
  initials: string
  active: boolean
  lastActive: string
}

export interface Customer {
  id: string
  orgId: string
  name: string
  shortName: string
  taxCode: string
}

export interface Shipment {
  id: string
  orgId: string
  jobNo: string
  blNo: string
  customerId: string
  mode: 'sea' | 'air' | 'road'
  origin: string
  destination: string
  etd: string
  eta: string
  status: ShipmentStatus
  createdAt: string
  ownerId: string
}

export interface DocumentVersion {
  id: string
  version: number
  fileName: string
  sizeKb: number
  uploadedBy: string
  uploadedAt: string
  note: string
}

export interface DocumentLock {
  userId: string
  since: string
}

export interface DocumentFile {
  id: string
  orgId: string
  shipmentId: string
  customerId: string
  type: DocType
  title: string
  fileName: string
  sizeKb: number
  pages: number
  docDate: string
  uploadedBy: string
  uploadedAt: string
  ocrText: string
  versions: DocumentVersion[]
  lock?: DocumentLock
  retentionUntil: string
  archiveBoxId?: string
}

export interface Activity {
  id: string
  userId: string
  action: AuditAction
  documentId?: string
  shipmentId?: string
  description: string
  at: string
}

export type AlertKind = 'missing' | 'retention'
export type AlertSeverity = 'high' | 'medium' | 'low'

export interface AlertItem {
  id: string
  kind: AlertKind
  severity: AlertSeverity
  title: string
  description: string
  shipmentId?: string
  documentId?: string
  docType?: DocType
  dueDate: string
}

export interface ArchiveBox {
  id: string
  orgId: string
  code: string
  warehouse: string
  shelf: string
  box: string
  customerId?: string
  period: string
  documentIds: string[]
  createdAt: string
  createdBy: string
}

export interface AuditLog {
  id: string
  userId: string
  action: AuditAction
  documentId: string
  ip: string
  device: string
  at: string
}

export interface ShareLink {
  id: string
  documentId: string
  token: string
  expiresAt: string
  hasPassword: boolean
  createdBy: string
  createdAt: string
  views: number
}

export type PermissionMatrix = Record<
  string, // departmentId
  Record<string, Record<Role, Record<PermissionAction, boolean>>> // resource -> role -> action
>
