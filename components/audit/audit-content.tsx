'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/labels'
import { AUDIT_ACTION_LABEL } from '@/lib/labels'
import type { AuditLog, User } from '@/lib/types'

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'warning' | 'info' | 'success' | 'outline'> = {
  view: 'secondary',
  download: 'info',
  edit: 'warning',
  delete: 'destructive',
  upload: 'success',
  share: 'outline',
  restore: 'default',
}

export function AuditContent({ logs, users }: { logs: AuditLog[]; users: User[] }) {
  const [search, setSearch] = useState('')

  const filtered = logs.filter((l) => {
    if (!search) return true
    const user = users.find((u) => u.id === l.userId)
    return (
      user?.name.toLowerCase().includes(search.toLowerCase()) ||
      l.documentId.toLowerCase().includes(search.toLowerCase()) ||
      l.ip.includes(search) ||
      l.device.toLowerCase().includes(search.toLowerCase())
    )
  })

  return (
    <div className="flex flex-col gap-4">
      <Input
        placeholder="Tìm theo tên, tài liệu, IP..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      <Card>
        <CardHeader>
          <CardTitle>Lịch sử truy cập</CardTitle>
          <CardDescription>{filtered.length} bản ghi · đầy đủ thông tin người dùng, thiết bị và địa chỉ IP</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead>Hành động</TableHead>
                  <TableHead>Chứng từ</TableHead>
                  <TableHead>Thiết bị</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Thời gian</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Không tìm thấy bản ghi
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((log) => {
                    const user = users.find((u) => u.id === log.userId)
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="size-7">
                              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">
                                {user?.initials ?? '??'}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">{user?.name ?? 'Không xác định'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={ACTION_VARIANT[log.action] ?? 'secondary'}>
                            {AUDIT_ACTION_LABEL[log.action]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-xs text-muted-foreground">{log.documentId}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{log.device}</TableCell>
                        <TableCell>
                          <span className="font-mono text-xs">{log.ip}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{formatDateTime(log.at)}</TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
