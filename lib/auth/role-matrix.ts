/**
 * TML LOGISTICS - ROLE PERMISSIONS MATRIX (SINGLE SOURCE OF TRUTH)
 * 
 * Nguồn sự thật duy nhất (Single Source of Truth) định nghĩa ma trận phân quyền
 * giữa các vai trò trong hệ thống: ADMIN, MANAGER, STAFF.
 * 
 * Quy tắc:
 * 1. ADMIN (84 quyền): Toàn quyền tối cao trên toàn bộ 7 phân hệ và 12 hành động.
 * 2. MANAGER (36 quyền): Quản lý toàn diện các phân hệ nghiệp vụ chính (DOCUMENTS, SHIPMENTS, ARCHIVE)
 *    thuộc phạm vi phòng ban mình (toàn bộ quyền trừ DELETE).
 *    Chỉ có quyền xem (VIEW) trên USERS, DEPARTMENTS, AUDIT.
 *    Tuyệt đối không có quyền trong SETTINGS và không có quyền DELETE (trừ khi ADMIN cấp riêng).
 * 3. STAFF (12 quyền): Thực hiện tác nghiệp trên các lô hàng và chứng từ được phân công
 *    (VIEW, UPLOAD, DOWNLOAD, EDIT trên DOCUMENTS, SHIPMENTS, ARCHIVE).
 *    Không có quyền CREATE hoặc DELETE lô hàng, không xóa chứng từ, không truy cập cấu hình tổ chức.
 */

export const ALL_MODULES = [
  'DOCUMENTS',
  'SHIPMENTS',
  'USERS',
  'DEPARTMENTS',
  'AUDIT',
  'SETTINGS',
  'ARCHIVE',
] as const

export const ALL_ACTIONS = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'UPLOAD',
  'DOWNLOAD',
  'SHARE',
  'APPROVE',
  'EXPORT',
  'ASSIGN',
  'RESTORE',
  'MANAGE',
] as const

export type ModuleType = typeof ALL_MODULES[number]
export type ActionType = typeof ALL_ACTIONS[number]

/**
 * Danh sách 84 mã quyền toàn hệ thống (7 modules x 12 actions)
 */
export const SYSTEM_PERMISSIONS: string[] = ALL_MODULES.flatMap((mod) =>
  ALL_ACTIONS.map((act) => `${mod}:${act}`)
)

/**
 * 36 quyền dành riêng cho vai trò Quản lý phòng ban (MANAGER):
 * - DOCUMENTS (11 quyền, trừ DELETE)
 * - SHIPMENTS (11 quyền, trừ DELETE)
 * - ARCHIVE (11 quyền, trừ DELETE)
 * - USERS:VIEW (1 quyền)
 * - DEPARTMENTS:VIEW (1 quyền)
 * - AUDIT:VIEW (1 quyền)
 * - SETTINGS: 0 quyền
 */
export const MANAGER_PERMISSIONS: string[] = [
  // DOCUMENTS (11)
  'DOCUMENTS:VIEW',
  'DOCUMENTS:CREATE',
  'DOCUMENTS:EDIT',
  'DOCUMENTS:UPLOAD',
  'DOCUMENTS:DOWNLOAD',
  'DOCUMENTS:SHARE',
  'DOCUMENTS:APPROVE',
  'DOCUMENTS:EXPORT',
  'DOCUMENTS:ASSIGN',
  'DOCUMENTS:RESTORE',
  'DOCUMENTS:MANAGE',

  // SHIPMENTS (11)
  'SHIPMENTS:VIEW',
  'SHIPMENTS:CREATE',
  'SHIPMENTS:EDIT',
  'SHIPMENTS:UPLOAD',
  'SHIPMENTS:DOWNLOAD',
  'SHIPMENTS:SHARE',
  'SHIPMENTS:APPROVE',
  'SHIPMENTS:EXPORT',
  'SHIPMENTS:ASSIGN',
  'SHIPMENTS:RESTORE',
  'SHIPMENTS:MANAGE',

  // ARCHIVE (11)
  'ARCHIVE:VIEW',
  'ARCHIVE:CREATE',
  'ARCHIVE:EDIT',
  'ARCHIVE:UPLOAD',
  'ARCHIVE:DOWNLOAD',
  'ARCHIVE:SHARE',
  'ARCHIVE:APPROVE',
  'ARCHIVE:EXPORT',
  'ARCHIVE:ASSIGN',
  'ARCHIVE:RESTORE',
  'ARCHIVE:MANAGE',

  // Giám sát phòng ban (3)
  'USERS:VIEW',
  'DEPARTMENTS:VIEW',
  'AUDIT:VIEW',
]

/**
 * 12 quyền cơ sở dành cho Nhân viên tác nghiệp (STAFF):
 * - DOCUMENTS: VIEW, UPLOAD, DOWNLOAD, EDIT (4)
 * - SHIPMENTS: VIEW, UPLOAD, DOWNLOAD, EDIT (4)
 * - ARCHIVE: VIEW, UPLOAD, DOWNLOAD, EDIT (4)
 */
export const STAFF_PERMISSIONS: string[] = [
  'DOCUMENTS:VIEW',
  'DOCUMENTS:UPLOAD',
  'DOCUMENTS:DOWNLOAD',
  'DOCUMENTS:EDIT',

  'SHIPMENTS:VIEW',
  'SHIPMENTS:UPLOAD',
  'SHIPMENTS:DOWNLOAD',
  'SHIPMENTS:EDIT',

  'ARCHIVE:VIEW',
  'ARCHIVE:UPLOAD',
  'ARCHIVE:DOWNLOAD',
  'ARCHIVE:EDIT',
]

export const ROLE_PERMISSIONS_MATRIX: Record<'ADMIN' | 'MANAGER' | 'STAFF', string[]> = {
  ADMIN: SYSTEM_PERMISSIONS,
  MANAGER: MANAGER_PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
}

export function getExpectedRolePermissions(roleCode: 'ADMIN' | 'MANAGER' | 'STAFF'): string[] {
  return ROLE_PERMISSIONS_MATRIX[roleCode] || []
}

export function isActionPermittedInMatrix(
  roleCode: 'ADMIN' | 'MANAGER' | 'STAFF',
  module: string,
  action: string
): boolean {
  const code = `${module}:${action}`
  const list = ROLE_PERMISSIONS_MATRIX[roleCode]
  return list ? list.includes(code) : false
}
