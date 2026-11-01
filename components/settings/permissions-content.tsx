'use client'

import { useEffect, useState } from 'react'
import {
  CheckIcon,
  XIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  BuildingIcon,
  SlidersIcon,
  InfoIcon,
  SaveIcon,
  SparklesIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useApp } from '@/components/app/app-provider'
import type { Department, PermissionMatrix, Role } from '@/lib/types'

const MODULES = [
  { id: 'DOCUMENTS', label: 'Chứng từ (Documents)', desc: 'Vận đơn, Hóa đơn, Packing List, Tờ khai HQ' },
  { id: 'SHIPMENTS', label: 'Lô hàng (Shipments)', desc: 'Hồ sơ lô hàng, tiến độ, phân công' },
  { id: 'USERS', label: 'Người dùng (Users)', desc: 'Tài khoản, khóa/mở khóa, chức danh' },
  { id: 'DEPARTMENTS', label: 'Phòng ban (Departments)', desc: 'Cơ cấu tổ chức, điều chuyển' },
  { id: 'AUDIT', label: 'Nhật ký kiểm toán (Audit)', desc: 'Lịch sử truy cập, tải file, sửa đổi' },
  { id: 'SETTINGS', label: 'Cài đặt hệ thống (Settings)', desc: 'Cấu hình tổ chức, bảo mật, kho lưu trữ' },
  { id: 'ARCHIVE', label: 'Kho vật lý (Archive)', desc: 'Thùng hồ sơ, vị trí kệ, kho lưu' },
]

const ACTIONS = [
  { code: 'VIEW', label: 'Xem' },
  { code: 'CREATE', label: 'Tạo' },
  { code: 'EDIT', label: 'Sửa' },
  { code: 'DELETE', label: 'Xóa' },
  { code: 'UPLOAD', label: 'Tải lên' },
  { code: 'DOWNLOAD', label: 'Tải xuống' },
  { code: 'SHARE', label: 'Chia sẻ' },
  { code: 'APPROVE', label: 'Phê duyệt' },
]

interface PermissionsData {
  departments: Department[]
  matrix: PermissionMatrix
  resources: { id: string; label: string }[]
}

