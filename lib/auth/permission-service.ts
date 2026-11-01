import { prisma } from '@/lib/prisma'
import type { AuthUser } from './auth-service'

export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'SHARE'
  | 'APPROVE'
  | 'EXPORT'
  | 'ASSIGN'
  | 'RESTORE'
  | 'MANAGE'

export type PermissionModule =
  | 'DOCUMENTS'
  | 'SHIPMENTS'
  | 'USERS'
  | 'DEPARTMENTS'
  | 'AUDIT'
  | 'SETTINGS'
  | 'ARCHIVE'

export type ResourceScope =
  | 'GLOBAL'
  | 'ORGANIZATION'
  | 'DEPARTMENT'
  | 'ASSIGNED'
  | 'SHARED'
  | 'OWNED'

export interface ResourceContext {
  id?: string
  orgId?: string
  departmentId?: string | null
  createdBy?: string
  ownerId?: string
  assignedUserIds?: string[]
}

export interface EffectivePermission {
  code: string
  module: PermissionModule
  action: PermissionAction
  isGranted: boolean
  scope: ResourceScope
  origin: 'ROLE' | 'USER_OVERRIDE' | 'DEPARTMENT_POLICY' | 'ADMIN_BYPASS'
}

/**
 * Danh sách các hành động bắt buộc phải có thực thể tài nguyên cụ thể (Entity Context)
 * khi người dùng không sở hữu phạm vi GLOBAL hoặc ORGANIZATION.
 */
const ENTITY_REQUIRED_ACTIONS: ReadonlySet<PermissionAction> = new Set([
  'EDIT',
  'DELETE',
  'DOWNLOAD',
  'SHARE',
  'APPROVE',
  'RESTORE',
  'ASSIGN',
])

