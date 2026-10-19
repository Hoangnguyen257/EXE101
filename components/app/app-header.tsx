'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { CompassIcon, LogOutIcon, MonitorIcon, MoonIcon, SearchIcon, SunIcon, UploadIcon, UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ROLE_LABEL } from '@/lib/labels'
import { useApp } from './app-provider'
import { SyncBadge } from './status-badges'

export function AppHeader() {
  const { currentUser, openSearch, openUpload, startTour, sync } = useApp()
  const { theme, setTheme } = useTheme()
  const router = useRouter()

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/75 md:px-4">
      <SidebarTrigger aria-label="Thu gọn / mở thanh bên" />
      <Separator orientation="vertical" className="mr-1 h-5" />

      <button
        type="button"
        onClick={openSearch}
        data-tour="search"
        className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted md:max-w-md"
      >
        <SearchIcon className="size-4 shrink-0" />
        <span className="truncate">Tìm Job, Bill, khách hàng, nội dung PDF...</span>
        <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
      </button>

      <div className="ml-auto flex items-center gap-2">
        <div data-tour="sync" className="hidden sm:block">
          <SyncBadge state={sync} />
        </div>
        <Button onClick={() => openUpload()} data-tour="upload">
          <UploadIcon data-icon="inline-start" />
          <span className="hidden sm:inline">Tải lên</span>
          <span className="sr-only sm:hidden">Tải lên</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="ghost" size="icon" className="rounded-full" aria-label="Tài khoản" />}
          >
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary/10 text-xs font-medium text-primary">{currentUser.initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="font-medium text-foreground">{currentUser.name}</span>
                <span className="text-xs font-normal">
                  {currentUser.email} · {ROLE_LABEL[currentUser.role]}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/settings" />}>
                <UserIcon />
                Hồ sơ & tổ chức
              </DropdownMenuItem>
              <DropdownMenuItem onClick={startTour}>
                <CompassIcon />
                Xem lại hướng dẫn
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Giao diện</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={(v) => setTheme(v as string)}>
                <DropdownMenuRadioItem value="light">
                  <SunIcon />
                  Sáng
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <MoonIcon />
                  Tối
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <MonitorIcon />
                  Theo hệ thống
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem variant="destructive" onClick={() => router.push('/login')}>
                <LogOutIcon />
                Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
