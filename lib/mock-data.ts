import type {
  Activity,
  ArchiveBox,
  AuditAction,
  AuditLog,
  Branch,
  Customer,
  Department,
  DocType,
  DocumentFile,
  Organization,
  PermissionAction,
  PermissionMatrix,
  Role,
  Shipment,
  User,
} from './types'

const ORG = 'org_tml'

export const organization: Organization = {
  id: ORG,
  name: 'Công ty TNHH Logistics Tân Minh (TML)',
  taxCode: '0312 456 789',
  address: '12 Nguyễn Tất Thành, Phường 12, Quận 4, TP. Hồ Chí Minh',
  plan: 'Business',
}

export const branches: Branch[] = [
  { id: 'b1', orgId: ORG, name: 'Trụ sở Hồ Chí Minh', city: 'TP. Hồ Chí Minh', address: '12 Nguyễn Tất Thành, Q.4', userCount: 18 },
  { id: 'b2', orgId: ORG, name: 'Chi nhánh Hải Phòng', city: 'Hải Phòng', address: '45 Lê Hồng Phong, Ngô Quyền', userCount: 9 },
  { id: 'b3', orgId: ORG, name: 'Văn phòng Đà Nẵng', city: 'Đà Nẵng', address: '88 Bạch Đằng, Hải Châu', userCount: 4 },
]

export const departments: Department[] = [
  { id: 'd1', orgId: ORG, name: 'Chứng từ', head: 'Trần Thu Hà', userCount: 8 },
  { id: 'd2', orgId: ORG, name: 'Hàng xuất', head: 'Lê Minh Tuấn', userCount: 7 },
  { id: 'd3', orgId: ORG, name: 'Hàng nhập', head: 'Hoàng Thị Mai', userCount: 6 },
  { id: 'd4', orgId: ORG, name: 'Kế toán', head: 'Đặng Mỹ Linh', userCount: 5 },
  { id: 'd5', orgId: ORG, name: 'Kinh doanh', head: 'Nguyễn Hoàng', userCount: 5 },
]

export const users: User[] = [
  { id: 'u1', orgId: ORG, name: 'Nguyễn Hoàng', email: 'hoang.nguyen@tml.vn', role: 'owner', departmentId: 'd5', branchId: 'b1', initials: 'NH', active: true, lastActive: '2026-10-19T09:20:00+07:00' },
  { id: 'u2', orgId: ORG, name: 'Trần Thu Hà', email: 'ha.tran@tml.vn', role: 'manager', departmentId: 'd1', branchId: 'b1', initials: 'TH', active: true, lastActive: '2026-10-19T09:05:00+07:00' },
  { id: 'u3', orgId: ORG, name: 'Lê Minh Tuấn', email: 'tuan.le@tml.vn', role: 'team_lead', departmentId: 'd2', branchId: 'b1', initials: 'LT', active: true, lastActive: '2026-10-19T08:50:00+07:00' },
  { id: 'u4', orgId: ORG, name: 'Phạm Ngọc Lan', email: 'lan.pham@tml.vn', role: 'staff', departmentId: 'd1', branchId: 'b1', initials: 'PL', active: true, lastActive: '2026-10-19T09:25:00+07:00' },
  { id: 'u5', orgId: ORG, name: 'Võ Đức Anh', email: 'anh.vo@tml.vn', role: 'staff', departmentId: 'd2', branchId: 'b2', initials: 'VA', active: true, lastActive: '2026-10-18T17:40:00+07:00' },
  { id: 'u6', orgId: ORG, name: 'Đặng Mỹ Linh', email: 'linh.dang@tml.vn', role: 'staff', departmentId: 'd4', branchId: 'b1', initials: 'ĐL', active: true, lastActive: '2026-10-19T08:10:00+07:00' },
  { id: 'u7', orgId: ORG, name: 'Bùi Quốc Khánh', email: 'khanh.bui@tml.vn', role: 'viewer', departmentId: 'd5', branchId: 'b3', initials: 'BK', active: false, lastActive: '2026-10-02T10:00:00+07:00' },
  { id: 'u8', orgId: ORG, name: 'Hoàng Thị Mai', email: 'mai.hoang@tml.vn', role: 'team_lead', departmentId: 'd3', branchId: 'b2', initials: 'HM', active: true, lastActive: '2026-10-19T07:55:00+07:00' },
]

export const CURRENT_USER_ID = 'u2'

