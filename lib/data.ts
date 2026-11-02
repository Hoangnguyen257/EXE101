import { prisma } from './prisma'
import { daysUntil } from './labels'
import { DOC_TYPE_LABEL } from './labels'
import { getRequiredDocTypes, type AlertItem, type DocType, type DocumentFile, type Shipment } from './types'
import { getSessionUser } from './auth/auth-service'
import { PermissionService } from './auth/permission-service'

export interface ShipmentWithProgress extends Shipment {
  customerName: string
  presentTypes: DocType[]
  missingTypes: DocType[]
  requiredTypes: DocType[]
  progress: number
}

function calculateProgress(s: Shipment, docTypes: DocType[]): ShipmentWithProgress {
  const required = getRequiredDocTypes(s)
  const presentTypes = required.filter((t) => docTypes.includes(t))
  const missingTypes = required.filter((t) => !presentTypes.includes(t))
  return {
    ...s,
    customerName: '',
    presentTypes,
    missingTypes,
    requiredTypes: required,
    progress: required.length ? Math.round((presentTypes.length / required.length) * 100) : 0,
  }
}

export async function getShipments(tokenOverride?: string): Promise<ShipmentWithProgress[]> {
  const sessionUser = await getSessionUser(tokenOverride)
  const whereClause = await PermissionService.buildShipmentWhereInput(sessionUser, 'VIEW')

  const rawShipments = await prisma.shipment.findMany({
    where: whereClause,
    include: {
      customer: true,
      documents: {
        where: { isDeleted: false },
        select: { type: true },
      },
    },
    orderBy: { etd: 'desc' },
  })

  return rawShipments.map((s) => {
    const docTypes = s.documents.map((d) => d.type as DocType)
    const prog = calculateProgress(
      {
        id: s.id,
        orgId: s.orgId,
        jobNo: s.jobNo,
        blNo: s.blNo,
        customerId: s.customerId,
        departmentId: s.departmentId,
        mode: s.mode as 'sea' | 'air' | 'road',
        origin: s.origin,
        destination: s.destination,
        etd: s.etd,
        eta: s.eta,
        status: s.status as any,
        createdAt: s.createdAt.toISOString(),
        ownerId: s.ownerId,
      },
      docTypes
    )
    return {
      ...prog,
      customerName: s.customer.shortName,
    }
  })
}

export async function getGoodsDescription(customerId: string): Promise<string> {
  const shipment = await prisma.shipment.findFirst({
    where: { customerId, goodsDesc: { not: null } },
    select: { goodsDesc: true },
  })
  return shipment?.goodsDesc ?? 'Hàng hóa xuất nhập khẩu thông thường'
}

