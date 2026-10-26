'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CameraIcon,
  CameraOffIcon,
  FlipHorizontalIcon,
  ImagePlusIcon,
  RotateCwIcon,
  TrashIcon,
  ArrowRightIcon,
  GripVerticalIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/app/page-header'
import { cn } from '@/lib/utils'
import { PageEditor } from '@/components/scan/page-editor'

export type CapturedPage = {
  id: string
  dataUrl: string // final processed image
  rawDataUrl: string // original captured
}

type CameraError = 'denied' | 'unavailable' | null

function makeid() {
  return Math.random().toString(36).slice(2, 9)
}

// ---------------------------------------------------------------------------
// Camera view
// ---------------------------------------------------------------------------
function CameraView({
  onCapture,
}: {
  onCapture: (dataUrl: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<CameraError>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [stream, setStream] = useState<MediaStream | null>(null)

  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    if (stream) stream.getTracks().forEach((t) => t.stop())
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      setStream(s)
      if (videoRef.current) videoRef.current.srcObject = s
      setError(null)
    } catch (e: unknown) {
      const err = e as { name?: string }
      setError(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable')
    }
  }, [stream])

  useEffect(() => {
    startCamera(facingMode)
    return () => { stream?.getTracks().forEach((t) => t.stop()) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode])

  const capture = () => {
    if (!videoRef.current) return
    const v = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth
    canvas.height = v.videoHeight
    canvas.getContext('2d')!.drawImage(v, 0, 0)
    onCapture(canvas.toDataURL('image/jpeg', 0.92))
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed p-10 text-center">
        <CameraOffIcon className="size-12 text-muted-foreground" />
        <p className="text-sm font-medium">
          {error === 'denied'
            ? 'Quyền truy cập camera bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt rồi thử lại.'
            : 'Không tìm thấy camera trên thiết bị của bạn.'}
        </p>
      </div>
    )
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />
      {/* Document frame overlay */}
      <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
      {/* Controls */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6">
        <Button
          variant="secondary"
          size="icon"
          className="size-10 rounded-full opacity-80"
          onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
          aria-label="Đổi camera"
        >
          <FlipHorizontalIcon className="size-5" />
        </Button>
        <button
          onClick={capture}
          className="size-16 rounded-full border-4 border-white bg-white/20 backdrop-blur transition hover:bg-white/40 active:scale-95"
          aria-label="Chụp ảnh"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Thumbnail strip
// ---------------------------------------------------------------------------
function ThumbnailStrip({
  pages,
  editingIndex,
  onSelect,
  onDelete,
  onReorder,
}: {
  pages: CapturedPage[]
  editingIndex: number | null
  onSelect: (i: number) => void
  onDelete: (i: number) => void
  onReorder: (from: number, to: number) => void
}) {
  const dragRef = useRef<number | null>(null)

  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {pages.map((p, i) => (
        <div
          key={p.id}
          draggable
          onDragStart={() => { dragRef.current = i }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragRef.current !== null && dragRef.current !== i) onReorder(dragRef.current, i) }}
          className={cn(
            'group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition',
            editingIndex === i ? 'border-primary' : 'border-transparent',
          )}
          style={{ width: 80, height: 100 }}
          onClick={() => onSelect(i)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.dataUrl} alt={`Trang ${i + 1}`} className="h-full w-full object-cover" />
          <span className="absolute bottom-0.5 left-0 right-0 text-center text-[10px] font-medium text-white drop-shadow">
            {i + 1}
          </span>
          {/* drag handle */}
          <GripVerticalIcon className="absolute left-0.5 top-0.5 size-3 text-white/70 opacity-0 group-hover:opacity-100" />
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(i) }}
            className="absolute right-0.5 top-0.5 rounded bg-black/50 p-0.5 opacity-0 transition group-hover:opacity-100 hover:bg-destructive"
            aria-label="Xóa trang"
          >
            <TrashIcon className="size-3 text-white" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function ScanContent() {
  const router = useRouter()
  const [pages, setPages] = useState<CapturedPage[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const addPage = (dataUrl: string) => {
    const page: CapturedPage = { id: makeid(), dataUrl, rawDataUrl: dataUrl }
    setPages((prev) => [...prev, page])
    setEditingIndex(pages.length) // open editor for newly added page
  }

  const updatePage = (i: number, dataUrl: string) => {
    setPages((prev) => prev.map((p, idx) => (idx === i ? { ...p, dataUrl } : p)))
    setEditingIndex(null)
  }

  const deletePage = (i: number) => {
    setPages((prev) => prev.filter((_, idx) => idx !== i))
    setEditingIndex(null)
  }

  const reorderPages = (from: number, to: number) => {
    setPages((prev) => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
  }

  const proceed = () => {
    // Store pages in sessionStorage for the OCR step
    sessionStorage.setItem('scan_pages', JSON.stringify(pages.map((p) => ({ id: p.id, dataUrl: p.dataUrl }))))
    router.push('/scan/ocr')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quét chứng từ"
        description="Chụp hoặc tải ảnh chứng từ, chỉnh sửa từng trang, sau đó nhận dạng chữ tự động."
      />

      {/* Camera or file input */}
      {editingIndex === null && (
        <div className="flex flex-col gap-4">
          <CameraView onCapture={addPage} />
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">hoặc</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground transition hover:bg-muted/50">
            <ImagePlusIcon className="size-4" />
            Chọn ảnh từ máy
            <input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="sr-only"
              onChange={(e) => {
                Array.from(e.target.files ?? []).forEach((file) => {
                  const reader = new FileReader()
                  reader.onload = (ev) => addPage(ev.target!.result as string)
                  reader.readAsDataURL(file)
                })
                e.target.value = ''
              }}
            />
          </label>
        </div>
      )}

      {/* Per-page editor */}
      {editingIndex !== null && pages[editingIndex] && (
        <PageEditor
          dataUrl={pages[editingIndex].rawDataUrl}
          onSave={(url) => updatePage(editingIndex, url)}
          onCancel={() => setEditingIndex(null)}
        />
      )}

      {/* Thumbnail strip */}
      {pages.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{pages.length} trang đã chụp</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingIndex(null) }}
              className={cn(editingIndex !== null && 'hidden')}
            >
              <CameraIcon className="size-4" />
              Chụp thêm
            </Button>
          </div>
          <ThumbnailStrip
            pages={pages}
            editingIndex={editingIndex}
            onSelect={(i) => setEditingIndex(i)}
            onDelete={deletePage}
            onReorder={reorderPages}
          />
        </div>
      )}

      {/* Footer actions */}
      {pages.length > 0 && editingIndex === null && (
        <div className="flex justify-end">
          <Button onClick={proceed} size="lg">
            Tiếp tục: nhận dạng chữ
            <ArrowRightIcon className="ml-2 size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
