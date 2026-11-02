'use client'

import { useState } from 'react'
import {
  BuildingIcon,
  GitBranchIcon,
  UsersIcon,
  BriefcaseIcon,
  ArchiveIcon,
  PlusIcon,
  MoreVerticalIcon,
  LockIcon,
  UnlockIcon,
  KeyRoundIcon,
  LinkIcon,
  EditIcon,
  Trash2Icon,
  CopyIcon,
  CheckIcon,
  AlertTriangleIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABEL, formatDate } from '@/lib/labels'
import type { Branch, Department, Organization } from '@/lib/types'

interface SettingUser {
  id: string
  orgId: string
  name: string
  email: string
  role: string
  roleCode?: string
  departmentId?: string
  departmentName?: string
  positionId?: string
  positionName?: string
  isManager?: boolean
  branchId?: string
  initials: string
  active: boolean
  mustChangePassword?: boolean
  lastActive: string
}

interface SettingPosition {
  id: string
  name: string
  level: number
  description?: string | null
}

interface SettingArchiveBox {
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
}

interface SettingsData {
  organization: Organization
  branches: Branch[]
  departments: (Department & { code?: string })[]
  users: SettingUser[]
  positions?: SettingPosition[]
  archiveBoxes?: SettingArchiveBox[]
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'warning' | 'info' | 'success'> = {
  admin: 'destructive',
  owner: 'destructive',
  manager: 'warning',
  team_lead: 'info',
  staff: 'secondary',
  viewer: 'outline',
}

export function SettingsContent({ data }: { data: SettingsData }) {
  const [users, setUsers] = useState<SettingUser[]>(data.users)
  const [departments, setDepartments] = useState<(Department & { code?: string })[]>(data.departments)
  const [archiveBoxes, setArchiveBoxes] = useState<SettingArchiveBox[]>(data.archiveBoxes || [])
  const positions = data.positions || []

  // Create User Dialog State
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [createEmail, setCreateEmail] = useState('')
  const [createName, setCreateName] = useState('')
  const [createRole, setCreateRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF'>('STAFF')
  const [createDeptId, setCreateDeptId] = useState(departments[0]?.id || '')
  const [createPosId, setCreatePosId] = useState('')
  const [createIsManager, setCreateIsManager] = useState(false)
  const [creatingUser, setCreatingUser] = useState(false)

  // Edit User Dialog State
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'ADMIN' | 'MANAGER' | 'STAFF'>('STAFF')
  const [editDeptId, setEditDeptId] = useState('')
  const [editPosId, setEditPosId] = useState('')
  const [editIsManager, setEditIsManager] = useState(false)
  const [updatingUser, setUpdatingUser] = useState(false)

  // One-time Password Modal
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false)
  const [generatedPassword, setGeneratedPassword] = useState('')
  const [passwordModalTitle, setPasswordModalTitle] = useState('')
  const [passwordModalDesc, setPasswordModalDesc] = useState('')
  const [copied, setCopied] = useState(false)

  // Reset Token Link Modal
  const [isResetLinkModalOpen, setIsResetLinkModalOpen] = useState(false)
  const [generatedResetUrl, setGeneratedResetUrl] = useState('')
  const [linkCopied, setLinkCopied] = useState(false)

  // Department Dialog State
  const [isCreateDeptOpen, setIsCreateDeptOpen] = useState(false)
  const [deptCode, setDeptCode] = useState('')
  const [deptName, setDeptName] = useState('')
  const [deptHeadId, setDeptHeadId] = useState('')
  const [creatingDept, setCreatingDept] = useState(false)

  // Archive Box Dialog State
  const [isCreateBoxOpen, setIsCreateBoxOpen] = useState(false)
  const [boxCode, setBoxCode] = useState('')
  const [boxWarehouse, setBoxWarehouse] = useState('Kho Tổng Cát Lái')
  const [boxShelf, setBoxShelf] = useState('')
  const [boxPosition, setBoxPosition] = useState('')
  const [boxPeriod, setBoxPeriod] = useState('2026')
  const [creatingBox, setCreatingBox] = useState(false)

  // --------------------------------------------------------------------------
  // USER HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createEmail || !createName) {
      toast.error('Vui lòng nhập đầy đủ email và họ tên.')
      return
    }

