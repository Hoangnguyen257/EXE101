'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ActivityIcon,
  BotIcon,
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FilterIcon,
  PackageIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  UserIcon,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatAuditTimestamp, formatRelative, AUDIT_ACTION_LABEL } from '@/lib/labels'
import type { User } from '@/lib/types'

export interface AuditItem {
  id: string
  userId: string
  userName?: string
  userInitials?: string
  userRole?: string
  isSystem?: boolean
  action: string
  resourceType?: string
  resourceId: string
  resourceName?: string
  resourceLink?: string | null
  documentId: string
  ip: string
  device: string
  at: string
}

const ACTION_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'warning' | 'info' | 'success' | 'outline'> = {
  view: 'secondary',
  download: 'info',
  edit: 'warning',
  update: 'warning',
  delete: 'destructive',
  upload: 'success',
  create: 'success',
  share: 'outline',
  login: 'info',
  logout: 'secondary',
  restore: 'default',
  permission_change: 'warning',
  share_expired_auto_revoked: 'outline',
}

export function AuditContent({ logs: initialLogs, users }: { logs: any[]; users: User[] }) {
  const [logs, setLogs] = useState<AuditItem[]>(initialLogs)
  const [search, setSearch] = useState('')
  const [selectedAction, setSelectedAction] = useState('all')
  const [selectedUser, setSelectedUser] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 25
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Polling near-realtime (mỗi 8 giây một lần) để cập nhật các hoạt động mới nhất
  const fetchLatestLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/audit?page=1&limit=50')
      if (res.ok) {
        const json = await res.json()
        if (json.data && Array.isArray(json.data)) {
          setLogs((prev) => {
            const existingIds = new Set(prev.map((l) => l.id))
            const newItems = json.data.filter((l: AuditItem) => !existingIds.has(l.id))
            if (newItems.length > 0) {
              return [...newItems, ...prev]
            }
            return prev
          })
          setLastUpdated(new Date())
        }
      }
    } catch (err) {
      console.warn('Lỗi polling audit logs:', err)
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      fetchLatestLogs()
    }, 8000)

    return () => clearInterval(timer)
  }, [fetchLatestLogs])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    await fetchLatestLogs()
    setIsRefreshing(false)
  }

  // Bộ lọc dữ liệu
  const filtered = logs.filter((log) => {
    if (selectedAction !== 'all' && log.action !== selectedAction) return false
    if (selectedUser !== 'all') {
      if (selectedUser === 'system' && !log.isSystem && log.userId !== 'system') return false
      if (selectedUser !== 'system' && log.userId !== selectedUser) return false
    }

    if (!search.trim()) return true
    const term = search.toLowerCase()
    const targetUser = users.find((u) => u.id === log.userId)
    const nameMatch = (log.userName || targetUser?.name || '').toLowerCase().includes(term)
    const resourceMatch = (log.resourceName || log.documentId || '').toLowerCase().includes(term)
    const ipMatch = log.ip.includes(term)
    const deviceMatch = log.device.toLowerCase().includes(term)

    return nameMatch || resourceMatch || ipMatch || deviceMatch
  })

  // Phân trang
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginatedLogs = filtered.slice((page - 1) * pageSize, page * pageSize)

  const actionList = Object.keys(AUDIT_ACTION_LABEL)

  return (
    <div className="flex flex-col gap-4">
      {/* THANH TÌM KIẾM VÀ BỘ LỌC */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-56 flex-1 sm:max-w-xs">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Tìm theo tên, đối tượng, IP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* Lọc theo Hành động */}
          <Select
            value={selectedAction}
            onValueChange={(val) => {
              if (val) {
                setSelectedAction(val)
                setPage(1)
              }
            }}
          >
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue placeholder="Tất cả hành động" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Tất cả hành động</SelectItem>
                {actionList.map((act) => (
                  <SelectItem key={act} value={act}>
                    {AUDIT_ACTION_LABEL[act]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>

          {/* Lọc theo Người dùng / Hệ thống */}
          <Select
            value={selectedUser}
            onValueChange={(val) => {
              if (val) {
                setSelectedUser(val)
                setPage(1)
              }
            }}
          >
            <SelectTrigger className="h-9 w-44 text-xs">
              <SelectValue placeholder="Tất cả người dùng" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="all">Tất cả người dùng</SelectItem>
                <SelectItem value="system">🤖 Hệ thống (Tự động)</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Nút Làm mới & Thông tin Real-time */}
        <div className="flex items-center gap-2 justify-end text-xs text-muted-foreground">
          <span className="hidden md:inline">
            Cập nhật tự động (8s) · Lần cuối: {lastUpdated.toLocaleTimeString('vi-VN')}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="h-8 gap-1 text-xs"
          >
            <RefreshCwIcon className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            Làm mới
          </Button>
        </div>
      </div>

      {/* BẢNG NHẬT KÝ KIỂM TOÁN */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Lịch sử thao tác & Truy cập</CardTitle>
              <CardDescription>
                {filtered.length} bản ghi phù hợp · Múi giờ Asia/Ho_Chi_Minh · Tác nhân tự động phân loại rõ ràng
              </CardDescription>
            </div>
            {filtered.length > pageSize && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Trang {page} / {totalPages}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-48">Tác nhân / Người dùng</TableHead>
                  <TableHead className="w-28">Hành động</TableHead>
                  <TableHead>Đối tượng liên quan</TableHead>
                  <TableHead className="hidden md:table-cell w-36">Thiết bị</TableHead>
                  <TableHead className="hidden lg:table-cell w-28">IP</TableHead>
                  <TableHead className="w-52">Thời gian (Giờ Việt Nam)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                      Không tìm thấy bản ghi hoạt động nào phù hợp với bộ lọc
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedLogs.map((log) => {
                    const isSystem = log.isSystem || log.userId === 'system' || log.userName === 'Hệ thống'
                    const user = users.find((u) => u.id === log.userId)
                    const displayName = isSystem ? 'Hệ thống' : log.userName || user?.name || 'Không xác định'
                    const initials = isSystem ? 'HT' : log.userInitials || user?.initials || '??'

                    return (
                      <TableRow key={log.id} className="hover:bg-muted/40 transition-colors">
                        {/* CỘT TÁC NHÂN: Phân biệt rõ Người dùng và Hệ thống */}
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            {isSystem ? (
                              <div className="flex size-7 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                                <BotIcon className="size-4" />
                              </div>
                            ) : (
                              <Avatar className="size-7">
                                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                                  {initials}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <div className="flex flex-col">
                              <span className={cn('text-sm font-medium leading-none', isSystem && 'text-slate-700 dark:text-slate-300 font-semibold')}>
                                {displayName}
                              </span>
                              <span className="text-[10px] text-muted-foreground mt-0.5">
                                {isSystem ? 'Tiến trình tự động' : (log.userRole || user?.role || 'Nhân viên')}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* CỘT HÀNH ĐỘNG: Tiếng Việt rõ ràng */}
                        <TableCell>
                          <Badge variant={ACTION_VARIANT[log.action] ?? 'secondary'} className="text-[11px] font-medium">
                            {AUDIT_ACTION_LABEL[log.action] ?? log.action}
                          </Badge>
                        </TableCell>

                        {/* CỘT ĐỐI TƯỢNG LIÊN QUAN: Tên thân thiện + Liên kết mở đối tượng */}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            {log.resourceType === 'shipment' ? (
                              <PackageIcon className="size-3.5 text-blue-500 shrink-0" />
                            ) : (
                              <FileTextIcon className="size-3.5 text-amber-500 shrink-0" />
                            )}
                            {log.resourceLink ? (
                              <Link
                                href={log.resourceLink}
                                className="font-medium text-sm text-primary hover:underline flex items-center gap-1 truncate max-w-xs sm:max-w-md"
                              >
                                {log.resourceName || log.documentId}
                                <ExternalLinkIcon className="size-3 shrink-0 opacity-60" />
                              </Link>
                            ) : (
                              <span className="text-sm font-medium text-foreground truncate max-w-xs sm:max-w-md">
                                {log.resourceName || log.documentId}
                              </span>
                            )}
                          </div>
                        </TableCell>

                        {/* CỘT THIẾT BỊ */}
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground truncate max-w-36">
                          {log.device}
                        </TableCell>

                        {/* CỘT IP */}
                        <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">
                          {log.ip}
                        </TableCell>

                        {/* CỘT THỜI GIAN: Chuẩn Asia/Ho_Chi_Minh có Sáng/Chiều + Tooltip x phút trước */}
                        <TableCell className="text-xs">
                          <div
                            className="flex flex-col cursor-help"
                            title={`Thời gian tương đối: ${formatRelative(log.at)} · Múi giờ UTC+7`}
                          >
                            <span className="font-medium text-foreground">
                              {formatAuditTimestamp(log.at)}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelative(log.at)}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* ĐIỀU KHIỂN PHÂN TRANG */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <span className="text-xs text-muted-foreground">
                Hiển thị {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, filtered.length)} trên tổng {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-8 gap-1 text-xs"
                >
                  <ChevronLeftIcon className="size-3.5" />
                  Trước
                </Button>
                <span className="text-xs font-medium px-2">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="h-8 gap-1 text-xs"
                >
                  Sau
                  <ChevronRightIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