export const customers: Customer[] = [
  { id: 'c1', orgId: ORG, name: 'Công ty CP Hải Sản Phương Nam', shortName: 'Hải Sản Phương Nam', taxCode: '0301112223' },
  { id: 'c2', orgId: ORG, name: 'Công ty TNHH Dệt May An Phát', shortName: 'Dệt May An Phát', taxCode: '0304445556' },
  { id: 'c3', orgId: ORG, name: 'Công ty CP Nội Thất Gỗ Việt', shortName: 'Nội Thất Gỗ Việt', taxCode: '3702223334' },
  { id: 'c4', orgId: ORG, name: 'Công ty TNHH Cà Phê Cao Nguyên Xanh', shortName: 'Cà Phê Cao Nguyên Xanh', taxCode: '6001234567' },
  { id: 'c5', orgId: ORG, name: 'Công ty TNHH Điện Tử Sao Mai', shortName: 'Điện Tử Sao Mai', taxCode: '0108889990' },
  { id: 'c6', orgId: ORG, name: 'Công ty CP Giày Da Bình Minh', shortName: 'Giày Da Bình Minh', taxCode: '3701119998' },
]

type ShipmentSeed = Omit<Shipment, 'orgId' | 'createdAt'> & { createdAt?: string; docs: DocType[] }

