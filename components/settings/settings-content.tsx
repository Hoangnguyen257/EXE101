'use client'

import { BuildingIcon, GitBranchIcon, UsersIcon, BriefcaseIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ROLE_LABEL } from '@/lib/labels'
import { formatDate } from '@/lib/labels'
import type { Branch, Department, Organization, User } from '@/lib/types'

interface SettingsData {
  organization: Organization
  branches: Branch[]
  departments: Department[]
  users: User[]
}

const ROLE_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive' | 'warning' | 'info' | 'success'> = {
  owner: 'destructive',
  manager: 'warning',
  team_lead: 'info',
  staff: 'secondary',
  viewer: 'outline',
}

export function SettingsContent({ data }: { data: SettingsData }) {
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
          Phòng ban ({data.departments.length})
        </TabsTrigger>
        <TabsTrigger value="users">
          <UsersIcon className="mr-1.5 size-4" />
          Người dùng ({data.users.length})
        </TabsTrigger>
      </TabsList>

      {/* Organization Tab */}
      <TabsContent value="org" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Thông tin tổ chức</CardTitle>
            <CardDescription>Thông tin cơ bản và gói dịch vụ</CardDescription>
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
                  <span className="text-xs text-muted-foreground">Địa chỉ</span>
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.departments.map((dept) => (
            <Card key={dept.id}>
              <CardHeader>
                <CardTitle className="text-base">{dept.name}</CardTitle>
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
          <CardHeader>
            <CardTitle>Danh sách người dùng</CardTitle>
            <CardDescription>{data.users.filter((u) => u.active).length} đang hoạt động</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y">
              {data.users.map((user) => (
                <li key={user.id} className="flex items-center gap-3 py-3">
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                      {user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{user.name}</span>
                      {!user.active && (
                        <Badge variant="outline" className="text-xs">Không hoạt động</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{user.email}</span>
                  </div>
                  <Badge variant={ROLE_VARIANT[user.role] ?? 'secondary'}>{ROLE_LABEL[user.role]}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
