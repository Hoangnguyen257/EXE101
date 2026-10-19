'use client'

import { useState } from 'react'
import { CheckIcon, CopyIcon, KeyRoundIcon, LinkIcon, ShieldCheckIcon, XIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { formatDateTime, NOW } from '@/lib/labels'
import type { DocumentFile, ShareLink } from '@/lib/types'

const EXPIRY_OPTIONS = [
  { value: '1', label: '24 giờ' },
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
]

const seedLinks = (docId: string): ShareLink[] => [
  {
    id: 'sl_seed',
    documentId: docId,
    token: 'k7Qm2xPa',
    expiresAt: new Date(NOW.getTime() + 3 * 86400000).toISOString(),
    hasPassword: true,
    createdBy: 'u2',
    createdAt: new Date(NOW.getTime() - 86400000).toISOString(),
    views: 4,
  },
]

function randomToken() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (n) => chars[n % chars.length]).join('')
}

export function ShareDialog({
  doc,
  onOpenChange,
}: {
  doc: Pick<DocumentFile, 'id' | 'title' | 'fileName'> | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{doc && <ShareDialogBody key={doc.id} doc={doc} />}</DialogContent>
    </Dialog>
  )
}

function ShareDialogBody({ doc }: { doc: Pick<DocumentFile, 'id' | 'title' | 'fileName'> }) {
  const [expiry, setExpiry] = useState('7')
  const [withPassword, setWithPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [allowDownload, setAllowDownload] = useState(true)
  const [links, setLinks] = useState<ShareLink[]>(() => seedLinks(doc.id))
  const [copied, setCopied] = useState<string | null>(null)

  const origin = typeof window === 'undefined' ? 'https://docs.tml.vn' : window.location.origin
  const linkUrl = (token: string) => `${origin}/s/${token}`

  const create = () => {
    const link: ShareLink = {
      id: `sl_${Date.now()}`,
      documentId: doc.id,
      token: randomToken(),
      expiresAt: new Date(Date.now() + Number(expiry) * 86400000).toISOString(),
      hasPassword: withPassword,
      createdBy: 'u2',
      createdAt: new Date().toISOString(),
      views: 0,
    }
    setLinks((l) => [link, ...l])
    copy(link)
    setPassword('')
  }

  const copy = async (link: ShareLink) => {
    try {
      await navigator.clipboard.writeText(linkUrl(link.token))
    } catch {
      // Clipboard can be blocked inside iframes; the link stays visible for manual copy.
    }
    setCopied(link.id)
    toast.success('Đã sao chép liên kết', { description: `Hết hạn lúc ${formatDateTime(link.expiresAt)}` })
    window.setTimeout(() => setCopied(null), 1600)
  }

  const revoke = (id: string) => {
    setLinks((l) => l.filter((x) => x.id !== id))
    toast('Đã thu hồi liên kết', { description: 'Người nhận sẽ không thể truy cập nữa.' })
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Chia sẻ an toàn</DialogTitle>
        <DialogDescription className="truncate">{doc.title}</DialogDescription>
      </DialogHeader>

      <FieldGroup>
        <Field>
          <FieldLabel>Thời hạn liên kết</FieldLabel>
          <ToggleGroup value={[expiry]} onValueChange={(v) => v[0] && setExpiry(v[0] as string)} variant="outline" className="w-full">
            {EXPIRY_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} className="flex-1">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="share-password-toggle">Đặt mật khẩu</FieldLabel>
            <FieldDescription>Người nhận phải nhập mật khẩu để mở.</FieldDescription>
          </FieldContent>
          <Switch id="share-password-toggle" checked={withPassword} onCheckedChange={setWithPassword} />
        </Field>
        {withPassword && (
          <Field>
            <FieldLabel htmlFor="share-password" className="sr-only">
              Mật khẩu
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <KeyRoundIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="share-password"
                type="password"
                placeholder="Tối thiểu 6 ký tự"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </InputGroup>
          </Field>
        )}
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="share-download">Cho phép tải xuống</FieldLabel>
            <FieldDescription>Tắt để người nhận chỉ xem trực tuyến.</FieldDescription>
          </FieldContent>
          <Switch id="share-download" checked={allowDownload} onCheckedChange={setAllowDownload} />
        </Field>
        <Button onClick={create} disabled={withPassword && password.length < 6}>
          <LinkIcon data-icon="inline-start" />
          Tạo liên kết & sao chép
        </Button>
      </FieldGroup>

      <Separator />

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Liên kết đang hoạt động</h3>
          <Badge variant="secondary">{links.length}</Badge>
        </div>
        {links.length === 0 ? (
          <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
            Chưa có liên kết nào. Tài liệu chỉ người trong tổ chức xem được.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {links.map((l) => (
              <li key={l.id} className="flex flex-col gap-2 rounded-lg border p-3">
                <InputGroup>
                  <InputGroupInput readOnly value={linkUrl(l.token)} aria-label="Liên kết chia sẻ" className="font-mono text-xs" />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton size="icon-xs" onClick={() => copy(l)} aria-label="Sao chép liên kết">
                      {copied === l.id ? <CheckIcon /> : <CopyIcon />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>Hết hạn {formatDateTime(l.expiresAt)}</span>
                  {l.hasPassword && (
                    <Badge variant="info">
                      <ShieldCheckIcon data-icon="inline-start" />
                      Có mật khẩu
                    </Badge>
                  )}
                  <span>· {l.views} lượt xem</span>
                  <Button variant="ghost" size="xs" className="ml-auto text-destructive" onClick={() => revoke(l.id)}>
                    <XIcon data-icon="inline-start" />
                    Thu hồi
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
