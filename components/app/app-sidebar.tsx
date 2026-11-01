'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArchiveIcon,
  BellRingIcon,
  FileStackIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ScanLineIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from '@/components/ui/sidebar'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { useApp } from './app-provider'

const WORK_NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboardIcon, tour: undefined },
  { href: '/shipments', label: 'Lô hàng', icon: PackageIcon, tour: 'nav-shipments' },
  { href: '/documents', label: 'Chứng từ đã lưu', icon: FileTextIcon, tour: undefined },
  { href: '/scan', label: 'Quét chứng từ', icon: ScanLineIcon, tour: undefined },
  { href: '/alerts', label: 'Cảnh báo', icon: BellRingIcon, tour: undefined, badgeKey: 'alerts' as const },
  { href: '/archive', label: 'Lưu trữ vật lý', icon: ArchiveIcon, tour: undefined },
]

export function AppSidebar({ alertCount }: { alertCount: number }) {
  const pathname = usePathname()
  const { currentUser } = useApp()
  const role = currentUser.role?.toLowerCase()

  const isActive = (href: string) =>
    href === '/settings' ? pathname === '/settings' : pathname === href || pathname.startsWith(`${href}/`)

  const isAdmin = role === 'admin' || role === 'owner'
  const isManager = role === 'manager' || role === 'team_lead'

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />} tooltip="TML DocManager">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <FileStackIcon className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">TML DocManager</span>
                <span className="truncate text-xs text-muted-foreground">Logistics Tân Minh</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* NHÓM 1: LÀM VIỆC (Hiển thị cho tất cả vai trò) */}
        <SidebarGroup>
          <SidebarGroupLabel>Làm việc</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORK_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    data-tour={item.tour}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.badgeKey && alertCount > 0 && <SidebarMenuBadge>{alertCount}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* NHÓM 2: QUẢN TRỊ (Chỉ hiển thị cho Admin và Manager, ẩn hoàn toàn đối với Staff) */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Quản trị hệ thống</span>
              <Badge variant="outline" className="text-[10px] uppercase text-primary border-primary/30">
                Admin
              </Badge>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/settings/permissions" />} isActive={isActive('/settings/permissions')} tooltip="Phân quyền Enterprise">
                    <ShieldCheckIcon />
                    <span>Trung tâm Phân quyền</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/audit" />} isActive={isActive('/audit')} tooltip="Nhật ký kiểm toán">
                    <ScrollTextIcon />
                    <span>Nhật ký Kiểm toán</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/settings" />} isActive={isActive('/settings')} tooltip="Cài đặt tổ chức & Người dùng">
                    <SettingsIcon />
                    <span>Cài đặt & Người dùng</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isAdmin && isManager && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between">
              <span>Quản trị phòng ban</span>
              <Badge variant="outline" className="text-[10px] uppercase text-amber-600 border-amber-300">
                Manager
              </Badge>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/settings" />} isActive={isActive('/settings')} tooltip="Nhân sự phòng ban">
                    <UsersIcon />
                    <span>Thành viên phòng ban</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/audit" />} isActive={isActive('/audit')} tooltip="Nhật ký phòng ban">
                    <ScrollTextIcon />
                    <span>Nhật ký phòng ban</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/settings/permissions" />} isActive={isActive('/settings/permissions')} tooltip="Quy tắc phân quyền">
                    <ShieldCheckIcon />
                    <span>Quy tắc phòng ban</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 text-xs group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between">
            <span className="font-medium">Dung lượng</span>
            <span className="text-muted-foreground">38,2 / 100 GB</span>
          </div>
          <Progress value={38} aria-label="Dung lượng đã dùng" />
          <span className="text-muted-foreground">Gói Enterprise · 31 người dùng</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
