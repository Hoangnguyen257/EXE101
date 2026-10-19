'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  ArchiveIcon,
  BellRingIcon,
  FileStackIcon,
  LayoutDashboardIcon,
  PackageIcon,
  ScrollTextIcon,
  SettingsIcon,
  ShieldCheckIcon,
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

const MAIN_NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboardIcon, tour: undefined },
  { href: '/shipments', label: 'Lô hàng', icon: PackageIcon, tour: 'nav-shipments' },
  { href: '/alerts', label: 'Cảnh báo', icon: BellRingIcon, tour: undefined, badgeKey: 'alerts' as const },
  { href: '/archive', label: 'Lưu trữ vật lý', icon: ArchiveIcon, tour: undefined },
  { href: '/audit', label: 'Nhật ký truy cập', icon: ScrollTextIcon, tour: undefined },
]

const ADMIN_NAV = [
  { href: '/settings/permissions', label: 'Phân quyền', icon: ShieldCheckIcon },
  { href: '/settings', label: 'Cài đặt', icon: SettingsIcon },
]

export function AppSidebar({ alertCount }: { alertCount: number }) {
  const pathname = usePathname()
  const isActive = (href: string) =>
    href === '/settings' ? pathname === '/settings' : pathname === href || pathname.startsWith(`${href}/`)

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
        <SidebarGroup>
          <SidebarGroupLabel>Làm việc</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_NAV.map((item) => (
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
        <SidebarGroup>
          <SidebarGroupLabel>Quản trị</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {ADMIN_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton render={<Link href={item.href} />} isActive={isActive(item.href)} tooltip={item.label}>
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex flex-col gap-2 rounded-lg border bg-background p-3 text-xs group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between">
            <span className="font-medium">Dung lượng</span>
            <span className="text-muted-foreground">38,2 / 100 GB</span>
          </div>
          <Progress value={38} aria-label="Dung lượng đã dùng" />
          <span className="text-muted-foreground">Gói Business · 31 người dùng</span>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
