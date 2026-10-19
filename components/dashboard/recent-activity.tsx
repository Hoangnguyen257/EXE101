import Link from 'next/link'
import { DownloadIcon, EyeIcon, HistoryIcon, PencilIcon, Share2Icon, Trash2Icon, UploadIcon } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { formatRelative } from '@/lib/labels'
import type { Activity, AuditAction, User } from '@/lib/types'

const ACTION_ICON: Record<AuditAction, typeof EyeIcon> = {
  view: EyeIcon,
  download: DownloadIcon,
  edit: PencilIcon,
  delete: Trash2Icon,
  upload: UploadIcon,
  share: Share2Icon,
  restore: HistoryIcon,
}

export function RecentActivity({ activities, users }: { activities: Activity[]; users: User[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Hoạt động gần đây</CardTitle>
        <CardDescription>Cập nhật theo thời gian thực từ toàn bộ nhóm</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" render={<Link href="/audit" />} nativeButton={false}>
            Xem nhật ký
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col">
          {activities.map((a, i) => {
            const user = users.find((u) => u.id === a.userId)
            const Icon = ACTION_ICON[a.action]
            return (
              <li key={a.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < activities.length - 1 && <span aria-hidden className="absolute top-9 left-4 h-[calc(100%-2.25rem)] w-px bg-border" />}
                <Avatar className="size-8">
                  <AvatarFallback className="text-xs">{user?.initials}</AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
                  <p className="text-sm leading-snug">
                    <span className="font-medium">{user?.name}</span> {a.description}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="size-3" />
                    <span>{formatRelative(a.at)}</span>
                    {a.documentId && (
                      <>
                        <span aria-hidden>·</span>
                        <Link href={`/documents/${a.documentId}`} className="text-primary hover:underline">
                          Mở chứng từ
                        </Link>
                      </>
                    )}
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
