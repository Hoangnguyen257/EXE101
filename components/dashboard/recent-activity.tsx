import Link from 'next/link'
import {
  DownloadIcon,
  EyeIcon,
  HistoryIcon,
  PencilIcon,
  Share2Icon,
  Trash2Icon,
  UploadIcon,
  LogInIcon,
  LogOutIcon,
  CheckCircle2Icon,
  ActivityIcon,
  ArrowRightIcon,
} from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatRelative } from '@/lib/labels'
import type { Activity, User } from '@/lib/types'

const ACTION_ICON: Record<string, typeof EyeIcon> = {
  view: EyeIcon,
  download: DownloadIcon,
  edit: PencilIcon,
  delete: Trash2Icon,
  upload: UploadIcon,
  share: Share2Icon,
  restore: HistoryIcon,
  login: LogInIcon,
  logout: LogOutIcon,
  approve: CheckCircle2Icon,
  create: UploadIcon,
  update: PencilIcon,
  share_expired_auto_revoked: HistoryIcon,
}

export function RecentActivity({ activities, users }: { activities: Activity[]; users: User[] }) {
  return (
    <Card className="rounded-2xl border border-slate-200/90 dark:border-blue-900/40 bg-white dark:bg-[#07182F] shadow-xs">
      <CardHeader className="border-b border-slate-100 dark:border-blue-900/30 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-[#0875E8]">
            <ActivityIcon className="size-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Hoạt động gần đây
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Nhật ký thao tác số hóa & xử lý chứng từ theo thời gian thực
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/audit" />} nativeButton={false} className="text-xs text-[#0875E8] hover:text-[#0661c4]">
            Xem nhật ký
            <ArrowRightIcon className="ml-1 size-3.5" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-4">
        <ol className="flex flex-col">
          {activities.map((a, i) => {
            const user = users.find((u) => u.id === a.userId)
            const actionKey = (a.action || '').toLowerCase()
            const Icon = ACTION_ICON[actionKey] ?? ActivityIcon ?? EyeIcon
            return (
              <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < activities.length - 1 && (
                  <span aria-hidden className="absolute top-9 left-4 h-[calc(100%-2.25rem)] w-px bg-slate-200 dark:bg-blue-900/40" />
                )}
                <Avatar className="size-8 border border-slate-200 dark:border-blue-800">
                  <AvatarFallback className="text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-blue-950 dark:text-blue-200">
                    {user?.initials ?? '??'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{user?.name ?? 'Hệ thống'}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-[11px] text-muted-foreground">{formatRelative(a.at)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                    <Icon className="size-3.5 text-[#0875E8] shrink-0" />
                    <span className="truncate">{a.description}</span>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </CardContent>
    </Card>
  )
}