export function PermissionsContent({ data }: { data: PermissionsData }) {
  const { currentUser, users } = useApp()
  const isAdmin = currentUser.role?.toLowerCase() === 'admin' || currentUser.role?.toLowerCase() === 'owner'

  const [activeTab, setActiveTab] = useState<'roles' | 'departments' | 'effective'>('roles')
  const [selectedRole, setSelectedRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF'>('MANAGER')
  const [selectedDept, setSelectedDept] = useState(data.departments[0]?.id ?? '')
  const [selectedUserId, setSelectedUserId] = useState(users[0]?.id ?? '')
  const [effectivePerms, setEffectivePerms] = useState<any[]>([])
  const [loadingEffective, setLoadingEffective] = useState(false)
  const [saving, setSaving] = useState(false)

  // Local state for role permission matrix
  const [roleMatrix, setRoleMatrix] = useState<Record<string, boolean>>({})

  // Fetch initial permissions from backend API
  const fetchPerms = async () => {
    try {
      const res = await fetch('/api/permissions')
      if (!res.ok) return
      const resData = await res.json()
      const newMap: Record<string, boolean> = {}
      for (const rp of resData.rolePermissions) {
        const role = resData.roles.find((r: any) => r.id === rp.roleId)
        const perm = resData.permissions.find((p: any) => p.id === rp.permissionId)
        if (role && perm) {
          newMap[`${role.code}:${perm.code}`] = true
        }
      }
      setRoleMatrix(newMap)
    } catch {
      // Fallback
    }
  }

  const fetchEffective = async (uid: string) => {
    setLoadingEffective(true)
    try {
      const res = await fetch(`/api/permissions/effective?userId=${uid}`)
      if (res.ok) {
        const json = await res.json()
        setEffectivePerms(json.effective ?? [])
      }
    } finally {
      setLoadingEffective(false)
    }
  }

  useEffect(() => {
    fetchPerms()
  }, [])

  useEffect(() => {
    if (activeTab === 'effective' && selectedUserId) {
      fetchEffective(selectedUserId)
    }
  }, [activeTab, selectedUserId])

  const toggleRolePermission = async (module: string, action: string) => {
    if (!isAdmin) {
      toast.error('Chỉ Quản trị viên (ADMIN) mới có quyền chỉnh sửa ma trận quyền.')
      return
    }

    const permCode = `${module}:${action}`
    const key = `${selectedRole}:${permCode}`
    const currentVal = !!roleMatrix[key]
    const nextVal = !currentVal

    // Optimistic UI update
    setRoleMatrix((prev) => ({ ...prev, [key]: nextVal }))

    try {
      setSaving(true)
      const rolesRes = await fetch('/api/permissions')
      const rolesData = await rolesRes.json()
      const targetRole = rolesData.roles?.find((r: any) => r.code === selectedRole)

      if (!targetRole) return

      const updateRes = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'ROLE',
          targetId: targetRole.id,
          permissionCode: permCode,
          isGranted: nextVal,
        }),
      })

      if (updateRes.ok) {
        toast.success(`Đã cập nhật ${permCode} cho vai trò ${selectedRole}`)
      } else {
        // Revert
        setRoleMatrix((prev) => ({ ...prev, [key]: currentVal }))
        toast.error('Lỗi khi lưu thay đổi vào cơ sở dữ liệu.')
      }
    } catch {
      setRoleMatrix((prev) => ({ ...prev, [key]: currentVal }))
      toast.error('Lỗi kết nối máy chủ.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Trung tâm Phân quyền Doanh nghiệp (Enterprise IAM)</h2>
          <p className="text-sm text-muted-foreground">
            Mô hình kết hợp <strong>RBAC + Department Access Control + Resource-Level Permissions</strong>
          </p>
        </div>
        {!isAdmin && (
          <Badge variant="outline" className="w-fit text-amber-600 border-amber-300">
            Chế độ Xem (Chỉ Admin mới có quyền sửa đổi)
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="roles">
            <ShieldCheckIcon className="mr-1.5 size-4" />
            Theo Vai trò (RBAC)
          </TabsTrigger>
          <TabsTrigger value="departments">
            <BuildingIcon className="mr-1.5 size-4" />
            Theo Phòng ban
          </TabsTrigger>
          <TabsTrigger value="effective">
            <UserCheckIcon className="mr-1.5 size-4" />
            Quyền Hiệu lực
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: MA TRẬN THEO VAI TRÒ */}
        <TabsContent value="roles" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Chọn vai trò cấu hình:</span>
            <Select value={selectedRole} onValueChange={(v) => v && setSelectedRole(v as any)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">ADMIN (Quản trị viên)</SelectItem>
                <SelectItem value="MANAGER">MANAGER (Quản lý phòng ban)</SelectItem>
                <SelectItem value="STAFF">STAFF (Nhân viên tác nghiệp)</SelectItem>
              </SelectContent>
            </Select>

            {selectedRole === 'ADMIN' && (
              <Badge variant="default" className="bg-red-600">
                ADMIN: Toàn quyền truy cập mọi phân hệ (GLOBAL Scope)
              </Badge>
            )}
            {selectedRole === 'MANAGER' && (
              <Badge variant="warning">
                MANAGER: Quản lý nhân sự và chứng từ trong phạm vi phòng ban được phân công
              </Badge>
            )}
            {selectedRole === 'STAFF' && (
              <Badge variant="secondary">
                STAFF: Chỉ thao tác trên chứng từ và lô hàng được phân công trực tiếp
              </Badge>
            )}
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Ma trận quyền theo hành động</CardTitle>
              <CardDescription>Bật/tắt quyền tương ứng. Mọi thay đổi đều được ghi lại trong Audit Log hệ thống.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-64 font-semibold">Phân hệ nghiệp vụ</TableHead>
                      {ACTIONS.map((act) => (
                        <TableHead key={act.code} className="text-center font-semibold">
                          {act.label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {MODULES.map((mod) => (
                      <TableRow key={mod.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{mod.label}</span>
                            <span className="text-xs text-muted-foreground">{mod.desc}</span>
                          </div>
                        </TableCell>
                        {ACTIONS.map((act) => {
                          const key = `${selectedRole}:${mod.id}:${act.code}`
                          const isAllowed = selectedRole === 'ADMIN' ? true : !!roleMatrix[key]

                          return (
                            <TableCell key={act.code} className="text-center">
                              {selectedRole === 'ADMIN' ? (
                                <CheckIcon className="mx-auto size-4 text-success" />
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleRolePermission(mod.id, act.code)}
                                  disabled={!isAdmin || saving}
                                  className={`mx-auto flex size-7 items-center justify-center rounded-md border transition-all ${
                                    isAllowed
                                      ? 'border-success/40 bg-success/15 text-success hover:bg-success/25'
                                      : 'border-border bg-muted/30 text-muted-foreground/40 hover:bg-muted'
                                  } ${!isAdmin && 'cursor-default'}`}
                                  title={`${act.label} ${mod.id}`}
                                >
                                  {isAllowed ? <CheckIcon className="size-4 stroke-[2.5]" /> : <XIcon className="size-3.5" />}
                                </button>
                              )}
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: THEO PHÒNG BAN */}
        <TabsContent value="departments" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Chọn phòng ban:</span>
            <Select value={selectedDept} onValueChange={(v) => v && setSelectedDept(v)}>
              <SelectTrigger className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {data.departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Chính sách dữ liệu phòng ban</CardTitle>
              <CardDescription>
                Chứng từ thuộc phòng ban này chỉ có thể được xem hoặc chỉnh sửa bởi nhân viên thuộc phòng, trừ khi được cấp quyền SHARE rõ ràng.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <InfoIcon className="mt-0.5 size-5 text-primary" />
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Chia sẻ liên phòng ban</span>
                    <span className="text-muted-foreground">
                      Ví dụ: Hóa đơn (Invoice) của Lô hàng Hàng xuất được chia sẻ quyền VIEW cho Phòng Kế toán.
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border p-4">
                  <ShieldCheckIcon className="mt-0.5 size-5 text-success" />
                  <div className="flex flex-col gap-1 text-sm">
                    <span className="font-semibold">Ngăn chặn leo thang quyền</span>
                    <span className="text-muted-foreground">
                      Manager phòng ban không thể tự cấp quyền Admin hoặc xem chứng từ của phòng ban khác ngoài phạm vi.
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: XEM TRƯỚC QUYỀN HIỆU LỰC CỦA NGƯỜI DÙNG */}
        <TabsContent value="effective" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Chọn người dùng kiểm tra:</span>
            <Select value={selectedUserId} onValueChange={(v) => v && setSelectedUserId(v)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.role?.toUpperCase()})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => fetchEffective(selectedUserId)} disabled={loadingEffective}>
              {loadingEffective ? 'Đang phân tích...' : 'Làm mới phân tích'}
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quyền hiệu lực thực tế (Effective Permissions)</CardTitle>
              <CardDescription>
                Kết quả giải quyết sau khi kết hợp Role, Phòng ban, User Overrides và Quy tắc Explicit Deny.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEffective ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Đang tính toán quyền hiệu lực từ Database...</div>
              ) : effectivePerms.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">Không tìm thấy bản ghi quyền hiệu lực.</div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background">
                      <TableRow>
                        <TableHead>Mã quyền</TableHead>
                        <TableHead>Phân hệ</TableHead>
                        <TableHead>Hành động</TableHead>
                        <TableHead className="text-center">Trạng thái</TableHead>
                        <TableHead>Phạm vi (Scope)</TableHead>
                        <TableHead>Nguồn gốc cấp quyền</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {effectivePerms.map((ep) => (
                        <TableRow key={ep.code}>
                          <TableCell className="font-mono text-xs font-semibold">{ep.code}</TableCell>
                          <TableCell>{ep.module}</TableCell>
                          <TableCell>{ep.action}</TableCell>
                          <TableCell className="text-center">
                            {ep.isGranted ? (
                              <Badge variant="default" className="bg-success text-success-foreground">
                                Cho phép (ALLOW)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground/60 border-border">
                                Từ chối (DENY)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {ep.scope}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground">
                              {ep.origin === 'ADMIN_BYPASS' && '⚡ Quản trị viên tối cao'}
                              {ep.origin === 'ROLE' && '🛡️ Mặc định theo Vai trò'}
                              {ep.origin === 'USER_OVERRIDE' && '👤 Gán riêng cho Tài khoản'}
                              {ep.origin === 'DEPARTMENT_POLICY' && '🏢 Chính sách Phòng ban'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