const shipmentSeeds: ShipmentSeed[] = [
  { id: 's1', jobNo: 'TML-SE2610-0142', blNo: 'HLCUSGN2610418', customerId: 'c1', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Los Angeles, US', etd: '2026-10-12', eta: '2026-11-03', status: 'customs', ownerId: 'u4', docs: ['BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS'] },
  { id: 's2', jobNo: 'TML-SE2610-0139', blNo: 'MAEU262104471', customerId: 'c2', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Rotterdam, NL', etd: '2026-10-08', eta: '2026-11-10', status: 'delivered', ownerId: 'u3', docs: ['BOOKING', 'BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS', 'CO'] },
  { id: 's3', jobNo: 'TML-SI2610-0087', blNo: 'ONEYPUSA28831', customerId: 'c5', mode: 'sea', origin: 'Busan, KR', destination: 'Hải Phòng, VN', etd: '2026-10-10', eta: '2026-10-21', status: 'on_yard', ownerId: 'u8', docs: ['ARRIVAL_NOTICE', 'BL', 'INVOICE'] },
  { id: 's4', jobNo: 'TML-AE2610-0031', blNo: '618-24519932', customerId: 'c5', mode: 'air', origin: 'Tân Sơn Nhất, VN', destination: 'Narita, JP', etd: '2026-10-17', eta: '2026-10-18', status: 'delivered', ownerId: 'u5', docs: ['BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS', 'CO'] },
  { id: 's5', jobNo: 'TML-SE2610-0133', blNo: 'COSU6421887310', customerId: 'c3', mode: 'sea', origin: 'Quy Nhơn, VN', destination: 'Long Beach, US', etd: '2026-10-05', eta: '2026-10-29', status: 'customs', ownerId: 'u4', docs: ['BOOKING', 'BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS', 'CO'] },
  { id: 's6', jobNo: 'TML-SE2610-0151', blNo: 'EGLV143650021', customerId: 'c4', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Hamburg, DE', etd: '2026-10-22', eta: '2026-11-26', status: 'booking', ownerId: 'u3', docs: ['BOOKING'] },
  { id: 's7', jobNo: 'TML-SI2610-0091', blNo: 'CMDUSHA1937220', customerId: 'c6', mode: 'sea', origin: 'Thượng Hải, CN', destination: 'Cát Lái, VN', etd: '2026-10-09', eta: '2026-10-16', status: 'customs', ownerId: 'u8', docs: ['ARRIVAL_NOTICE', 'BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS'] },
  { id: 's8', jobNo: 'TML-RD2610-0012', blNo: 'CMR-LS-2610-12', customerId: 'c2', mode: 'road', origin: 'Hà Nội, VN', destination: 'Bằng Tường, CN', etd: '2026-10-15', eta: '2026-10-17', status: 'delivered', ownerId: 'u5', docs: ['BOOKING', 'BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS', 'CO'] },
  { id: 's9', jobNo: 'TML-SE2609-0118', blNo: 'HLCUSGN2609377', customerId: 'c1', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Tokyo, JP', etd: '2026-09-20', eta: '2026-09-30', status: 'closed', ownerId: 'u4', docs: ['BOOKING', 'BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS', 'CO'] },
  { id: 's10', jobNo: 'TML-SE2609-0109', blNo: 'MAEU262097745', customerId: 'c3', mode: 'sea', origin: 'Cái Mép, VN', destination: 'Sydney, AU', etd: '2026-09-14', eta: '2026-10-02', status: 'closed', ownerId: 'u3', docs: ['BOOKING', 'BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS', 'CO'] },
  { id: 's11', jobNo: 'TML-AI2610-0019', blNo: '160-88231045', customerId: 'c6', mode: 'air', origin: 'Frankfurt, DE', destination: 'Tân Sơn Nhất, VN', etd: '2026-10-18', eta: '2026-10-20', status: 'arrived', ownerId: 'u8', docs: ['ARRIVAL_NOTICE', 'BL', 'INVOICE'] },
  { id: 's12', jobNo: 'TML-SE2610-0147', blNo: 'ONEYSGNA77512', customerId: 'c4', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Singapore, SG', etd: '2026-10-14', eta: '2026-10-17', status: 'customs', ownerId: 'u4', docs: ['BOOKING', 'BL', 'PACKING_LIST'] },
  { id: 's13', jobNo: 'TML-SE2109-0044', blNo: 'HLCUSGN2109112', customerId: 'c2', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Antwerp, BE', etd: '2021-09-10', eta: '2021-10-15', status: 'closed', ownerId: 'u3', createdAt: '2021-09-01T08:00:00+07:00', docs: ['BOOKING', 'BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS', 'CO'] },
  { id: 's14', jobNo: 'TML-SE2110-0058', blNo: 'MAEU211058834', customerId: 'c1', mode: 'sea', origin: 'Cát Lái, VN', destination: 'Busan, KR', etd: '2021-10-28', eta: '2021-11-04', status: 'closed', ownerId: 'u4', createdAt: '2021-10-20T08:00:00+07:00', docs: ['BOOKING', 'BL', 'INVOICE', 'PACKING_LIST', 'CUSTOMS', 'CO'] },
]

export const shipments: Shipment[] = shipmentSeeds.map(({ docs: _docs, createdAt, ...s }) => ({
  ...s,
  orgId: ORG,
  createdAt: createdAt ?? new Date(new Date(s.etd).getTime() - 7 * 86400000).toISOString(),
}))

const customerById = (id: string) => customers.find((c) => c.id === id)!

function goods(customerId: string) {
  const map: Record<string, string> = {
    c1: 'FROZEN PANGASIUS FILLET (CÁ TRA PHI LÊ ĐÔNG LẠNH), HS 0304.62',
    c2: 'COTTON T-SHIRTS AND KNITWEAR (ÁO THUN COTTON), HS 6109.10',
    c3: 'WOODEN DINING FURNITURE (BÀN GHẾ GỖ), HS 9403.60',
    c4: 'ROBUSTA COFFEE BEANS GRADE 1 (CÀ PHÊ NHÂN), HS 0901.11',
    c5: 'PRINTED CIRCUIT BOARD ASSEMBLY (BẢN MẠCH ĐIỆN TỬ), HS 8534.00',
    c6: 'LEATHER FOOTWEAR (GIÀY DA), HS 6403.99',
  }
  return map[customerId]
}

function ocrFor(type: DocType, s: ShipmentSeed): string {
  const c = customerById(s.customerId)
  const base = `Shipper: ${c.name.toUpperCase()} — MST ${c.taxCode}. Job No: ${s.jobNo}. B/L No: ${s.blNo}.`
  const g = goods(s.customerId)
  switch (type) {
    case 'BL':
      return `BILL OF LADING ${s.blNo}. ${base} Port of Loading: ${s.origin}. Port of Discharge: ${s.destination}. Vessel / Voyage: HAPAG EXPRESS 042E. Container: HLXU 8812340 / 40HC, Seal: SL776120. Description of goods: ${g}. Freight prepaid. Number of original B/L: THREE (3). Shipped on board date: ${s.etd}.`
    case 'INVOICE':
      return `COMMERCIAL INVOICE INV-${s.jobNo.slice(-4)}/2026. ${base} Consignee: GLOBAL TRADING CORP. Terms of payment: T/T 30 days. Incoterms: FOB ${s.origin}. Description: ${g}. Total amount: USD ${(18000 + Number(s.jobNo.slice(-3)) * 37).toLocaleString('en-US')}.00. Bank: Vietcombank — SWIFT BFTVVNVX.`
    case 'PACKING_LIST':
      return `PACKING LIST PL-${s.jobNo.slice(-4)}. ${base} Total packages: 1.240 cartons. Gross weight: 18.450 KGS. Net weight: 17.200 KGS. Measurement: 62,5 CBM. Marks & numbers: GTC/${s.jobNo.slice(-4)}/1-1240. Goods: ${g}.`
    case 'BOOKING':
      return `BOOKING CONFIRMATION BKG-${s.blNo.slice(-6)}. ${base} Carrier confirms space 1 x 40HC. Cut-off SI: 2 days before ETD. Cut-off CY: 1 day before ETD. ETD ${s.etd}, ETA ${s.eta}. Empty pickup depot: ICD Phước Long.`
    case 'DELIVERY_ORDER':
      return `ELECTRONIC DELIVERY ORDER eDO-${s.blNo.slice(-5)}. ${base} Please release cargo to bearer: ${g}. Container HLXU 8812340. Free time: 7 days. Valid until: ${s.eta}.`
    case 'ARRIVAL_NOTICE':
      return `ARRIVAL NOTICE A/N-${s.blNo.slice(-5)}. ${base} Carrier announces arrival of vessel at ${s.destination}. Cargo: ${g}. Please exchange for eDO before free time expiry.`
    case 'CUSTOMS':
      return `TỜ KHAI HẢI QUAN ĐIỆN TỬ (TKHQ) số 30591${s.jobNo.slice(-4)}. ${base} Chi cục Hải quan cửa khẩu. Mã loại hình: B11. Phân luồng: Xanh. Trị giá tính thuế khai báo theo hóa đơn thương mại.`
    case 'CO':
      return `CERTIFICATE OF ORIGIN FORM E No. VN-${s.jobNo.slice(-4)}. ${base} Country of origin: VIET NAM. Origin criterion: WO. Issued by Ministry of Industry and Trade.`
    default:
      return base
  }
}

export const FILE_PREFIX: Record<DocType, string> = {
  BL: 'BL',
  INVOICE: 'INV',
  PACKING_LIST: 'PL',
  BOOKING: 'BKG',
  DELIVERY_ORDER: 'eDO',
  ARRIVAL_NOTICE: 'AN',
  CUSTOMS: 'TK',
  CO: 'CO',
  OTHER: 'DOC',
}

const TITLE: Record<DocType, string> = {
  BL: 'Vận đơn',
  INVOICE: 'Hóa đơn thương mại',
  PACKING_LIST: 'Phiếu đóng gói',
  BOOKING: 'Xác nhận Booking',
  DELIVERY_ORDER: 'Lệnh giao hàng điện tử (eDO)',
  ARRIVAL_NOTICE: 'Thông báo hàng đến',
  CUSTOMS: 'Tờ khai hải quan (TKHQ)',
  CO: 'Chứng nhận xuất xứ (C/O)',
  OTHER: 'Tài liệu',
}

const uploaderPool = ['u4', 'u5', 'u3', 'u8', 'u6', 'u2']
const LATEST = new Date('2026-10-19T09:00:00+07:00').getTime()

const OLD_RETENTION: Record<string, string[]> = {
  s13: ['2026-10-28', '2026-11-04', '2026-11-12', '2026-11-20', '2026-12-01'],
  s14: ['2026-11-25', '2026-12-08', '2026-12-15', '2027-01-05', '2027-01-12'],
}

export const documents: DocumentFile[] = shipmentSeeds.flatMap((s, si) =>
  s.docs.map((type, di) => {
    const created = new Date(shipments[si].createdAt).getTime() + (di + 1) * 9 * 3600000
    const uploadedAt = new Date(Math.min(created, LATEST - (si * 7 + di) * 60000)).toISOString()
    const fileName = `${FILE_PREFIX[type]}_${s.jobNo}.pdf`
    const versionCount = (si + di) % 3 === 0 ? 3 : (si + di) % 2 === 0 ? 2 : 1
    const sizeKb = 180 + ((si * 37 + di * 91) % 1400)
    const versions = Array.from({ length: versionCount }, (_, v) => ({
      id: `v_${s.id}_${type}_${v + 1}`,
      version: v + 1,
      fileName: v === versionCount - 1 ? fileName : `${FILE_PREFIX[type]}_${s.jobNo}_draft${v + 1}.pdf`,
      sizeKb: sizeKb - (versionCount - 1 - v) * 24,
      uploadedBy: uploaderPool[(si + di + v) % uploaderPool.length],
      uploadedAt: new Date(new Date(uploadedAt).getTime() - (versionCount - 1 - v) * 26 * 3600000).toISOString(),
      note: v === versionCount - 1 ? 'Bản chính thức' : v === 0 ? 'Bản nháp từ khách hàng' : 'Sửa trọng lượng & số kiện',
    })).reverse()
    const retentionUntil =
      OLD_RETENTION[s.id]?.[di] ?? new Date(new Date(uploadedAt).getTime() + 5 * 365 * 86400000).toISOString().slice(0, 10)

    return {
      id: `doc_${s.id}_${type.toLowerCase()}`,
      orgId: ORG,
      shipmentId: s.id,
      customerId: s.customerId,
      type,
      title: `${TITLE[type]} ${type === 'BL' ? s.blNo : s.jobNo}`,
      fileName,
      sizeKb,
      pages: type === 'BL' ? 2 : type === 'PACKING_LIST' ? 3 : 1,
      docDate: uploadedAt.slice(0, 10),
      uploadedBy: uploaderPool[(si + di) % uploaderPool.length],
      uploadedAt,
      ocrText: ocrFor(type, s),
      versions,
      retentionUntil,
    } satisfies DocumentFile
  }),
)

const lockMap: Record<string, { userId: string; since: string }> = {
  doc_s1_invoice: { userId: 'u4', since: '2026-10-19T09:12:00+07:00' },
  doc_s7_customs: { userId: 'u8', since: '2026-10-19T08:58:00+07:00' },
}
for (const d of documents) if (lockMap[d.id]) d.lock = lockMap[d.id]

export const archiveBoxes: ArchiveBox[] = [
  { id: 'ab1', orgId: ORG, code: 'ARC-2609-001', warehouse: 'Kho Quận 4 - HCM', shelf: 'A3', box: '12', customerId: 'c1', period: '2026-09', documentIds: [], createdAt: '2026-09-30T16:00:00+07:00', createdBy: 'u2' },
  { id: 'ab2', orgId: ORG, code: 'ARC-2609-002', warehouse: 'Kho Quận 4 - HCM', shelf: 'A3', box: '13', customerId: 'c3', period: '2026-09', documentIds: [], createdAt: '2026-09-30T16:20:00+07:00', createdBy: 'u2' },
  { id: 'ab3', orgId: ORG, code: 'ARC-2610-001', warehouse: 'Kho Quận 4 - HCM', shelf: 'B1', box: '01', period: '2026-10', documentIds: [], createdAt: '2026-10-15T10:00:00+07:00', createdBy: 'u4' },
  { id: 'ab4', orgId: ORG, code: 'ARC-2610-002', warehouse: 'Kho Hải Phòng', shelf: 'C2', box: '04', customerId: 'c5', period: '2026-10', documentIds: [], createdAt: '2026-10-16T14:00:00+07:00', createdBy: 'u8' },
  { id: 'ab5', orgId: ORG, code: 'ARC-2110-007', warehouse: 'Kho dài hạn Bình Chánh', shelf: 'Z9', box: '41', customerId: 'c2', period: '2021-10', documentIds: [], createdAt: '2021-10-31T16:00:00+07:00', createdBy: 'u3' },
]

const BOX_FOR_SHIPMENT: Record<string, string> = { s9: 'ab1', s10: 'ab2', s8: 'ab3', s3: 'ab4', s4: 'ab4', s13: 'ab5' }
const MISSING_HARD_COPY = new Set(['doc_s9_delivery_order', 'doc_s10_invoice', 'doc_s8_packing_list'])
for (const d of documents) {
  const box = BOX_FOR_SHIPMENT[d.shipmentId]
  if (!box || d.type === 'BOOKING' || MISSING_HARD_COPY.has(d.id)) continue
  d.archiveBoxId = box
  archiveBoxes.find((b) => b.id === box)!.documentIds.push(d.id)
}

export const activities: Activity[] = [
  { id: 'a1', userId: 'u4', action: 'edit', documentId: 'doc_s1_invoice', shipmentId: 's1', description: 'đang chỉnh sửa Hóa đơn thương mại', at: '2026-10-19T09:12:00+07:00' },
  { id: 'a2', userId: 'u8', action: 'upload', documentId: 'doc_s11_invoice', shipmentId: 's11', description: 'đã tải lên Hóa đơn thương mại', at: '2026-10-19T08:47:00+07:00' },
  { id: 'a3', userId: 'u2', action: 'share', documentId: 'doc_s2_bl', shipmentId: 's2', description: 'đã chia sẻ Vận đơn cho khách hàng', at: '2026-10-19T08:31:00+07:00' },
  { id: 'a4', userId: 'u3', action: 'download', documentId: 'doc_s5_packing_list', shipmentId: 's5', description: 'đã tải xuống Phiếu đóng gói', at: '2026-10-19T08:15:00+07:00' },
  { id: 'a5', userId: 'u5', action: 'upload', documentId: 'doc_s8_delivery_order', shipmentId: 's8', description: 'đã tải lên Lệnh giao hàng', at: '2026-10-18T17:22:00+07:00' },
  { id: 'a6', userId: 'u6', action: 'view', documentId: 'doc_s4_invoice', shipmentId: 's4', description: 'đã xem Hóa đơn thương mại', at: '2026-10-18T16:05:00+07:00' },
  { id: 'a7', userId: 'u2', action: 'restore', documentId: 'doc_s2_packing_list', shipmentId: 's2', description: 'đã khôi phục phiên bản 2 của Phiếu đóng gói', at: '2026-10-18T14:40:00+07:00' },
  { id: 'a8', userId: 'u4', action: 'upload', documentId: 'doc_s12_packing_list', shipmentId: 's12', description: 'đã tải lên Phiếu đóng gói', at: '2026-10-18T11:10:00+07:00' },
]

const auditActions: AuditAction[] = ['view', 'view', 'view', 'download', 'edit', 'view', 'download', 'upload', 'share', 'delete', 'restore']
const devices = ['Chrome · Windows', 'Safari · macOS', 'Edge · Windows', 'Chrome · Android', 'Safari · iOS']

export const auditLogs: AuditLog[] = Array.from({ length: 64 }, (_, i) => ({
  id: `log_${i + 1}`,
  userId: users[(i * 3) % users.length].id,
  action: auditActions[(i * 5) % auditActions.length],
  documentId: documents[(i * 7) % documents.length].id,
  ip: `113.161.${(i * 13) % 255}.${(i * 29) % 255}`,
  device: devices[i % devices.length],
  at: new Date(new Date('2026-10-19T09:20:00+07:00').getTime() - i * 2.7 * 3600000).toISOString(),
}))

export const searchesToday = 147

export const RESOURCES = [
  { id: 'documents', label: 'Chứng từ' },
  { id: 'shipments', label: 'Lô hàng' },
  { id: 'archive', label: 'Lưu trữ vật lý' },
  { id: 'audit', label: 'Nhật ký truy cập' },
  { id: 'settings', label: 'Cài đặt tổ chức' },
] as const

export const ROLES: Role[] = ['owner', 'manager', 'team_lead', 'staff', 'viewer']
export const ACTIONS: PermissionAction[] = ['view', 'edit', 'download', 'delete']

function defaultFor(role: Role, resource: string, action: PermissionAction): boolean {
  if (role === 'owner') return true
  if (role === 'manager') return !(resource === 'settings' && action === 'delete')
  if (role === 'team_lead') {
    if (resource === 'settings' || resource === 'audit') return action === 'view'
    return action !== 'delete'
  }
  if (role === 'staff') {
    if (resource === 'settings' || resource === 'audit') return false
    return action === 'view' || action === 'download' || (action === 'edit' && resource !== 'archive')
  }
  return action === 'view' && (resource === 'documents' || resource === 'shipments')
}

export const permissionMatrix: PermissionMatrix = Object.fromEntries(
  departments.map((d) => [
    d.id,
    Object.fromEntries(
      RESOURCES.map((r) => [
        r.id,
        Object.fromEntries(
          ROLES.map((role) => [
            role,
            Object.fromEntries(
              ACTIONS.map((a) => [a, defaultFor(role, r.id, a) && !(d.id === 'd4' && r.id === 'shipments' && a === 'edit' && role === 'staff')]),
            ),
          ]),
        ),
      ]),
    ),
  ]),
) as PermissionMatrix
