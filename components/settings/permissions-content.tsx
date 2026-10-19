'use client'

import { CheckIcon, XIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'
import { ACTION_LABEL, ROLE_LABEL } from '@/lib/labels'
import type { Department, PermissionMatrix, Role } from '@/lib/types'

const RESOURCES = [
  { id: 'documents', label: 'Chứng từ' },
  { id: 'shipments', label: 'Lô hàng' },
  { id: 'archive', label: 'Lưu trữ vật lý' },
  { id: 'audit', label: 'Nhật ký truy cập' },
  { id: 'settings', label: 'Cài đặt tổ chức' },
]

const ROLES: Role[] = ['owner', 'manager', 'team_lead', 'staff', 'viewer']
const ACTIONS = ['view', 'edit', 'download', 'delete'] as const

interface PermissionsData {
  departments: Department[]
  matrix: PermissionMatrix
  resources: { id: string; label: string }[]
}

export function PermissionsContent({ data }: { data: PermissionsData }) {
  const [selectedDept, setSelectedDept] = useState(data.departments[0]?.id ?? '')

  const dept = data.departments.find((d) => d.id === selectedDept)
  const deptMatrix = data.matrix[selectedDept]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <label htmlFor="dept-select" className="text-sm font-medium">Phòng ban:</label>
        <Select value={selectedDept} onValueChange={(v) => v && setSelectedDept(v)}>
          <SelectTrigger id="dept-select" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {data.departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {dept && (
          <Badge variant="secondary">{dept.userCount} nhân viên · Trưởng phòng: {dept.head}</Badge>
        )}
      </div>

      {RESOURCES.map((resource) => (
        <Card key={resource.id}>
          <CardHeader>
            <CardTitle className="text-base">{resource.label}</CardTitle>
            <CardDescription>Quyền truy cập theo vai trò</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">Hành động</TableHead>
                    {ROLES.map((role) => (
                      <TableHead key={role} className="text-center">
                        {ROLE_LABEL[role]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ACTIONS.map((action) => (
                    <TableRow key={action}>
                      <TableCell className="font-medium">{ACTION_LABEL[action]}</TableCell>
                      {ROLES.map((role) => {
                        const allowed = deptMatrix?.[resource.id]?.[role]?.[action] ?? false
                        return (
                          <TableCell key={role} className="text-center">
                            {allowed ? (
                              <CheckIcon className="mx-auto size-4 text-success" />
                            ) : (
                              <XIcon className="mx-auto size-4 text-muted-foreground/40" />
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
      ))}
    </div>
  )
}