export class PermissionService {
  /**
   * Kiểm tra quyền thao tác chi tiết: RBAC + Department-Based + Resource-Level
   */
  static async check(
    user: AuthUser | null,
    module: PermissionModule,
    action: PermissionAction,
    resource?: ResourceContext
  ): Promise<{ allowed: boolean; reason?: string }> {
    // 1. Unauthenticated luôn bị từ chối
    if (!user) {
      return { allowed: false, reason: 'Chưa đăng nhập (Unauthenticated).' }
    }

    // 2. Tài khoản không hoạt động luôn bị từ chối
    if (!user.isActive) {
      return { allowed: false, reason: 'Tài khoản đã bị vô hiệu hóa hoặc ngừng hoạt động.' }
    }

    // 3. ADMIN có quyền GLOBAL tối cao đối với tài nguyên thuộc tổ chức
    if (user.role === 'ADMIN') {
      if (resource?.orgId && resource.orgId !== user.orgId) {
        return { allowed: false, reason: 'Không thể truy cập tài nguyên của tổ chức khác.' }
      }
      return { allowed: true }
    }

    // 4. Kiểm tra cách ly tổ chức (Organization Isolation)
    if (resource?.orgId && resource.orgId !== user.orgId) {
      return { allowed: false, reason: 'Tài nguyên thuộc tổ chức khác (Cross-organization access denied).' }
    }

    const permissionCode = `${module}:${action}`

    // 5. Kiểm tra Explicit Deny ở cấp User (Quy tắc bắt buộc: Explicit Deny > Allow)
    const userPerm = await prisma.userPermission.findFirst({
      where: {
        userId: user.id,
        permission: { code: permissionCode },
      },
      include: { permission: true },
    })

    if (userPerm && !userPerm.isGranted) {
      return { allowed: false, reason: 'Quyền đã bị quản trị viên từ chối rõ ràng (Explicit Deny).' }
    }

    let isGranted = false
    let applicableScope: ResourceScope = 'DEPARTMENT'

    // 6. Kiểm tra User Explicit Grant
    if (userPerm && userPerm.isGranted) {
      isGranted = true
      applicableScope = userPerm.scope as ResourceScope
    }

    // 7. Nếu chưa grant ở User, kiểm tra qua Role Permissions
    if (!isGranted) {
      const rolePerm = await prisma.rolePermission.findFirst({
        where: {
          role: { code: user.role },
          permission: { code: permissionCode },
        },
      })
      if (rolePerm) {
        isGranted = true
        applicableScope = user.role === 'MANAGER' ? 'DEPARTMENT' : 'ASSIGNED'
      }
    }

    // 8. Kiểm tra qua Department Permissions (hỗ trợ đa phòng ban)
    if (!isGranted && user.departments.length > 0) {
      const deptIds = user.departments.map((d) => d.id)
      const deptPerm = await prisma.departmentPermission.findFirst({
        where: {
          departmentId: { in: deptIds },
          permission: { code: permissionCode },
        },
      })
      if (deptPerm) {
        isGranted = true
        applicableScope = deptPerm.scope as ResourceScope
      }
    }

    // Nếu không được cấp quyền ở bất kỳ cấp độ nào
    if (!isGranted) {
      return { allowed: false, reason: `Không có quyền ${action} trên phân hệ ${module}.` }
    }

    // 9. Kiểm tra tính hiện diện của tài nguyên đối với các hành động yêu cầu Entity
    // Khắc phục SEC-06: Không tự động cấp quyền khi thiếu resource đối với các hành động tài nguyên
    if (ENTITY_REQUIRED_ACTIONS.has(action)) {
      if (!resource || !resource.id) {
        if (applicableScope !== 'GLOBAL' && applicableScope !== 'ORGANIZATION') {
          return {
            allowed: false,
            reason: `Thao tác ${action} yêu cầu chỉ định đối tượng tài nguyên cụ thể (Resource context required).`,
          }
        }
      }
    }

    // Đối với CREATE hoặc UPLOAD: Nếu có chỉ định departmentId, xác minh người dùng có quyền trong phòng ban đó
    if ((action === 'CREATE' || action === 'UPLOAD') && resource?.departmentId) {
      if (applicableScope === 'DEPARTMENT' || applicableScope === 'ASSIGNED') {
        const userDeptIds = user.departments.map((d) => d.id)
        if (!userDeptIds.includes(resource.departmentId)) {
          return {
            allowed: false,
            reason: 'Bạn không thuộc phòng ban được chỉ định để tạo hoặc tải lên tài nguyên.',
          }
        }
      }
    }

    // 10. Đánh giá Resource Scope chi tiết
    if (!resource || applicableScope === 'GLOBAL' || applicableScope === 'ORGANIZATION') {
      return { allowed: true }
    }

    return this.evaluateScope(user, applicableScope, resource, module, action)
  }

  /**
   * Đánh giá phạm vi tài nguyên chi tiết: OWNED, ASSIGNED, DEPARTMENT, SHARED
   */
  private static async evaluateScope(
    user: AuthUser,
    scope: ResourceScope,
    res: ResourceContext,
    module: PermissionModule,
    action: PermissionAction
  ): Promise<{ allowed: boolean; reason?: string }> {
    const userDeptIds = user.departments.map((d) => d.id)

    // A. OWNED: Người tạo hoặc sở hữu tài nguyên
    if (res.createdBy === user.id || res.ownerId === user.id) {
      return { allowed: true }
    }

    // B. ASSIGNED: Được phân công trực tiếp vào tài nguyên
    if (res.assignedUserIds && res.assignedUserIds.includes(user.id)) {
      return { allowed: true }
    }

    // C. DEPARTMENT: Thuộc cùng phòng ban
    if (scope === 'DEPARTMENT') {
      if (res.departmentId && userDeptIds.includes(res.departmentId)) {
        return { allowed: true }
      }
    }

    // D. SHARED: Kiểm tra chia sẻ nội bộ qua DocumentAccessPermission
    // Khắc phục SEC-07: Phân biệt chặt chẽ VIEW vs DOWNLOAD vs EDIT, cấm DELETE/SHARE
    if (res.id && module === 'DOCUMENTS') {
      const now = new Date()

      const shareGrants = await prisma.documentAccessPermission.findMany({
        where: {
          documentId: res.id,
          OR: [
            { targetUserId: user.id },
            { targetDeptId: { in: userDeptIds } },
          ],
          AND: [
            {
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
            },
          ],
        },
      })

      if (shareGrants.length > 0) {
        // Shared access NEVER permits DELETE or SHARE or MANAGE
        if (action === 'DELETE' || action === 'SHARE' || action === 'MANAGE') {
          return {
            allowed: false,
            reason: `Quyền được chia sẻ nội bộ không bao gồm quyền ${action} trên chứng từ.`,
          }
        }

        const levels = new Set(shareGrants.map((g) => g.permissionLevel.toUpperCase()))

        if (action === 'VIEW') {
          // VIEW được phép với bất kỳ cấp chia sẻ nào (VIEW, DOWNLOAD, EDIT)
          return { allowed: true }
        }

        if (action === 'DOWNLOAD') {
          if (levels.has('DOWNLOAD') || levels.has('EDIT')) {
            return { allowed: true }
          }
          return {
            allowed: false,
            reason: 'Tài liệu chỉ được chia sẻ quyền xem trực tuyến, không được phép tải xuống.',
          }
        }

        if (action === 'EDIT') {
          if (levels.has('EDIT')) {
            return { allowed: true }
          }
          return {
            allowed: false,
            reason: 'Tài liệu chỉ được chia sẻ quyền xem/tải, không được phép chỉnh sửa.',
          }
        }
      }
    }

    return {
      allowed: false,
      reason: `Tài nguyên nằm ngoài phạm vi truy cập (${scope}) của người dùng.`,
    }
  }

