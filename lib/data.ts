// Data-access layer. Every function is async and returns plain objects so the
// mock implementation can be swapped for Supabase queries (scoped by RLS) without
// touching the UI. See scripts/001_schema.sql for the matching tables.
import * as db from './mock-data'
import { daysUntil, NOW } from './labels'
import { getRequiredDocTypes, type AlertItem, type DocType, type DocumentFile, type Shipment } from './types'
import { DOC_TYPE_LABEL } from './labels'

export interface ShipmentWithProgress extends Shipment {
  customerName: string
  presentTypes: DocType[]
  missingTypes: DocType[]
  requiredTypes: DocType[]
  progress: number
}

function withProgress(s: Shipment): ShipmentWithProgress {
  const required = getRequiredDocTypes(s)
  const docs = db.documents.filter((d) => d.shipmentId === s.id)
  const presentTypes = required.filter((t) => docs.some((d) => d.type === t))
  const missingTypes = required.filter((t) => !presentTypes.includes(t))
  return {
    ...s,
    customerName: db.customers.find((c) => c.id === s.customerId)?.shortName ?? '',
    presentTypes,
    missingTypes,
    requiredTypes: required,
    progress: Math.round((presentTypes.length / required.length) * 100),
  }
}

export async function getShipments(): Promise<ShipmentWithProgress[]> {
  return db.shipments.map(withProgress).sort((a, b) => b.etd.localeCompare(a.etd))
}

export async function getShipment(id: string) {
  const s = db.shipments.find((x) => x.id === id)
  if (!s) return null
  return {
    shipment: withProgress(s),
    customer: db.customers.find((c) => c.id === s.customerId)!,
    owner: db.users.find((u) => u.id === s.ownerId)!,
    documents: db.documents.filter((d) => d.shipmentId === id),
    activities: db.activities.filter((a) => a.shipmentId === id),
  }
}

export async function getDocuments(): Promise<DocumentFile[]> {
  return [...db.documents].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export async function getDocument(id: string) {
  const doc = db.documents.find((d) => d.id === id)
  if (!doc) return null
  return {
    document: doc,
    shipment: db.shipments.find((s) => s.id === doc.shipmentId)!,
    customer: db.customers.find((c) => c.id === doc.customerId)!,
    archiveBox: db.archiveBoxes.find((b) => b.id === doc.archiveBoxId) ?? null,
  }
}

export async function getCustomers() {
  return db.customers
}

export async function getUsers() {
  return db.users
}

export async function getCurrentUser() {
  return db.users.find((u) => u.id === db.CURRENT_USER_ID)!
}

export async function getAlerts(): Promise<AlertItem[]> {
  const alerts: AlertItem[] = []
  for (const s of db.shipments) {
    if (s.status === 'closed') continue
    const { missingTypes } = withProgress(s)
    const isExport = s.origin.toUpperCase().includes('VN')
    for (const t of missingTypes) {
      const targetDate = t === 'BOOKING' ? s.etd : isExport ? s.etd : s.eta
      const days = daysUntil(targetDate)
      const critical = t === 'DELIVERY_ORDER' || t === 'ARRIVAL_NOTICE' || t === 'BOOKING' ? days <= 3 : days <= 7
      alerts.push({
        id: `al_missing_${s.id}_${t}`,
        kind: 'missing',
        severity: critical ? 'high' : days <= 14 ? 'medium' : 'low',
        title: `Thiếu ${DOC_TYPE_LABEL[t]}`,
        description: `Lô ${s.jobNo} · ${db.customers.find((c) => c.id === s.customerId)?.shortName}`,
        shipmentId: s.id,
        docType: t,
        dueDate: targetDate,
      })
    }
  }
  for (const d of db.documents) {
    const days = daysUntil(d.retentionUntil)
    if (days > 90) continue
    const s = db.shipments.find((x) => x.id === d.shipmentId)!
    alerts.push({
      id: `al_ret_${d.id}`,
      kind: 'retention',
      severity: days <= 14 ? 'high' : days <= 45 ? 'medium' : 'low',
      title: `${d.title} sắp hết hạn lưu trữ`,
      description: `Lô ${s.jobNo} · lưu trữ 5 năm theo quy định`,
      shipmentId: s.id,
      documentId: d.id,
      dueDate: d.retentionUntil,
    })
  }
  const rank = { high: 0, medium: 1, low: 2 }
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.dueDate.localeCompare(b.dueDate))
}

export async function getDashboard() {
  const [shipments, alerts] = await Promise.all([getShipments(), getAlerts()])
  const active = shipments.filter((s) => s.status !== 'closed')
  return {
    kpis: {
      totalDocuments: db.documents.length + 12_438,
      newThisWeek: db.documents.filter((d) => (NOW.getTime() - new Date(d.uploadedAt).getTime()) / 86400000 <= 7).length,
      shipmentsMissing: active.filter((s) => s.missingTypes.length > 0).length,
      activeShipments: active.length,
      expiringSoon: alerts.filter((a) => a.kind === 'retention').length,
      searchesToday: db.searchesToday,
    },
    activities: db.activities,
    alerts: alerts.slice(0, 6),
    attention: active.filter((s) => s.missingTypes.length > 0).slice(0, 5),
  }
}

export async function getArchive() {
  return {
    boxes: db.archiveBoxes,
    documents: db.documents,
    shipments: db.shipments,
    customers: db.customers,
  }
}

export async function getAuditLogs() {
  return db.auditLogs
}

export async function getSettings() {
  return {
    organization: db.organization,
    branches: db.branches,
    departments: db.departments,
    users: db.users,
  }
}

export async function getPermissions() {
  return {
    departments: db.departments,
    matrix: db.permissionMatrix,
    resources: db.RESOURCES.map((r) => ({ ...r })),
  }
}

export async function getSearchIndex() {
  return {
    documents: db.documents.map(({ versions: _v, ...d }) => d),
    shipments: db.shipments,
    customers: db.customers,
  }
}

export type SearchIndex = Awaited<ReturnType<typeof getSearchIndex>>
export type ShipmentDetail = NonNullable<Awaited<ReturnType<typeof getShipment>>>
export type DocumentDetail = NonNullable<Awaited<ReturnType<typeof getDocument>>>
