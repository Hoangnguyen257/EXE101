'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CameraIcon,
  CameraOffIcon,
  FlipHorizontalIcon,
  ImagePlusIcon,
  TrashIcon,
  ArrowRightIcon,
  GripVerticalIcon,
  ShieldCheckIcon,
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
export function CameraView({
  onCapture,
}: {
  onCapture: (dataUrl: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<CameraError>(null)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  // Hàm dừng toàn bộ tracks MediaStream một cách triệt để
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsActive(false)
  }, [])

  // Chỉ xin quyền và khởi động camera khi người dùng chủ động bấm Bật
  const startCamera = useCallback(async (mode: 'environment' | 'user') => {
    // Dừng luồng cũ trước khi tạo luồng mới
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop()
        } catch {}
      })
      streamRef.current = null
    }

    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      })
      streamRef.current = s
      if (videoRef.current) {
        videoRef.current.srcObject = s
      }
      setIsActive(true)
      setError(null)
    } catch (e: unknown) {
      const err = e as { name?: string }
      setError(err?.name === 'NotAllowedError' ? 'denied' : 'unavailable')
      stopCamera()
    }
  }, [stopCamera])

  // Cleanup khi unmount (rời trang, chuyển route)
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Lắng nghe visibilitychange: Tắt camera ngay lập tức khi đổi tab hoặc thu nhỏ ứng dụng
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopCamera()
      }
    }
    const handlePageHide = () => {
      stopCamera()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handlePageHide)
    window.addEventListener('beforeunload', handlePageHide)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handlePageHide)
    }
  }, [stopCamera])

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(nextMode)
    if (isActive) {
      startCamera(nextMode)
    }
  }

  const capture = () => {
    if (!videoRef.current) return
    const v = videoRef.current
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth || 1280
    canvas.height = v.videoHeight || 720
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
        <Button variant="outline" size="sm" onClick={() => startCamera(facingMode)}>
          Thử lại
        </Button>
      </div>
    )
  }

  if (!isActive) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-muted/20 p-10 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CameraIcon className="size-7" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-base">Camera đang tắt để bảo vệ quyền riêng tư</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Hệ thống chỉ bật máy ảnh khi bạn cho phép và sẽ tự động tắt ngay khi bạn chuyển tab hoặc rời trang.
          </p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Button onClick={() => startCamera(facingMode)} className="gap-2">
            <CameraIcon className="size-4" />
            Bật camera để chụp
          </Button>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 pt-1">
          <ShieldCheckIcon className="size-3.5 text-emerald-500" />
          Dữ liệu xử lý cục bộ trên trình duyệt · Không gửi hình ảnh trực tiếp lên máy chủ
        </div>
      </div>
    )
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-inner">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />

      {/* Khung tài liệu định hướng */}
      <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-white/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />

      {/* Điều khiển trên đầu: Nút tắt camera nhanh */}
      <div className="absolute top-4 right-4 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={stopCamera}
          className="bg-black/60 text-white hover:bg-black/80 gap-1.5 text-xs backdrop-blur"
        >
          <CameraOffIcon className="size-3.5" />
          Tắt camera
        </Button>
      </div>

      {/* Điều khiển dưới đáy: Đổi cam & Chụp */}
      <div className="absolute bottom-4 left-0 right-0 flex items-center justify-center gap-6 z-10">
        <Button
          variant="secondary"
          size="icon"
          className="size-10 rounded-full opacity-80"
          onClick={toggleFacingMode}
          aria-label="Đổi camera trước/sau"
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
          onDragStart={() => {
            dragRef.current = i
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            if (dragRef.current !== null && dragRef.current !== i) {
              onReorder(dragRef.current, i)
            }
          }}
          className={cn(
            'group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition',
            editingIndex === i ? 'border-primary' : 'border-transparent'
          )}
          style={{ width: 80, height: 100 }}
          onClick={() => onSelect(i)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.dataUrl} alt={`Trang ${i + 1}`} className="h-full w-full object-cover" />
          <span className="absolute bottom-0.5 left-0 right-0 text-center text-[10px] font-medium text-white drop-shadow">
            {i + 1}
          </span>
          <GripVerticalIcon className="absolute left-0.5 top-0.5 size-3 text-white/70 opacity-0 group-hover:opacity-100" />
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(i)
            }}
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
// Main ScanContent
// ---------------------------------------------------------------------------
export function ScanContent() {
  const router = useRouter()
  const [pages, setPages] = useState<CapturedPage[]>([])
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const addPage = (dataUrl: string) => {
    const page: CapturedPage = { id: makeid(), dataUrl, rawDataUrl: dataUrl }
    setPages((prev) => [...prev, page])
    setEditingIndex(pages.length) // Mở editor cho trang mới thêm
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
    // Lưu các trang vào sessionStorage cho bước nhận dạng chữ (OCR)
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
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground">
            <ImagePlusIcon className="size-4 text-primary" />
            Chọn ảnh từ thư viện thiết bị
            <input
              type="file"
              accept="image/*"
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
              onClick={() => {
                setEditingIndex(null)
              }}
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
