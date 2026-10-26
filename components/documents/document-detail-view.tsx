'use client'

import Link from 'next/link'
import {
  ArrowLeftIcon,
  FileTextIcon,
  PencilIcon,
  Share2Icon,
  DownloadIcon,
  PrinterIcon,
  CalendarIcon,
  ArchiveIcon,
  CheckCircle2Icon,
  ClockIcon,
  BuildingIcon,
  PackageIcon,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useApp } from '@/components/app/app-provider'
import { DOC_TYPE_LABEL, formatDate, formatDateTime, formatSize } from '@/lib/labels'
import type { Customer, DocumentFile, Shipment, ArchiveBox, User } from '@/lib/types'

interface DocumentDetailViewProps {
  document: DocumentFile
  shipment: Shipment
  customer: Customer
  archiveBox: ArchiveBox | null
  users: User[]
}

export function DocumentDetailView({
  document,
  shipment,
  customer,
  archiveBox,
  users,
}: DocumentDetailViewProps) {
  const { openShare } = useApp()
  const userName = (id: string) => users.find((u) => u.id === id)?.name ?? id

  const handleDownload = () => {
    // Generate a simple text/pdf mock download
    const blob = new Blob([document.ocrText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = document.fileName.replace(/\.pdf$/i, '.txt')
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={`/shipments/${shipment.id}`} />}
          className="-ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeftIcon className="mr-1.5 size-4" />
          Quay lại hồ sơ lô hàng {shipment.jobNo}
        </Button>
      </div>

      {/* Main Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {document.title}
            </h1>
            <Badge variant="secondary">
              {document.customTypeName || DOC_TYPE_LABEL[document.type]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Tập tin: <span className="font-mono font-medium text-foreground">{document.fileName}</span> ·{' '}
            {formatSize(document.sizeKb)} · {document.pages} trang · Lô hàng:{' '}
            <Link href={`/shipments/${shipment.id}`} className="font-mono font-medium text-primary hover:underline">
              {shipment.jobNo}
            </Link>
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`/documents/${document.id}/edit`} />}
          >
            <PencilIcon data-icon="inline-start" />
            Chỉnh sửa nội dung
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              openShare({
                id: document.id,
                title: document.title,
                fileName: document.fileName,
              })
            }
          >
            <Share2Icon data-icon="inline-start" />
            Chia sẻ
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownload}>
            <DownloadIcon data-icon="inline-start" />
            Tải về
          </Button>
          <Button size="sm" variant="ghost" onClick={handlePrint}>
            <PrinterIcon data-icon="inline-start" />
            In
          </Button>
        </div>
      </div>

      {/* Metadata Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Document Info */}
        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle>Thông tin chứng từ</CardTitle>
            <CardDescription>Chi tiết nguồn gốc, khách hàng và người tải lên</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Loại chứng từ:</span>
              <span className="font-medium">{document.customTypeName || DOC_TYPE_LABEL[document.type]}</span>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Lô hàng (Job):</span>
              <Link href={`/shipments/${shipment.id}`} className="font-mono font-medium text-primary hover:underline">
                {shipment.jobNo} ({shipment.blNo})
              </Link>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Khách hàng:</span>
              <span className="font-medium">{customer.name} ({customer.shortName})</span>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Ngày chứng từ:</span>
              <span className="font-medium">{formatDate(document.docDate)}</span>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Người tải lên:</span>
              <span className="font-medium">{userName(document.uploadedBy)} ({formatDateTime(document.uploadedAt)})</span>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-2">
              <span className="text-muted-foreground">Thời hạn lưu trữ:</span>
              <span className="font-medium">{formatDate(document.retentionUntil)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Physical Archive Box */}
        <Card>
          <CardHeader>
            <CardTitle>Lưu trữ vật lý</CardTitle>
            <CardDescription>Vị trí kho và mã QR hộp</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-sm text-center">
            {archiveBox ? (
              <>
                <div className="p-3 bg-white rounded-lg border shadow-sm">
                  <QRCodeSVG value={`TML-BOX:${archiveBox.code}`} size={110} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono font-bold text-base">{archiveBox.code}</span>
                  <span className="text-xs text-muted-foreground">
                    {archiveBox.warehouse} · Kệ {archiveBox.shelf} · Hộp {archiveBox.box}
                  </span>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                <ArchiveIcon className="size-10 stroke-1 text-muted-foreground/60" />
                <p className="text-xs">Chưa gán hộp lưu trữ vật lý</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* OCR Text Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Nội dung trích xuất (OCR)</CardTitle>
          <CardDescription>Văn bản được nhận dạng tự động từ hình ảnh chứng từ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border bg-muted/30 p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90 max-h-96 overflow-y-auto">
            {document.ocrText || 'Không có nội dung văn bản'}
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      {document.versions && document.versions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Lịch sử phiên bản ({document.versions.length})</CardTitle>
            <CardDescription>Các lần tải lên và chỉnh sửa tập tin</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y text-sm">
              {document.versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="font-mono">v{v.version}</Badge>
                    <div className="flex flex-col">
                      <span className="font-medium">{v.fileName}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.note} · {formatSize(v.sizeKb)} · bởi {userName(v.uploadedBy)}
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{formatRelative(v.uploadedAt)}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