  /**
   * Lấy ma trận quyền hiệu lực của một người dùng (đồng bộ hoàn toàn với logic check)
   */
  static async getEffectivePermissions(userId: string): Promise<EffectivePermission[]> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: { include: { permission: true } },
          },
        },
        departments: {
          include: {
            department: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        permissions: { include: { permission: true } },
      },
    })

    if (!user) return []

    const allPermissions = await prisma.permission.findMany()

    // ADMIN có toàn quyền bypass
    if (user.roleCode === 'ADMIN') {
      return allPermissions.map((p) => ({
        code: p.code,
        module: p.module as PermissionModule,
        action: p.action as PermissionAction,
        isGranted: true,
        scope: 'GLOBAL',
        origin: 'ADMIN_BYPASS',
      }))
    }

    const userOverrides = new Map(user.permissions.map((up) => [up.permission.code, up]))
    const rolePerms = new Set(user.role.rolePermissions.map((rp) => rp.permission.code))
    const deptPerms = new Map<string, string>()

    for (const d of user.departments) {
      for (const dp of d.department.permissions) {
        deptPerms.set(dp.permission.code, dp.scope)
      }
    }

    const result: EffectivePermission[] = []

    for (const p of allPermissions) {
      // 1. User Override (Explicit Deny hoặc Explicit Allow)
      if (userOverrides.has(p.code)) {
        const uo = userOverrides.get(p.code)!
        result.push({
          code: p.code,
          module: p.module as PermissionModule,
          action: p.action as PermissionAction,
          isGranted: uo.isGranted,
          scope: uo.scope as ResourceScope,
          origin: 'USER_OVERRIDE',
        })
        continue
      }

      // 2. Role Permission
      if (rolePerms.has(p.code)) {
        result.push({
          code: p.code,
          module: p.module as PermissionModule,
          action: p.action as PermissionAction,
          isGranted: true,
          scope: user.roleCode === 'MANAGER' ? 'DEPARTMENT' : 'ASSIGNED',
          origin: 'ROLE',
        })
        continue
      }

      // 3. Department Permission
      if (deptPerms.has(p.code)) {
        result.push({
          code: p.code,
          module: p.module as PermissionModule,
          action: p.action as PermissionAction,
          isGranted: true,
          scope: deptPerms.get(p.code)! as ResourceScope,
          origin: 'DEPARTMENT_POLICY',
        })
        continue
      }

      // Mặc định: không được cấp quyền
      result.push({
        code: p.code,
        module: p.module as PermissionModule,
        action: p.action as PermissionAction,
        isGranted: false,
        scope: 'DEPARTMENT',
        origin: 'ROLE',
      })
    }

    return result
  }
}