export async function getShipment(id: string) {
  const s = await prisma.shipment.findUnique({
    where: { id },
    include: {
      customer: true,
      owner: true,
      participants: {
        include: {
          user: {
            select: { id: true, name: true, email: true, initials: true, roleCode: true },
          },
        },
      },
      documents: {
        where: { isDeleted: false },
        include: { versions: true },
      },
    },
  })

  if (!s) return null

  const docTypes = s.documents.map((d) => d.type as DocType)
  const progressData = calculateProgress(
    {
      id: s.id,
      orgId: s.orgId,
      jobNo: s.jobNo,
      blNo: s.blNo,
      customerId: s.customerId,
      departmentId: s.departmentId,
      mode: s.mode as 'sea' | 'air' | 'road',
      origin: s.origin,
      destination: s.destination,
      etd: s.etd,
      eta: s.eta,
      status: s.status as any,
      createdAt: s.createdAt.toISOString(),
      ownerId: s.ownerId,
    },
    docTypes
  )

  const rawActivities = await prisma.auditLog.findMany({
    where: { resourceId: id },
    take: 10,
    orderBy: { createdAt: 'desc' },
  })

  return {
    shipment: {
      ...progressData,
      customerName: s.customer.shortName,
    },
    customer: {
      id: s.customer.id,
      orgId: s.customer.orgId,
      name: s.customer.name,
      shortName: s.customer.shortName,
      taxCode: s.customer.taxCode,
    },
    owner: {
      id: s.owner.id,
      orgId: s.owner.orgId,
      name: s.owner.name,
      email: s.owner.email,
      role: s.owner.roleCode.toLowerCase() as any,
      departmentId: s.departmentId ?? 'd1',
      branchId: 'b1',
      initials: s.owner.initials,
      active: s.owner.isActive,
      lastActive: s.owner.lastActiveAt?.toISOString() ?? s.owner.createdAt.toISOString(),
    },
    documents: s.documents.map((d) => ({
      id: d.id,
      orgId: d.orgId,
      shipmentId: d.shipmentId,
      customerId: d.customerId,
      type: d.type as DocType,
      customTypeName: d.customTypeName ?? undefined,
      title: d.title,
      fileName: d.fileName,
      sizeKb: Math.round(d.fileSizeBytes / 1024),
      pages: d.pages,
      docDate: d.docDate,
      uploadedBy: d.createdBy,
      uploadedAt: d.createdAt.toISOString(),
      ocrText: '',
      versions: d.versions.map((v) => ({
        id: v.id,
        version: v.versionNumber,
        fileName: v.fileName,
        sizeKb: Math.round(v.sizeBytes / 1024),
        uploadedBy: v.uploadedBy,
        uploadedAt: v.uploadedAt.toISOString(),
        note: v.changeNote ?? '',
      })),
      retentionUntil: d.retentionUntil ?? '',
      archiveBoxId: d.archiveBoxId ?? undefined,
      lock: d.isLocked && d.lockedBy ? { userId: d.lockedBy, since: d.lockedAt?.toISOString() ?? '' } : undefined,
    })),
    activities: rawActivities.map((a) => ({
      id: a.id,
      userId: a.userId,
      action: a.action as any,
      shipmentId: id,
      description: `đã thực hiện ${a.action}`,
      at: a.createdAt.toISOString(),
    })),
    goods: s.goodsDesc ?? 'Hàng hóa thông thường',
    participants: s.participants.map((p) => ({
      id: p.id,
      userId: p.userId,
      roleInShipment: p.roleInShipment,
      assignedAt: p.assignedAt.toISOString(),
      user: p.user,
    })),
  }
}