    setCreatingUser(true)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createEmail,
          name: createName,
          roleCode: createRole,
          departmentId: createDeptId || null,
          positionId: createPosId || null,
          isManager: createIsManager,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        toast.error('Tạo người dùng thất bại', { description: result.error })
        setCreatingUser(false)
        return
      }

      // Cập nhật danh sách hiển thị
      const newUser: SettingUser = {
        id: result.user.id,
        orgId: data.organization.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.roleCode.toLowerCase(),
        roleCode: result.user.roleCode,
        departmentId: createDeptId,
        departmentName: departments.find((d) => d.id === createDeptId)?.name || 'Chưa gán',
        initials: result.user.name.substring(0, 2).toUpperCase(),
        active: true,
        mustChangePassword: true,
        lastActive: new Date().toISOString(),
      }
      setUsers([newUser, ...users])

      setIsCreateUserOpen(false)
      setCreateEmail('')
      setCreateName('')
      setCreateRole('STAFF')
      setCreateIsManager(false)

      // Hiển thị mật khẩu tạm thời một lần
      setGeneratedPassword(result.temporaryPassword)
      setPasswordModalTitle('Mật khẩu khởi tạo tạm thời')
      setPasswordModalDesc(`Tài khoản ${result.user.email} đã được tạo thành công. Vui lòng sao chép và gửi mật khẩu này cho nhân viên. Mật khẩu chỉ hiển thị một lần tại đây.`)
      setIsPasswordModalOpen(true)
      toast.success('Tạo tài khoản thành công!')
    } catch {
      toast.error('Lỗi kết nối khi tạo tài khoản.')
    } finally {
      setCreatingUser(false)
    }
  }

  const openEditUser = (user: SettingUser) => {
    setEditingUserId(user.id)
    setEditName(user.name)
    setEditRole((user.roleCode?.toUpperCase() || user.role.toUpperCase()) as any)
    setEditDeptId(user.departmentId || '')
    setEditPosId(user.positionId || '')
    setEditIsManager(Boolean(user.isManager))
    setIsEditUserOpen(true)
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUserId) return

    setUpdatingUser(true)
    try {
      const res = await fetch(`/api/users/${editingUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName,
          roleCode: editRole,
          departmentId: editDeptId || null,
          positionId: editPosId || null,
          isManager: editIsManager,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        toast.error('Cập nhật thất bại', { description: result.error })
        setUpdatingUser(false)
        return
      }

      setUsers(
        users.map((u) =>
          u.id === editingUserId
            ? {
                ...u,
                name: editName,
                role: editRole.toLowerCase(),
                roleCode: editRole,
                departmentId: editDeptId,
                departmentName: departments.find((d) => d.id === editDeptId)?.name || 'Chưa gán',
                isManager: editIsManager,
              }
            : u
        )
      )

      setIsEditUserOpen(false)
      toast.success('Cập nhật thông tin người dùng thành công.')
    } catch {
      toast.error('Lỗi kết nối khi cập nhật người dùng.')
    } finally {
      setUpdatingUser(false)
    }
  }

  const handleToggleUserStatus = async (user: SettingUser) => {
    const nextStatus = !user.active
    const actionText = nextStatus ? 'mở khóa' : 'khóa / vô hiệu hóa'

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextStatus }),
      })

      const result = await res.json()
      if (!res.ok) {
        toast.error(`Không thể ${actionText} tài khoản`, { description: result.error })
        return
      }

      setUsers(users.map((u) => (u.id === user.id ? { ...u, active: nextStatus } : u)))
      if (!nextStatus) {
        toast.success(`Đã vô hiệu hóa tài khoản ${user.name}. Mọi phiên đăng nhập đang mở đã bị thu hồi ngay lập tức.`)
      } else {
        toast.success(`Đã mở khóa tài khoản ${user.name} thành công.`)
      }
    } catch {
      toast.error(`Lỗi kết nối khi ${actionText} tài khoản.`)
    }
  }

  const handleResetTempPassword = async (user: SettingUser) => {
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'temp_password' }),
      })

      const result = await res.json()
      if (!res.ok) {
        toast.error('Cấp mật khẩu tạm thất bại', { description: result.error })
        return
      }

      setGeneratedPassword(result.temporaryPassword)
      setPasswordModalTitle('Mật khẩu tạm thời mới')
      setPasswordModalDesc(`Đã cấp mật khẩu tạm mới cho tài khoản ${user.email}. Người dùng sẽ bắt buộc đổi mật khẩu ở lần đăng nhập tiếp theo.`)
      setIsPasswordModalOpen(true)
      toast.success('Đã cấp mật khẩu tạm mới.')
    } catch {
      toast.error('Lỗi khi cấp mật khẩu tạm thời.')
    }
  }

  const handleGenerateResetLink = async (user: SettingUser) => {
    try {
      const res = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'reset_token' }),
      })

      const result = await res.json()
      if (!res.ok) {
        toast.error('Tạo liên kết thất bại', { description: result.error })
        return
      }

      const fullUrl = window.location.origin + result.resetUrl
      setGeneratedResetUrl(fullUrl)
      setIsResetLinkModalOpen(true)
      toast.success('Đã tạo liên kết đặt lại mật khẩu.')
    } catch {
      toast.error('Lỗi kết nối khi tạo liên kết.')
    }
  }

  // --------------------------------------------------------------------------
  // DEPARTMENT HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateDepartment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!deptCode || !deptName) {
      toast.error('Vui lòng nhập mã và tên phòng ban.')
      return
    }

    setCreatingDept(true)
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: deptCode,
          name: deptName,
          headUserId: deptHeadId || null,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        toast.error('Tạo phòng ban thất bại', { description: result.error })
        setCreatingDept(false)
        return
      }

      const newDept = {
        id: result.department.id,
        orgId: data.organization.id,
        name: result.department.name,
        code: result.department.code,
        head: users.find((u) => u.id === deptHeadId)?.name || 'Chưa phân công',
        userCount: 0,
      }

      setDepartments([...departments, newDept])
      setIsCreateDeptOpen(false)
      setDeptCode('')
      setDeptName('')
      setDeptHeadId('')
      toast.success('Tạo phòng ban mới thành công.')
    } catch {
      toast.error('Lỗi kết nối khi tạo phòng ban.')
    } finally {
      setCreatingDept(false)
    }
  }

  const handleDeleteDepartment = async (deptId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa phòng ban này?')) return

    try {
      const res = await fetch(`/api/departments/${deptId}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) {
        toast.error('Xóa phòng ban thất bại', { description: result.error })
        return
      }

      setDepartments(departments.filter((d) => d.id !== deptId))
      toast.success('Xóa phòng ban thành công.')
    } catch {
      toast.error('Lỗi kết nối khi xóa phòng ban.')
    }
  }

  // --------------------------------------------------------------------------
  // ARCHIVE BOX HANDLERS
  // --------------------------------------------------------------------------
  const handleCreateArchiveBox = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!boxCode || !boxWarehouse || !boxShelf || !boxPosition) {
      toast.error('Vui lòng điền đầy đủ thông tin thùng lưu trữ.')
      return
    }

    setCreatingBox(true)
    try {
      const res = await fetch('/api/archive-boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: boxCode,
          warehouse: boxWarehouse,
          shelf: boxShelf,
          box: boxPosition,
          period: boxPeriod,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        toast.error('Tạo thùng lưu trữ thất bại', { description: result.error })
        setCreatingBox(false)
        return
      }

      const newBox: SettingArchiveBox = {
        id: result.box.id,
        orgId: data.organization.id,
        code: result.box.code,
        warehouse: result.box.warehouse,
        shelf: result.box.shelf,
        box: result.box.box,
        period: result.box.period,
        documentIds: [],
        createdAt: result.box.createdAt,
      }

      setArchiveBoxes([newBox, ...archiveBoxes])
      setIsCreateBoxOpen(false)
      setBoxCode('')
      setBoxShelf('')
      setBoxPosition('')
      toast.success('Tạo thùng lưu trữ vật lý thành công.')
    } catch {
      toast.error('Lỗi kết nối khi tạo thùng lưu trữ.')
    } finally {
      setCreatingBox(false)
    }
  }

  const handleDeleteArchiveBox = async (boxId: string) => {
    if (!confirm('Bạn có chắc muốn xóa thùng lưu trữ này?')) return

    try {
      const res = await fetch(`/api/archive-boxes/${boxId}`, { method: 'DELETE' })
      const result = await res.json()
      if (!res.ok) {
        toast.error('Không thể xóa thùng lưu trữ', { description: result.error })
        return
      }

      setArchiveBoxes(archiveBoxes.filter((b) => b.id !== boxId))
      toast.success('Đã xóa thùng lưu trữ thành công.')
    } catch {
      toast.error('Lỗi kết nối khi xóa thùng lưu trữ.')
    }
  }

  return (
    <Tabs defaultValue="org">
      <TabsList>
        <TabsTrigger value="org">
          <BuildingIcon className="mr-1.5 size-4" />
          Tổ chức
        </TabsTrigger>
        <TabsTrigger value="branches">
          <GitBranchIcon className="mr-1.5 size-4" />
          Chi nhánh ({data.branches.length})
        </TabsTrigger>
        <TabsTrigger value="departments">
          <BriefcaseIcon className="mr-1.5 size-4" />
          Phòng ban ({departments.length})
        </TabsTrigger>
        <TabsTrigger value="users">
          <UsersIcon className="mr-1.5 size-4" />
          Người dùng ({users.length})
        </TabsTrigger>
        <TabsTrigger value="archive">
          <ArchiveIcon className="mr-1.5 size-4" />
          Kho vật lý ({archiveBoxes.length})
        </TabsTrigger>
      </TabsList>

      {/* Organization Tab */}
      <TabsContent value="org" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin tổ chức</CardTitle>
            <CardDescription>Thông tin cơ bản và gói dịch vụ doanh nghiệp</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Tên tổ chức</span>
                  <span className="font-medium">{data.organization.name}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Mã số thuế</span>
                  <span className="font-mono font-medium">{data.organization.taxCode}</span>
                </div>
              </div>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Địa chỉ trụ sở</span>
                  <span className="font-medium">{data.organization.address}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Gói dịch vụ</span>
                  <Badge variant="info" className="w-fit">{data.organization.plan}</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Branches Tab */}
      <TabsContent value="branches" className="mt-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.branches.map((branch) => (
            <Card key={branch.id}>
              <CardHeader>
                <CardTitle className="text-base">{branch.name}</CardTitle>
                <CardDescription>{branch.city}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2 text-sm">
                <p className="text-muted-foreground">{branch.address}</p>
                <Badge variant="secondary" className="w-fit">{branch.userCount} người dùng</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      {/* Departments Tab */}
      <TabsContent value="departments" className="mt-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Quản lý phòng ban</h3>
            <p className="text-sm text-muted-foreground">Thiết lập cơ cấu phòng ban và trưởng bộ phận</p>
          </div>
          <Button onClick={() => setIsCreateDeptOpen(true)}>
            <PlusIcon className="mr-1.5 size-4" />
            Thêm phòng ban mới
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((dept) => (
            <Card key={dept.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="font-mono">{dept.code || 'DEPT'}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteDepartment(dept.id)}
                    title="Xóa phòng ban"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
                <CardTitle className="text-base mt-2">{dept.name}</CardTitle>
                <CardDescription>Trưởng phòng: {dept.head}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">{dept.userCount} nhân viên</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      {/* Users Tab */}
      <TabsContent value="users" className="mt-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Danh sách người dùng</CardTitle>
              <CardDescription>
                {users.filter((u) => u.active).length} đang hoạt động · {users.length} tổng tài khoản
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateUserOpen(true)}>
              <PlusIcon className="mr-1.5 size-4" />
              Thêm tài khoản nhân viên
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {users.map((user) => {
                const roleKey = user.roleCode?.toLowerCase() || user.role.toLowerCase()
                return (
                  <li key={user.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Avatar className="size-9">
                        <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                          {user.initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex min-w-0 flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{user.name}</span>
                          {!user.active ? (
                            <Badge variant="destructive" className="text-xs">
                              Đã khóa
                            </Badge>
                          ) : user.mustChangePassword ? (
                            <Badge variant="outline" className="text-xs text-warning border-warning">
                              Chờ đổi MK
                            </Badge>
                          ) : null}
                        </div>
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                        <span className="text-xs text-muted-foreground">
                          {user.departmentName ? `Phòng: ${user.departmentName}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant={ROLE_VARIANT[roleKey] ?? 'secondary'}>
                        {(ROLE_LABEL as Record<string, string>)[roleKey] || user.roleCode || user.role}
                      </Badge>

                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="size-8 p-0" />}>
                          <MoreVerticalIcon className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openEditUser(user)}>
                            <EditIcon className="mr-2 size-4" />
                            Chỉnh sửa thông tin
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                            {user.active ? (
                              <>
                                <LockIcon className="mr-2 size-4 text-destructive" />
                                <span className="text-destructive">Khóa tài khoản</span>
                              </>
                            ) : (
                              <>
                                <UnlockIcon className="mr-2 size-4 text-success" />
                                <span className="text-success">Mở khóa tài khoản</span>
                              </>
                            )}
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem onClick={() => handleResetTempPassword(user)}>
                            <KeyRoundIcon className="mr-2 size-4 text-warning" />
                            Cấp mật khẩu tạm mới
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => handleGenerateResetLink(user)}>
                            <LinkIcon className="mr-2 size-4" />
                            Tạo link đặt lại mật khẩu
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Archive Boxes Tab */}
      <TabsContent value="archive" className="mt-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Quản lý thùng lưu trữ vật lý (ArchiveBox)</h3>
            <p className="text-sm text-muted-foreground">
              Quản lý vị trí lưu trữ hồ sơ chứng từ giấy theo kho, kệ và ô lưu trữ
            </p>
          </div>
          <Button onClick={() => setIsCreateBoxOpen(true)}>
            <PlusIcon className="mr-1.5 size-4" />
            Thêm thùng lưu trữ mới
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {archiveBoxes.map((box) => (
            <Card key={box.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArchiveIcon className="size-4 text-primary" />
                    <span className="font-mono font-semibold text-sm">{box.code}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteArchiveBox(box.id)}
                    title="Xóa thùng"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
                <CardTitle className="text-sm font-medium mt-1">{box.warehouse}</CardTitle>
                <CardDescription>
                  Vị trí: Kệ {box.shelf} — Hộp {box.box}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <Badge variant="secondary">Niên độ {box.period}</Badge>
                <span>{box.documentIds.length} chứng từ đã lưu</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </TabsContent>

      {/* -------------------------------------------------------------------- */}
      {/* DIALOG: TẠO NGƯỜI DÙNG MỚI */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm tài khoản người dùng mới</DialogTitle>
            <DialogDescription>
              Hệ thống sẽ sinh một mật khẩu tạm thời ngẫu nhiên. Nhân viên bắt buộc phải đổi mật khẩu ở lần đăng nhập đầu tiên.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email công vụ</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="ten.nhanvien@tml.vn"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-name">Họ và tên</Label>
              <Input
                id="create-name"
                placeholder="Nguyễn Văn A"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-role">Vai trò (Role)</Label>
              <select
                id="create-role"
                value={createRole}
                onChange={(e) => setCreateRole(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="STAFF">STAFF (Chuyên viên tác nghiệp)</option>
                <option value="MANAGER">MANAGER (Quản lý phòng ban)</option>
                <option value="ADMIN">ADMIN (Quản trị viên toàn hệ thống)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-dept">Phòng ban trực thuộc</Label>
              <select
                id="create-dept"
                value={createDeptId}
                onChange={(e) => setCreateDeptId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">-- Chưa gán phòng ban --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code || 'DEPT'})
                  </option>
                ))}
              </select>
            </div>

            {positions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="create-pos">Chức danh</Label>
                <select
                  id="create-pos"
                  value={createPosId}
                  onChange={(e) => setCreatePosId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">-- Chưa gán chức danh --</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Cấp độ {p.level})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="create-is-mgr"
                checked={createIsManager}
                onCheckedChange={(checked) => setCreateIsManager(Boolean(checked))}
              />
              <Label htmlFor="create-is-mgr" className="text-sm font-normal">
                Là lãnh đạo / phụ trách phòng ban (Department Manager)
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateUserOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={creatingUser}>
                {creatingUser ? 'Đang tạo...' : 'Tạo tài khoản'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* DIALOG: CHỈNH SỬA NGƯỜI DÙNG */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa thông tin tài khoản</DialogTitle>
            <DialogDescription>
              Cập nhật vai trò, phòng ban hoặc chức danh cho nhân sự.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateUser} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Họ và tên</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-role">Vai trò (Role)</Label>
              <select
                id="edit-role"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as any)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="STAFF">STAFF (Chuyên viên tác nghiệp)</option>
                <option value="MANAGER">MANAGER (Quản lý phòng ban)</option>
                <option value="ADMIN">ADMIN (Quản trị viên toàn hệ thống)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-dept">Phòng ban</Label>
              <select
                id="edit-dept"
                value={editDeptId}
                onChange={(e) => setEditDeptId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="">-- Chưa gán phòng ban --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code || 'DEPT'})
                  </option>
                ))}
              </select>
            </div>

            {positions.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="edit-pos">Chức danh</Label>
                <select
                  id="edit-pos"
                  value={editPosId}
                  onChange={(e) => setEditPosId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
                >
                  <option value="">-- Chưa gán chức danh --</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Cấp độ {p.level})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="edit-is-mgr"
                checked={editIsManager}
                onCheckedChange={(checked) => setEditIsManager(Boolean(checked))}
              />
              <Label htmlFor="edit-is-mgr" className="text-sm font-normal">
                Là lãnh đạo / phụ trách phòng ban
              </Label>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsEditUserOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={updatingUser}>
                {updatingUser ? 'Đang lưu...' : 'Lưu thay đổi'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: MẬT KHẨU TẠM THỜI HIỂN THỊ MỘT LẦN */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-warning/10 text-warning">
              <AlertTriangleIcon className="size-5" />
            </div>
            <DialogTitle className="text-center">{passwordModalTitle}</DialogTitle>
            <DialogDescription className="text-center">{passwordModalDesc}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label>Mật khẩu tạm thời:</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={generatedPassword}
                className="font-mono text-base font-bold bg-muted text-center tracking-wider"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 2000)
                  toast.success('Đã sao chép mật khẩu vào clipboard!')
                }}
                title="Sao chép"
              >
                {copied ? <CheckIcon className="size-4 text-success" /> : <CopyIcon className="size-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Lưu ý: Mật khẩu này sẽ bị ẩn sau khi đóng cửa sổ này.
            </p>
          </div>

          <DialogFooter>
            <Button className="w-full" onClick={() => setIsPasswordModalOpen(false)}>
              Tôi đã lưu lại mật khẩu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* MODAL: LIÊN KẾT ĐẶT LẠI MẬT KHẨU */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={isResetLinkModalOpen} onOpenChange={setIsResetLinkModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LinkIcon className="size-5" />
            </div>
            <DialogTitle className="text-center">Liên kết đặt lại mật khẩu</DialogTitle>
            <DialogDescription className="text-center">
              Gửi liên kết dùng một lần này cho nhân viên để họ tự đặt lại mật khẩu của mình (Hiệu lực 24 giờ).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2">
              <Input readOnly value={generatedResetUrl} className="font-mono text-xs bg-muted" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(generatedResetUrl)
                  setLinkCopied(true)
                  setTimeout(() => setLinkCopied(false), 2000)
                  toast.success('Đã sao chép liên kết vào clipboard!')
                }}
                title="Sao chép"
              >
                {linkCopied ? <CheckIcon className="size-4 text-success" /> : <CopyIcon className="size-4" />}
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button className="w-full" onClick={() => setIsResetLinkModalOpen(false)}>
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* DIALOG: TẠO PHÒNG BAN MỚI */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={isCreateDeptOpen} onOpenChange={setIsCreateDeptOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm phòng ban mới</DialogTitle>
            <DialogDescription>
              Thiết lập phòng ban để phân bổ công việc chứng từ và lô hàng.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateDepartment} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="dept-code">Mã phòng ban (Viết hoa)</Label>
              <Input
                id="dept-code"
                placeholder="VD: OPS, CUS, FIN..."
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-name">Tên phòng ban</Label>
              <Input
                id="dept-name"
                placeholder="VD: Phòng Hiện trường & Khai thác"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dept-head">Trưởng phòng</Label>
              <select
                id="dept-head"
                value={deptHeadId}
                onChange={(e) => setDeptHeadId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm"
              >
                <option value="">-- Chưa chỉ định trưởng phòng --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateDeptOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={creatingDept}>
                {creatingDept ? 'Đang tạo...' : 'Tạo phòng ban'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* -------------------------------------------------------------------- */}
      {/* DIALOG: TẠO THÙNG LƯU TRỮ MỚI */}
      {/* -------------------------------------------------------------------- */}
      <Dialog open={isCreateBoxOpen} onOpenChange={setIsCreateBoxOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm thùng lưu trữ vật lý mới</DialogTitle>
            <DialogDescription>
              Quản lý vị trí bản cứng hồ sơ chứng từ trong kho bãi vật lý.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateArchiveBox} className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="box-code">Mã thùng (Code)</Label>
              <Input
                id="box-code"
                placeholder="VD: BOX-2026-EXP-01"
                value={boxCode}
                onChange={(e) => setBoxCode(e.target.value.toUpperCase())}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="box-wh">Kho lưu trữ</Label>
              <Input
                id="box-wh"
                placeholder="VD: Kho Cát Lái, Kho Tân Bình..."
                value={boxWarehouse}
                onChange={(e) => setBoxWarehouse(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="box-shelf">Kệ lưu trữ (Shelf)</Label>
                <Input
                  id="box-shelf"
                  placeholder="VD: Kệ A-12"
                  value={boxShelf}
                  onChange={(e) => setBoxShelf(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="box-pos">Ô / Hộp (Box pos)</Label>
                <Input
                  id="box-pos"
                  placeholder="VD: Ô 04"
                  value={boxPosition}
                  onChange={(e) => setBoxPosition(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="box-period">Niên độ / Kỳ lưu trữ</Label>
              <Input
                id="box-period"
                placeholder="VD: 2026"
                value={boxPeriod}
                onChange={(e) => setBoxPeriod(e.target.value)}
                required
              />
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateBoxOpen(false)}>
                Hủy
              </Button>
              <Button type="submit" disabled={creatingBox}>
                {creatingBox ? 'Đang tạo...' : 'Tạo thùng lưu trữ'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Tabs>
  )
}
