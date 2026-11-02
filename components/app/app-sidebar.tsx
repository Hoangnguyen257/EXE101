'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
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
  SparklesIcon,
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

const WORKSPACE_NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboardIcon, tour: undefined },
  { href: '/documents', label: 'Chứng từ đã lưu', icon: FileTextIcon, tour: undefined },
]

const LOGISTICS_NAV = [
  { href: '/shipments', label: 'Lô hàng', icon: PackageIcon, tour: 'nav-shipments' },
  { href: '/archive', label: 'Lưu trữ vật lý', icon: ArchiveIcon, tour: undefined },
]

const INTELLIGENCE_NAV = [
  { href: '/scan', label: 'Quét & OCR', icon: ScanLineIcon, tour: undefined },
  { href: '/alerts', label: 'Cảnh báo', icon: BellRingIcon, tour: undefined, badgeKey: 'alerts' as const },
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
    <Sidebar collapsible="icon" className="border-r border-slate-200/80 dark:border-blue-900/40">
      <SidebarHeader className="border-b border-slate-100 dark:border-blue-900/30 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/dashboard" />} tooltip="TML DocManager">
              <div className="flex aspect-square size-9 items-center justify-center rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                <Image src="/tml-logo.jpg" alt="TML Logo" width={34} height={34} className="object-contain" priority />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white">
                  <span className="truncate">TML DocManager</span>
                  <span className="size-1.5 rounded-full bg-amber-500" />
                </div>
                <span className="truncate text-[11px] text-[#0875E8] font-medium tracking-wide">
                  INTELLIGENT VAULT
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-1 py-2">
        {/* GROUP 1: WORKSPACE */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Không gian làm việc
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {WORKSPACE_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    data-tour={item.tour}
                    className="font-medium"
                  >
                    <item.icon className="size-4 text-[#0875E8]" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GROUP 2: LOGISTICS */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Nghiệp vụ Logistics
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {LOGISTICS_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    data-tour={item.tour}
                    className="font-medium"
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GROUP 3: INTELLIGENCE & OCR */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center justify-between">
            <span>Trí tuệ số & Cảnh báo</span>
            <SparklesIcon className="size-2.5 text-cyan-500" />
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {INTELLIGENCE_NAV.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    render={<Link href={item.href} />}
                    isActive={isActive(item.href)}
                    tooltip={item.label}
                    data-tour={item.tour}
                    className="font-medium"
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                  {item.badgeKey && alertCount > 0 && (
                    <SidebarMenuBadge className="bg-red-500/10 text-red-600 font-bold border border-red-200">
                      {alertCount}
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* GROUP 4: MANAGEMENT (Admin / Manager) */}
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Quản trị hệ thống</span>
              <Badge variant="outline" className="text-[9px] font-mono uppercase text-[#0875E8] border-[#0875E8]/30 bg-blue-50/50">
                Admin
              </Badge>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/settings/permissions" />}
                    isActive={isActive('/settings/permissions')}
                    tooltip="Phân quyền Enterprise"
                    className="font-medium"
                  >
                    <ShieldCheckIcon className="size-4 text-emerald-600" />
                    <span>Trung tâm Phân quyền</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/audit" />}
                    isActive={isActive('/audit')}
                    tooltip="Nhật ký kiểm toán"
                    className="font-medium"
                  >
                    <ScrollTextIcon className="size-4" />
                    <span>Nhật ký Kiểm toán</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/settings" />}
                    isActive={isActive('/settings')}
                    tooltip="Cài đặt tổ chức & Người dùng"
                    className="font-medium"
                  >
                    <SettingsIcon className="size-4" />
                    <span>Cài đặt & Người dùng</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isAdmin && isManager && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <span>Quản trị phòng ban</span>
              <Badge variant="outline" className="text-[9px] font-mono uppercase text-amber-600 border-amber-300 bg-amber-50/50">
                Manager
              </Badge>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/settings" />}
                    isActive={isActive('/settings')}
                    tooltip="Nhân sự phòng ban"
                    className="font-medium"
                  >
                    <UsersIcon className="size-4" />
                    <span>Thành viên phòng ban</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/audit" />}
                    isActive={isActive('/audit')}
                    tooltip="Nhật ký phòng ban"
                    className="font-medium"
                  >
                    <ScrollTextIcon className="size-4" />
                    <span>Nhật ký phòng ban</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/settings/permissions" />}
                    isActive={isActive('/settings/permissions')}
                    tooltip="Quy tắc phân quyền"
                    className="font-medium"
                  >
                    <ShieldCheckIcon className="size-4 text-amber-600" />
                    <span>Quy tắc phòng ban</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-slate-100 dark:border-blue-900/30 pt-3">
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200/90 dark:border-blue-900/40 bg-white/80 dark:bg-[#07182F]/80 p-3 text-xs shadow-xs group-data-[collapsible=icon]:hidden">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Kho dữ liệu TML</span>
            <span className="font-mono text-[11px] text-[#0875E8] font-bold">38,2 / 100 GB</span>
          </div>
          <Progress value={38} aria-label="Dung lượng đã dùng" className="h-1.5 bg-slate-100" />
          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Enterprise Vault</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">Bảo mật ISO 27001</span>
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