export async function getDocuments(tokenOverride?: string): Promise<DocumentFile[]> {
  const sessionUser = await getSessionUser(tokenOverride)
  const permissionWhere = await PermissionService.buildDocumentWhereInput(sessionUser, 'VIEW')
  const whereClause = { AND: [{ isDeleted: false }, permissionWhere] }

  const docs = await prisma.document.findMany({
    where: whereClause,
    include: {
      versions: { orderBy: { versionNumber: 'desc' } },
      ocrResults: { take: 1, orderBy: { extractedAt: 'desc' } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return docs.map((d) => ({
    id: d.id,
    orgId: d.orgId,
    departmentId: d.departmentId,
    shipmentId: d.shipmentId,
    customerId: d.customerId,
    type: d.type as DocType,
    customTypeName: d.customTypeName ?? undefined,
    title: d.title,
    fileName: d.fileName,
    sizeKb: Math.round(d.fileSizeBytes / 1024),
    pages: d.pages,
    docDate: d.docDate,
    uploadedBy: d.createdBy,
    uploadedAt: d.createdAt.toISOString(),
    ocrText: d.ocrResults[0]?.rawText ?? '',
    versions: d.versions.map((v) => ({
      id: v.id,
      version: v.versionNumber,
      fileName: v.fileName,
      sizeKb: Math.round(v.sizeBytes / 1024),
      uploadedBy: v.uploadedBy,
      uploadedAt: v.uploadedAt.toISOString(),
      note: v.changeNote ?? '',
    })),
    retentionUntil: d.retentionUntil ?? '',
    archiveBoxId: d.archiveBoxId ?? undefined,
    lock: d.isLocked && d.lockedBy ? { userId: d.lockedBy, since: d.lockedAt?.toISOString() ?? '' } : undefined,
  }))
}

export async function getDocument(id: string) {
  const d = await prisma.document.findUnique({
    where: { id },
    include: {
      shipment: { include: { participants: true } },
      customer: true,
      archiveBox: true,
      versions: { orderBy: { versionNumber: 'desc' } },
      ocrResults: { take: 1, orderBy: { extractedAt: 'desc' } },
    },
  })

  if (!d || d.isDeleted) return null

  return {
    document: {
      id: d.id,
      orgId: d.orgId,
      departmentId: d.departmentId,
      shipmentId: d.shipmentId,
      customerId: d.customerId,
      type: d.type as DocType,
      customTypeName: d.customTypeName ?? undefined,
      title: d.title,
      fileName: d.fileName,
      sizeKb: Math.round(d.fileSizeBytes / 1024),
      pages: d.pages,
      docDate: d.docDate,
      uploadedBy: d.createdBy,
      uploadedAt: d.createdAt.toISOString(),
      ocrText: d.ocrResults[0]?.rawText ?? '',
      versions: d.versions.map((v) => ({
        id: v.id,
        version: v.versionNumber,
        fileName: v.fileName,
        sizeKb: Math.round(v.sizeBytes / 1024),
        uploadedBy: v.uploadedBy,
        uploadedAt: v.uploadedAt.toISOString(),
        note: v.changeNote ?? '',
      })),
      retentionUntil: d.retentionUntil ?? '',
      archiveBoxId: d.archiveBoxId ?? undefined,
      lock: d.isLocked && d.lockedBy ? { userId: d.lockedBy, since: d.lockedAt?.toISOString() ?? '' } : undefined,
    },
    shipment: {
      id: d.shipment.id,
      orgId: d.shipment.orgId,
      departmentId: d.shipment.departmentId,
      ownerId: d.shipment.ownerId,
      jobNo: d.shipment.jobNo,
      blNo: d.shipment.blNo,
      customerId: d.shipment.customerId,
      mode: d.shipment.mode as any,
      origin: d.shipment.origin,
      destination: d.shipment.destination,
      etd: d.shipment.etd,
      eta: d.shipment.eta,
      status: d.shipment.status as any,
      createdAt: d.shipment.createdAt.toISOString(),
      participants: d.shipment.participants,
    },
    customer: {
      id: d.customer.id,
      orgId: d.customer.orgId,
      name: d.customer.name,
      shortName: d.customer.shortName,
      taxCode: d.customer.taxCode,
    },
    archiveBox: d.archiveBox
      ? {
          id: d.archiveBox.id,
          orgId: d.archiveBox.orgId,
          code: d.archiveBox.code,
          warehouse: d.archiveBox.warehouse,
          shelf: d.archiveBox.shelf,
          box: d.archiveBox.box,
          customerId: d.archiveBox.customerId ?? undefined,
          period: d.archiveBox.period,
          documentIds: [d.id],
          createdAt: d.archiveBox.createdAt.toISOString(),
          createdBy: d.archiveBox.createdBy,
        }
      : null,
  }
}

export async function getCustomers() {
  const list = await prisma.customer.findMany({ orderBy: { name: 'asc' } })
  return list.map((c) => ({
    id: c.id,
    orgId: c.orgId,
    name: c.name,
    shortName: c.shortName,
    taxCode: c.taxCode,
  }))
}

export async function getUsers() {
  const users = await prisma.user.findMany({
    include: {
      departments: { where: { isPrimary: true }, include: { department: true } },
    },
  })

  return users.map((u) => ({
    id: u.id,
    orgId: u.orgId,
    name: u.name,
    email: u.email,
    role: u.roleCode.toLowerCase() as any,
    departmentId: u.departments[0]?.department.id ?? 'd1',
    branchId: 'b1',
    initials: u.initials,
    active: u.isActive,
    lastActive: u.lastActiveAt?.toISOString() ?? u.createdAt.toISOString(),
  }))
}

export async function getCurrentUser() {
  const sessionUser = await getSessionUser()
  if (sessionUser) {
    return {
      id: sessionUser.id,
      orgId: sessionUser.orgId,
      name: sessionUser.name,
      email: sessionUser.email,
      role: sessionUser.role.toLowerCase() as any,
      departmentId: sessionUser.departments[0]?.id ?? 'd1',
      branchId: 'b1',
      initials: sessionUser.initials,
      active: sessionUser.isActive,
      lastActive: new Date().toISOString(),
    }
  }

  // Fallback to primary manager if no session
  const user = await prisma.user.findFirst({
    where: { roleCode: 'ADMIN' },
  })

  return {
    id: user?.id ?? 'u1',
    orgId: user?.orgId ?? 'org_tml',
    name: user?.name ?? 'Nguyễn Hoàng',
    email: user?.email ?? 'admin@tml.vn',
    role: (user?.roleCode.toLowerCase() ?? 'admin') as any,
    departmentId: 'd1',
    branchId: 'b1',
    initials: user?.initials ?? 'NH',
    active: true,
    lastActive: new Date().toISOString(),
  }
}

export async function getAlerts(shipmentId?: string, tokenOverride?: string): Promise<AlertItem[]> {
  const shipments = await getShipments(tokenOverride)
  const alerts: AlertItem[] = []

  for (const s of shipments) {
    if (s.status === 'closed') continue
    if (shipmentId && s.id !== shipmentId) continue
    const isExport = s.origin.toUpperCase().includes('VN')
    for (const t of s.missingTypes) {
      const targetDate = t === 'BOOKING' ? s.etd : isExport ? s.etd : s.eta
      const days = daysUntil(targetDate)
      const critical = t === 'DELIVERY_ORDER' || t === 'ARRIVAL_NOTICE' || t === 'BOOKING' ? days <= 3 : days <= 7
      alerts.push({
        id: `al_missing_${s.id}_${t}`,
        kind: 'missing',
        severity: critical ? 'high' : days <= 14 ? 'medium' : 'low',
        title: `Thiếu ${DOC_TYPE_LABEL[t]}`,
        description: `Lô ${s.jobNo} · ${s.customerName}`,
        shipmentId: s.id,
        docType: t,
        dueDate: targetDate,
      })
    }
  }

  const sessionUser = await getSessionUser(tokenOverride)
  const docPermissionWhere = await PermissionService.buildDocumentWhereInput(sessionUser, 'VIEW')
  const docWhere = {
    AND: [
      { isDeleted: false, retentionUntil: { not: null } },
      docPermissionWhere,
    ],
  }

  const docs = await prisma.document.findMany({
    where: docWhere,
    include: { shipment: true },
  })

  for (const d of docs) {
    if (!d.retentionUntil) continue
    const days = daysUntil(d.retentionUntil)
    if (days > 90) continue
    alerts.push({
      id: `al_ret_${d.id}`,
      kind: 'retention',
      severity: days <= 14 ? 'high' : days <= 45 ? 'medium' : 'low',
      title: `${d.title} sắp hết hạn lưu trữ`,
      description: `Lô ${d.shipment.jobNo} · lưu trữ theo quy định`,
      shipmentId: d.shipment.id,
      documentId: d.id,
      dueDate: d.retentionUntil,
    })
  }

  const rank = { high: 0, medium: 1, low: 2 }
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity] || a.dueDate.localeCompare(b.dueDate))
}

export async function getDashboard() {
  const [shipments, alerts, docCount, newDocsThisWeek, activityLogs] = await Promise.all([
    getShipments(),
    getAlerts(),
    prisma.document.count({ where: { isDeleted: false } }),
    prisma.document.count({
      where: {
        isDeleted: false,
        createdAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
    }),
    prisma.auditLog.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    }),
  ])

  const active = shipments.filter((s) => s.status !== 'closed')

  return {
    kpis: {
      totalDocuments: docCount,
      newThisWeek: newDocsThisWeek,
      shipmentsMissing: active.filter((s) => s.missingTypes.length > 0).length,
      activeShipments: active.length,
      expiringSoon: alerts.filter((a) => a.kind === 'retention').length,
      searchesToday: 42,
    },
    activities: activityLogs.map((a) => ({
      id: a.id,
      userId: a.userId,
      action: a.action as any,
      documentId: a.resourceType === 'document' ? a.resourceId : undefined,
      shipmentId: a.resourceType === 'shipment' ? a.resourceId : undefined,
      description: `${a.user.name} đã thực hiện ${a.action} trên ${a.resourceType}`,
      at: a.createdAt.toISOString(),
    })),
    alerts: alerts.slice(0, 6),
    attention: active.filter((s) => s.missingTypes.length > 0).slice(0, 5),
  }
}

export async function getArchive() {
  const [boxes, docs, shipments, customers] = await Promise.all([
    prisma.archiveBox.findMany({
      include: { documents: { select: { id: true } } },
    }),
    getDocuments(),
    getShipments(),
    getCustomers(),
  ])

  return {
    boxes: boxes.map((b) => ({
      id: b.id,
      orgId: b.orgId,
      code: b.code,
      warehouse: b.warehouse,
      shelf: b.shelf,
      box: b.box,
      customerId: b.customerId ?? undefined,
      period: b.period,
      documentIds: b.documents.map((d) => d.id),
      createdAt: b.createdAt.toISOString(),
      createdBy: b.createdBy,
    })),
    documents: docs,
    shipments,
    customers,
  }
}

export async function getAuditLogs() {
  const sessionUser = await getSessionUser()
  const whereClause: any = {}

  if (sessionUser) {
    whereClause.orgId = sessionUser.orgId
    if (sessionUser.role !== 'ADMIN' && sessionUser.role !== 'MANAGER') {
      whereClause.userId = sessionUser.id
    }
  }

  const logs = await prisma.auditLog.findMany({
    where: whereClause,
    take: 100,
    orderBy: { createdAt: 'desc' },
  })

  return logs.map((l) => ({
    id: l.id,
    userId: l.userId,
    action: l.action as any,
    documentId: l.resourceId,
    ip: l.ipAddress ?? '127.0.0.1',
    device: l.device ?? 'Chrome · Desktop',
    at: l.createdAt.toISOString(),
  }))
}

export async function getSettings() {
  const [org, depts, users, positions, boxes] = await Promise.all([
    prisma.organization.findFirst(),
    prisma.department.findMany({
      include: { userLinks: true },
      orderBy: { code: 'asc' },
    }),
    prisma.user.findMany({
      include: {
        departments: { include: { department: true } },
        positions: { include: { position: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.position.findMany({ orderBy: { level: 'desc' } }),
    prisma.archiveBox.findMany({
      include: { documents: { select: { id: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return {
    organization: org
      ? {
          id: org.id,
          name: org.name,
          taxCode: org.taxCode,
          address: org.address,
          plan: org.plan,
        }
      : {
          id: 'org_tml',
          name: 'Công ty TNHH Logistics Tân Minh (TML)',
          taxCode: '0312 456 789',
          address: '12 Nguyễn Tất Thành, Q.4, TP.HCM',
          plan: 'Enterprise',
        },
    branches: [
      { id: 'b1', orgId: 'org_tml', name: 'Trụ sở Hồ Chí Minh', city: 'TP. Hồ Chí Minh', address: '12 Nguyễn Tất Thành, Q.4', userCount: users.length },
      { id: 'b2', orgId: 'org_tml', name: 'Chi nhánh Hải Phòng', city: 'Hải Phòng', address: '45 Lê Hồng Phong, Ngô Quyền', userCount: 4 },
      { id: 'b3', orgId: 'org_tml', name: 'Văn phòng Đà Nẵng', city: 'Đà Nẵng', address: '88 Bạch Đằng, Hải Châu', userCount: 2 },
    ],
    departments: depts.map((d) => ({
      id: d.id,
      orgId: d.orgId,
      name: d.name,
      code: d.code,
      head: d.headUserId ?? 'Chưa phân công',
      userCount: d.userLinks.length,
    })),
    users: users.map((u) => ({
      id: u.id,
      orgId: u.orgId,
      name: u.name,
      email: u.email,
      role: u.roleCode.toLowerCase() as any,
      roleCode: u.roleCode,
      departmentId: u.departments[0]?.department.id ?? '',
      departmentName: u.departments[0]?.department.name ?? 'Chưa gán',
      positionId: u.positions[0]?.position.id ?? '',
      positionName: u.positions[0]?.position.name ?? 'Chưa gán',
      isManager: u.departments[0]?.isManager ?? false,
      branchId: 'b1',
      initials: u.initials,
      active: u.isActive,
      mustChangePassword: u.mustChangePassword,
      lastActive: u.lastActiveAt?.toISOString() ?? u.createdAt.toISOString(),
    })),
    positions: positions.map((p) => ({
      id: p.id,
      name: p.name,
      level: p.level,
      description: p.description,
    })),
    archiveBoxes: boxes.map((b) => ({
      id: b.id,
      orgId: b.orgId,
      code: b.code,
      warehouse: b.warehouse,
      shelf: b.shelf,
      box: b.box,
      customerId: b.customerId ?? undefined,
      period: b.period,
      documentIds: b.documents.map((d) => d.id),
      createdAt: b.createdAt.toISOString(),
    })),
  }
}

export async function getPermissions() {
  const [depts, permissions, rolePermissions] = await Promise.all([
    prisma.department.findMany(),
    prisma.permission.findMany(),
    prisma.rolePermission.findMany({ include: { role: true, permission: true } }),
  ])

  const RESOURCES = [
    { id: 'documents', label: 'Chứng từ' },
    { id: 'shipments', label: 'Lô hàng' },
    { id: 'archive', label: 'Lưu trữ vật lý' },
    { id: 'audit', label: 'Nhật ký truy cập' },
    { id: 'settings', label: 'Cài đặt tổ chức' },
  ]

  const ROLES = ['owner', 'manager', 'team_lead', 'staff', 'viewer'] as const
  const ACTIONS = ['view', 'edit', 'download', 'delete'] as const

  const matrix: Record<string, any> = {}
  for (const d of depts) {
    matrix[d.id] = {}
    for (const r of RESOURCES) {
      matrix[d.id][r.id] = {}
      for (const role of ROLES) {
        matrix[d.id][r.id][role] = {}
        for (const act of ACTIONS) {
          const mod = r.id.toUpperCase()
          const actionUpper = act.toUpperCase()
          const hasRole = rolePermissions.some(
            (rp) =>
              (rp.role.code.toLowerCase() === role || (role === 'owner' && rp.role.code === 'ADMIN')) &&
              rp.permission.module === mod &&
              rp.permission.action === actionUpper
          )
          matrix[d.id][r.id][role][act] = hasRole
        }
      }
    }
  }

  return {
    departments: depts.map((d) => ({
      id: d.id,
      orgId: d.orgId,
      name: d.name,
      head: d.headUserId ?? 'Chưa phân công',
      userCount: 5,
    })),
    matrix,
    resources: RESOURCES,
  }
}

export async function getSearchIndex() {
  const [docs, shipments, customers] = await Promise.all([
    getDocuments(),
    getShipments(),
    getCustomers(),
  ])

  return {
    documents: docs.map(({ versions: _v, ...d }) => d),
    shipments,
    customers,
  }
}

export type SearchIndex = Awaited<ReturnType<typeof getSearchIndex>>
export type ShipmentDetail = NonNullable<Awaited<ReturnType<typeof getShipment>>>
export type DocumentDetail = NonNullable<Awaited<ReturnType<typeof getDocument>>>
