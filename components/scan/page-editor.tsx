'use client'

import { useEffect, useRef, useState } from 'react'
import { RotateCwIcon, CheckIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Filter = 'original' | 'contrast' | 'bw'

const FILTER_LABEL: Record<Filter, string> = {
  original: 'Gốc',
  contrast: 'Tăng tương phản',
  bw: 'Đen trắng',
}

/** Applies filter to canvas context */
function applyFilter(ctx: CanvasRenderingContext2D, w: number, h: number, filter: Filter) {
  if (filter === 'original') return
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    if (filter === 'bw') {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = gray
    } else if (filter === 'contrast') {
      const factor = 1.5
      d[i] = Math.min(255, Math.max(0, factor * (d[i] - 128) + 128))
      d[i + 1] = Math.min(255, Math.max(0, factor * (d[i + 1] - 128) + 128))
      d[i + 2] = Math.min(255, Math.max(0, factor * (d[i + 2] - 128) + 128))
    }
  }
  ctx.putImageData(img, 0, 0)
}

type Corner = 'tl' | 'tr' | 'bl' | 'br'

interface Corners {
  tl: [number, number]
  tr: [number, number]
  bl: [number, number]
  br: [number, number]
}

export function PageEditor({
  dataUrl,
  onSave,
  onCancel,
}: {
  dataUrl: string
  onSave: (url: string) => void
  onCancel: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState(0)
  const [filter, setFilter] = useState<Filter>('original')
  const [corners, setCorners] = useState<Corners | null>(null)
  const [dragging, setDragging] = useState<Corner | null>(null)
  const [displaySize, setDisplaySize] = useState({ w: 0, h: 0 })
  const naturalRef = useRef({ w: 0, h: 0 })
  const imgRef = useRef<HTMLImageElement | null>(null)

  // Load image + draw on canvas
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      naturalRef.current = { w: img.naturalWidth, h: img.naturalHeight }
      redraw()
    }
    img.src = dataUrl
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataUrl, rotation, filter])

  const redraw = () => {
    const img = imgRef.current
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!img || !canvas || !container) return

    const maxW = container.clientWidth
    const radians = (rotation * Math.PI) / 180
    const sw = Math.abs(img.naturalWidth * Math.cos(radians)) + Math.abs(img.naturalHeight * Math.sin(radians))
    const sh = Math.abs(img.naturalWidth * Math.sin(radians)) + Math.abs(img.naturalHeight * Math.cos(radians))
    const scale = Math.min(1, maxW / sw)
    const dw = Math.round(sw * scale)
    const dh = Math.round(sh * scale)

    canvas.width = dw
    canvas.height = dh
    setDisplaySize({ w: dw, h: dh })

    const ctx = canvas.getContext('2d')!
    ctx.save()
    ctx.translate(dw / 2, dh / 2)
    ctx.rotate(radians)
    ctx.drawImage(img, -img.naturalWidth / 2 * scale, -img.naturalHeight / 2 * scale, img.naturalWidth * scale, img.naturalHeight * scale)
    ctx.restore()
    applyFilter(ctx, dw, dh, filter)

    if (!corners) {
      const margin = 20
      setCorners({ tl: [margin, margin], tr: [dw - margin, margin], bl: [margin, dh - margin], br: [dw - margin, dh - margin] })
    }
  }

  useEffect(() => { redraw() }, [rotation, filter])

  const rotate = () => { setRotation((r) => (r + 90) % 360) }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !canvasRef.current) return
    const rect = canvasRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(displaySize.w, e.clientX - rect.left))
    const y = Math.max(0, Math.min(displaySize.h, e.clientY - rect.top))
    setCorners((c) => c ? { ...c, [dragging]: [x, y] } : c)
  }

  const save = () => {
    // Apply perspective crop via canvas, then return dataUrl
    const canvas = canvasRef.current
    if (!canvas) return
    // Simple bounding-box crop for now
    const c = corners ?? { tl: [0, 0], tr: [displaySize.w, 0], bl: [0, displaySize.h], br: [displaySize.w, displaySize.h] }
    const minX = Math.min(c.tl[0], c.bl[0])
    const minY = Math.min(c.tl[1], c.tr[1])
    const maxX = Math.max(c.tr[0], c.br[0])
    const maxY = Math.max(c.bl[1], c.br[1])
    const out = document.createElement('canvas')
    out.width = maxX - minX
    out.height = maxY - minY
    out.getContext('2d')!.drawImage(canvas, minX, minY, out.width, out.height, 0, 0, out.width, out.height)
    onSave(out.toDataURL('image/jpeg', 0.92))
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-muted/30 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">Chỉnh sửa trang</span>
        <div className="ml-auto flex gap-2">
          {/* Filter toggle */}
          {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f)}
            >
              {FILTER_LABEL[f]}
            </Button>
          ))}
          <Button variant="outline" size="icon" onClick={rotate} aria-label="Xoay 90°">
            <RotateCwIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Canvas with draggable corners */}
      <div
        ref={containerRef}
        className="relative select-none overflow-hidden rounded-lg"
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(null)}
        onMouseLeave={() => setDragging(null)}
      >
        <canvas ref={canvasRef} className="block w-full" />
        {/* Crop overlay */}
        {corners && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            <polygon
              points={`${corners.tl[0]},${corners.tl[1]} ${corners.tr[0]},${corners.tr[1]} ${corners.br[0]},${corners.br[1]} ${corners.bl[0]},${corners.bl[1]}`}
              fill="rgba(59,130,246,0.1)"
              stroke="#3b82f6"
              strokeWidth={1.5}
            />
          </svg>
        )}
        {corners && (Object.entries(corners) as [Corner, [number, number]][]).map(([key, [x, y]]) => (
          <div
            key={key}
            className="pointer-events-auto absolute size-5 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full border-2 border-blue-500 bg-white shadow"
            style={{ left: x, top: y }}
            onMouseDown={(e) => { e.preventDefault(); setDragging(key) }}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          <XIcon className="size-4" /> Hủy
        </Button>
        <Button onClick={save}>
          <CheckIcon className="size-4" /> Lưu trang
        </Button>
      </div>
    </div>
  )
}
