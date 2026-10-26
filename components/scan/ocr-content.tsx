'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2Icon, XCircleIcon, ArrowRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PageHeader } from '@/components/app/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ScannedPage } from '@/lib/storage'

type OcrPage = {
  id: string
  dataUrl: string
  status: 'pending' | 'running' | 'done' | 'cancelled'
  progress: number
  result: ScannedPage | null
}

type Word = ScannedPage['words'][0]

// ---------------------------------------------------------------------------
// Result panel: split view image + text
// ---------------------------------------------------------------------------
function ResultPanel({ page }: { page: OcrPage }) {
  const [hovered, setHovered] = useState<Word | null>(null)
  if (!page.result) return null
  const { dataUrl, words, ocrText } = page.result

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Image side */}
      <div className="relative overflow-hidden rounded-lg border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dataUrl} alt="Trang quét" className="block w-full" id={`ocr-img-${page.id}`} />
        {hovered && (() => {
          const img = typeof document !== 'undefined' ? document.getElementById(`ocr-img-${page.id}`) as HTMLImageElement | null : null
          const naturalW = img?.naturalWidth ?? 1
          const naturalH = img?.naturalHeight ?? 1
          const displayW = img?.width ?? 1
          const displayH = img?.height ?? 1
          const sx = displayW / naturalW
          const sy = displayH / naturalH
          const { x0, y0, x1, y1 } = hovered.bbox
          return (
            <div
              className="pointer-events-none absolute rounded border-2 border-yellow-400 bg-yellow-300/30"
              style={{ left: x0 * sx, top: y0 * sy, width: (x1 - x0) * sx, height: (y1 - y0) * sy }}
            />
          )
        })()}
      </div>
      {/* Text side */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted-foreground">
          Ảnh được xử lý ngay trên trình duyệt của bạn, không gửi lên máy chủ.
        </p>
        <div className="flex-1 overflow-y-auto rounded-lg border bg-background p-3 font-mono text-sm leading-relaxed">
          {words.map((w, i) => (
            <span
              key={i}
              className={cn(
                'cursor-pointer rounded px-0.5 transition-colors hover:bg-yellow-200',
                w.confidence < 70 && 'bg-yellow-100 text-yellow-800',
              )}
              onMouseEnter={() => setHovered(w)}
              onMouseLeave={() => setHovered(null)}
            >
              {w.text}{' '}
            </span>
          ))}
          {words.length === 0 && <span className="text-muted-foreground">{ocrText}</span>}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function OcrContent() {
  const router = useRouter()
  const [pages, setPages] = useState<OcrPage[]>([])
  const [currentPage, setCurrentPage] = useState(0)
  const cancelledRef = useRef(false)

  useEffect(() => {
    const raw = sessionStorage.getItem('scan_pages')
    if (!raw) { router.replace('/scan'); return }
    const parsed: { id: string; dataUrl: string }[] = JSON.parse(raw)
    setPages(parsed.map((p) => ({ id: p.id, dataUrl: p.dataUrl, status: 'pending', progress: 0, result: null })))
  }, [router])

  useEffect(() => {
    if (pages.length === 0) return
    runOcr()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.length])

  const runOcr = async () => {
    const { createWorker } = await import('tesseract.js')
    for (let i = 0; i < pages.length; i++) {
      if (cancelledRef.current) {
        setPages((prev) => prev.map((p, idx) => idx >= i ? { ...p, status: 'cancelled' } : p))
        break
      }
      setCurrentPage(i)
      setPages((prev) => prev.map((p, idx) => idx === i ? { ...p, status: 'running', progress: 0 } : p))
      const worker = await createWorker('vie+eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setPages((prev) => prev.map((p, idx) => idx === i ? { ...p, progress: Math.round(m.progress * 100) } : p))
          }
        },
      })
      const { data } = await worker.recognize(pages[i].dataUrl)
      await worker.terminate()
      type TWord = { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }
      // tesseract.js v4+ places words on each line; fall back gracefully
      const allLines = (data as unknown as { lines: { words: TWord[] }[] }).lines ?? []
      const rawWords: TWord[] = allLines.flatMap((l) => l.words ?? [])
      const words: ScannedPage['words'] = rawWords.map((w) => ({
        text: w.text,
        confidence: w.confidence,
        bbox: w.bbox,
      }))
      setPages((prev) =>
        prev.map((p, idx) =>
          idx === i
            ? {
                ...p,
                status: 'done',
                progress: 100,
                result: { dataUrl: p.dataUrl, ocrText: data.text, words },
              }
            : p,
        ),
      )
    }
  }

  const cancel = () => { cancelledRef.current = true }

  const openEditor = () => {
    // Store OCR results for the editor
    const results = pages.filter((p) => p.result).map((p) => ({ id: p.id, ...p.result! }))
    sessionStorage.setItem('ocr_results', JSON.stringify(results))
    // Navigate to a new doc (use placeholder ID for now)
    router.push('/documents/new/edit')
  }

  const allDone = pages.every((p) => p.status === 'done' || p.status === 'cancelled')
  const running = pages.some((p) => p.status === 'running')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nhận dạng chữ (OCR)" description="Tesseract.js phân tích ảnh ngay trên trình duyệt — không gửi dữ liệu ra ngoài." />

      {/* Progress list */}
      <div className="flex flex-col gap-3">
        {pages.map((p, i) => (
          <div key={p.id} className="flex flex-col gap-1.5 rounded-lg border p-4">
            <div className="flex items-center gap-3">
              {p.status === 'done' && <CheckCircle2Icon className="size-5 shrink-0 text-success" />}
              {p.status === 'cancelled' && <XCircleIcon className="size-5 shrink-0 text-destructive" />}
              {(p.status === 'pending' || p.status === 'running') && (
                <div className="size-5 shrink-0 rounded-full border-2 border-muted-foreground/30" />
              )}
              <span className="text-sm font-medium">Trang {i + 1}</span>
              {p.status === 'running' && <span className="ml-auto text-xs text-muted-foreground">{p.progress}%</span>}
              {p.status === 'done' && <span className="ml-auto text-xs text-success">Hoàn thành</span>}
            </div>
            {p.status === 'running' && <Progress value={p.progress} className="h-1.5" />}
            {p.status === 'done' && p.result && (
              <ResultPanel page={p} />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        {running && (
          <Button variant="outline" onClick={cancel}>
            Hủy nhận dạng
          </Button>
        )}
        {allDone && (
          <Button onClick={openEditor} className="ml-auto">
            Mở trong trình soạn thảo
            <ArrowRightIcon className="ml-2 size-4" />
          </Button>
        )}
      </div>
    </div>
  )
}
