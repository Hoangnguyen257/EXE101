'use client'

import { useState, useEffect } from 'react'
import {
  DownloadIcon,
  EyeIcon,
  FileStackIcon,
  FileTextIcon,
  LockIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate, formatDateTime } from '@/lib/labels'
import { cn } from '@/lib/utils'

interface PublicDocViewerProps {
  token: string
  share: {
    id: string
    hasPassword: boolean
    expiresAt: string
    allowDownload: boolean
    views: number
    isExpired: boolean
    isRevoked: boolean
    isOverLimit: boolean
  }
  document: {
    id: string
    title: string
    fileName: string
    type: string
    docDate: string
    pages: number
    ocrText: string
    shipmentJobNo: string
    customerName: string
  }
}

export function PublicDocViewer({ token, share, document: doc }: PublicDocViewerProps) {
  const [unlocked, setUnlocked] = useState(!share.hasPassword)
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [displayedOcr, setDisplayedOcr] = useState(doc.ocrText)
  const [loadingContent, setLoadingContent] = useState(false)
  const [viewMode, setViewMode] = useState<'preview' | 'ocr'>('preview')

  const isPdf = doc.fileName.toLowerCase().endsWith('.pdf')
  const isImage = /\.(png|jpe?g|webp|bmp|gif)$/i.test(doc.fileName)

  // Tải nội dung OCR bảo mật sau khi đã mở khóa
  useEffect(() => {
    if (unlocked && !displayedOcr) {
      setLoadingContent(true)
      fetch(`/api/s/${token}/content`)
        .then((res) => res.json())
        .then((data) => {
          if (data.ocrText) {
            setDisplayedOcr(data.ocrText)
          }
        })
        .catch(() => {})
        .finally(() => setLoadingContent(false))
    }
  }, [unlocked, displayedOcr, token])

  if (share.isRevoked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <ShieldAlertIcon className="mx-auto size-12 text-destructive" />
            <CardTitle>Liên kết đã bị thu hồi</CardTitle>
            <CardDescription>Người chia sẻ đã vô hiệu hóa liên kết này. Vui lòng liên hệ để nhận liên kết mới.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (share.isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <ShieldAlertIcon className="mx-auto size-12 text-amber-500" />
            <CardTitle>Liên kết đã hết hạn</CardTitle>
            <CardDescription>Thời hạn truy cập tài liệu này đã kết thúc vào {formatDateTime(share.expiresAt)}.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (share.isOverLimit) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <Card className="max-w-md text-center">
          <CardHeader>
            <ShieldAlertIcon className="mx-auto size-12 text-amber-500" />
            <CardTitle>Vượt quá số lượt xem</CardTitle>
            <CardDescription>Liên kết này đã đạt giới hạn số lần mở được cấp phép.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setVerifying(true)

    try {
      const res = await fetch(`/api/s/${token}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        setUnlocked(true)
      } else {
        const data = await res.json()
        setErrorMsg(data.error || 'Mật khẩu không đúng.')
      }
    } catch {
      setErrorMsg('Lỗi kết nối máy chủ.')
    } finally {
      setVerifying(false)
    }
  }

  const handleDownload = () => {
    window.location.href = `/api/s/${token}/download`
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileStackIcon className="size-4" />
            </div>
            <div>
              <span className="font-semibold text-foreground">TML DocManager</span>
              <span className="ml-2 text-xs text-muted-foreground">Chia sẻ an toàn</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheckIcon className="size-4 text-success" />
            <span>Mã hóa bảo vệ</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-4 md:p-6">
        {!unlocked ? (
          <div className="mx-auto mt-12 max-w-md">
            <Card className="shadow-lg">
              <CardHeader className="text-center">
                <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <LockIcon className="size-6" />
                </div>
                <CardTitle>Tài liệu được bảo vệ bằng mật khẩu</CardTitle>
                <CardDescription>Vui lòng nhập mật khẩu được cung cấp để mở xem chứng từ này.</CardDescription>
              </CardHeader>
              <form onSubmit={handleVerify}>
                <CardContent className="space-y-4">
                  {errorMsg && (
                    <div className="rounded-lg bg-destructive/10 p-2.5 text-center text-xs text-destructive">
                      {errorMsg}
                    </div>
                  )}
                  <Input
                    type="password"
                    placeholder="Nhập mật khẩu..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={verifying}
                  />
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full" disabled={verifying}>
                    {verifying ? 'Đang kiểm tra...' : 'Mở khóa tài liệu'}
                  </Button>
                </CardFooter>
              </form>
            </Card>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">{doc.title}</h1>
                  <Badge variant="secondary">{doc.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Lô hàng: <span className="font-mono font-medium text-foreground">{doc.shipmentJobNo}</span> · Khách hàng:{' '}
                  <span className="font-medium text-foreground">{doc.customerName}</span> · Ngày lập:{' '}
                  {formatDate(doc.docDate)}
                </p>
              </div>

              {share.allowDownload && (
                <Button onClick={handleDownload} className="w-fit">
                  <DownloadIcon className="mr-1.5 size-4" />
                  Tải xuống tập tin
                </Button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1 w-fit">
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    viewMode === 'preview'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <EyeIcon className="size-3.5" />
                  Xem tập tin gốc ({doc.fileName})
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('ocr')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                    viewMode === 'ocr'
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <FileTextIcon className="size-3.5" />
                  Nội dung văn bản (OCR)
                </button>
              </div>

              <Card className="overflow-hidden">
                <CardHeader className="border-b bg-muted/40 py-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <FileTextIcon className="size-4" />
                      {doc.fileName} ({doc.pages} trang)
                    </span>
                    <span>Liên kết có hiệu lực đến: {formatDateTime(share.expiresAt)}</span>
                  </div>
                </CardHeader>
                <CardContent className="p-4 md:p-6">
                  {viewMode === 'preview' ? (
                    isPdf ? (
                      <div className="relative w-full h-[750px] rounded-lg border overflow-hidden bg-muted/10">
                        <iframe
                          src={`/api/s/${token}/file#toolbar=1`}
                          title={doc.title}
                          className="w-full h-full border-0 bg-white"
                        />
                      </div>
                    ) : isImage ? (
                      <div className="flex items-center justify-center min-h-[500px] p-4 rounded-lg border bg-muted/10">
                        <img
                          src={`/api/s/${token}/file`}
                          alt={doc.title}
                          className="max-h-[750px] max-w-full object-contain rounded-md shadow-sm border bg-white"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center text-muted-foreground gap-3">
                        <FileTextIcon className="size-12 text-muted-foreground/60" />
                        <div>
                          <p className="font-medium text-foreground">Tập tin định dạng {doc.fileName.split('.').pop()?.toUpperCase()}</p>
                          <p className="text-xs">Định dạng này không hỗ trợ xem trước trực tiếp trên trình duyệt.</p>
                        </div>
                        {share.allowDownload && (
                          <Button onClick={handleDownload} variant="outline" size="sm">
                            <DownloadIcon className="mr-1.5 size-4" /> Tải về máy để xem
                          </Button>
                        )}
                      </div>
                    )
                  ) : (
                    <div className="min-h-[400px] rounded-lg border bg-background p-6 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                      {loadingContent
                        ? 'Đang tải nội dung văn bản chứng từ...'
                        : (displayedOcr || 'Nội dung chứng từ điện tử đã được ghi nhận trong kho dữ liệu TML.')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
