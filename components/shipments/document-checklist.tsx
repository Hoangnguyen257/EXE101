'use client'

import { useState } from 'react'
import Link from 'next/link'
import { FileTextIcon, Share2Icon, UploadCloudIcon, UploadIcon } from 'lucide-react'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useApp } from '@/components/app/app-provider'
import { DocPresenceBadge, LockBadge } from '@/components/app/status-badges'
import { DOC_TYPE_LABEL, formatRelative, formatSize } from '@/lib/labels'
import { getRequiredDocTypes, type DocumentFile, type User } from '@/lib/types'
import type { ShipmentWithProgress } from '@/lib/data'
import { cn } from '@/lib/utils'

export function DocumentChecklist({
  shipment,
  documents,
  users,
}: {
  shipment: ShipmentWithProgress
  documents: DocumentFile[]
  users: User[]
}) {
  const { openUpload, openShare } = useApp()
  const [dragOver, setDragOver] = useState(false)
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? ''
  const required = shipment.requiredTypes ?? getRequiredDocTypes(shipment)
  const extras = documents.filter((d) => !required.includes(d.type))
  const done = shipment.presentTypes.length

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length) openUpload({ shipmentId: shipment.id }, files)
  }

  return (
    <Card
      onDragOver={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={cn('transition-colors', dragOver && 'border-primary bg-primary/5 ring-2 ring-primary/30')}
    >
      <CardHeader>
        <CardTitle>Bộ chứng từ bắt buộc</CardTitle>
        <CardDescription>
          {done}/{required.length} chứng từ đã có · kéo thả file vào đây để bổ sung
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => openUpload({ shipmentId: shipment.id })}>
            <UploadIcon data-icon="inline-start" />
            Tải lên
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Tiến độ hoàn thiện</span>
            <span className="tabular-nums text-muted-foreground">{shipment.progress}%</span>
          </div>
          <Progress value={shipment.progress} aria-label="Tiến độ hoàn thiện chứng từ" />
        </div>

        <ul className="flex flex-col gap-2">
          {required.map((type) => {
            const doc = documents.find((d) => d.type === type)
            return (
              <li
                key={type}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center',
                  !doc && 'border-dashed border-destructive/40 bg-destructive/[0.03]',
                )}
              >
                <div
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg',
                    doc ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
                  )}
                >
                  <FileTextIcon className="size-5" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{DOC_TYPE_LABEL[type]}</span>
                    <DocPresenceBadge present={!!doc} />
                    {doc?.lock && <LockBadge userName={userName(doc.lock.userId)} since={doc.lock.since} />}
                  </div>
                  {doc ? (
                    <Link href={`/documents/${doc.id}`} className="truncate text-sm text-muted-foreground hover:text-primary">
                      {doc.fileName} · {formatSize(doc.sizeKb)} · v{doc.versions.length} · {userName(doc.uploadedBy)},{' '}
                      {formatRelative(doc.uploadedAt)}
                    </Link>
                  ) : (
                    <span className="text-sm text-muted-foreground">Chưa có file. Kéo thả hoặc bấm “Bổ sung”.</span>
                  )}
                </div>
                <div className="flex gap-2">
                  {doc ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Chia sẻ ${DOC_TYPE_LABEL[type]}`}
                        onClick={() => openShare(doc)}
                      >
                        <Share2Icon />
                      </Button>
                      <Button variant="outline" size="sm" render={<Link href={`/documents/${doc.id}`} />} nativeButton={false}>
                        Mở
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => openUpload({ shipmentId: shipment.id, docType: type })}>
                      <UploadCloudIcon data-icon="inline-start" />
                      Bổ sung
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>

        {extras.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium text-muted-foreground">Chứng từ khác</h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {extras.map((d) => (
                  <li key={d.id}>
                    <Link href={`/documents/${d.id}`} className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/60">
                      <FileTextIcon className="size-4 shrink-0 text-primary" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">{d.customTypeName || DOC_TYPE_LABEL[d.type]}</span>
                        <span className="truncate text-xs text-muted-foreground">{d.fileName}</span>
                      </div>
                      {d.lock && <span className="ml-auto"><LockBadge userName={userName(d.lock.userId)} since={d.lock.since} /></span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
