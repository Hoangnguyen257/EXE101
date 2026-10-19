'use client'

import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const STORAGE_KEY = 'tml-onboarding-done'

const STEPS = [
  {
    target: null,
    title: 'Chào mừng đến TML DocManager',
    body: 'Mọi chứng từ của lô hàng ở một nơi — giống thư mục Google Drive bạn đã quen, nhưng hiểu được B/L, Invoice và Packing List.',
  },
  {
    target: 'search',
    title: 'Tìm mọi thứ với ⌘K',
    body: 'Gõ số Job, số Bill, tên khách hàng hoặc bất kỳ chữ nào trong file PDF. Gõ sai chính tả hoặc không dấu vẫn tìm được.',
  },
  {
    target: 'upload',
    title: 'Kéo thả để tải lên',
    body: 'Kéo file vào bất kỳ đâu trên màn hình. Hệ thống tự gợi ý loại chứng từ và gán vào đúng lô hàng.',
  },
  {
    target: 'nav-shipments',
    title: 'Theo dõi lô hàng',
    body: 'Mỗi lô hàng có danh sách chứng từ bắt buộc. Thanh tiến độ cho biết còn thiếu gì trước khi giao hàng.',
  },
  {
    target: 'sync',
    title: 'Luôn được đồng bộ',
    body: 'Biểu tượng này cho biết dữ liệu đã lưu an toàn trên đám mây. Bạn có thể xem lại hướng dẫn trong menu tài khoản.',
  },
] as const

type Rect = { top: number; left: number; width: number; height: number }

export function OnboardingTour({ forceRun }: { forceRun: number }) {
  const [step, setStep] = useState<number | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)

  useEffect(() => {
    if (forceRun > 0) {
      setStep(0)
      return
    }
    if (!window.localStorage.getItem(STORAGE_KEY)) {
      const t = window.setTimeout(() => setStep(0), 800)
      return () => window.clearTimeout(t)
    }
  }, [forceRun])

  const measure = useCallback(() => {
    if (step === null) return
    const target = STEPS[step].target
    const el = target
      ? Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)).find((n) => n.offsetParent !== null)
      : null
    if (!el) return setRect(null)
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }, [step])

  useLayoutEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  if (step === null) return null

  const finish = () => {
    window.localStorage.setItem(STORAGE_KEY, '1')
    setStep(null)
  }
  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  const pad = 6
  const cardWidth = 340
  const cardStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: Math.min(rect.top + rect.height + 14, window.innerHeight - 220),
        left: Math.max(12, Math.min(rect.left, window.innerWidth - cardWidth - 12)),
        width: cardWidth,
      }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: cardWidth }

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none fixed rounded-lg ring-2 ring-primary transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: '0 0 0 9999px color-mix(in oklch, var(--foreground) 45%, transparent)',
          }}
        />
      ) : (
        <div aria-hidden className="fixed inset-0 bg-foreground/45" />
      )}
      <Card style={cardStyle} className="max-w-[calc(100vw-24px)] shadow-xl">
        <CardHeader>
          <CardTitle id="tour-title">{current.title}</CardTitle>
          <CardDescription className="leading-relaxed">{current.body}</CardDescription>
          <CardAction>
            <Button variant="ghost" size="icon-sm" onClick={finish} aria-label="Bỏ qua hướng dẫn">
              <XIcon />
            </Button>
          </CardAction>
        </CardHeader>
        <CardFooter className="justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {step + 1} / {STEPS.length}
          </span>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
                Quay lại
              </Button>
            )}
            <Button size="sm" onClick={() => (isLast ? finish() : setStep(step + 1))} autoFocus>
              {isLast ? 'Bắt đầu sử dụng' : step === 0 ? 'Xem hướng dẫn' : 'Tiếp'}
            </Button>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
