'use client'

import { useEffect, useRef, useState } from 'react'
import { CloudUploadIcon } from 'lucide-react'

export function GlobalDropzone({ onFiles, disabled }: { onFiles: (files: File[]) => void; disabled: boolean }) {
  const [active, setActive] = useState(false)
  const depth = useRef(0)

  useEffect(() => {
    if (disabled) return
    const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current += 1
      setActive(true)
    }
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setActive(false)
    }
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault()
    }
    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth.current = 0
      setActive(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length) onFiles(files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('dragover', onOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [disabled, onFiles])

  if (!active || disabled) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 p-6 backdrop-blur-[2px]">
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary bg-background px-10 py-8 text-center shadow-lg">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CloudUploadIcon className="size-7" />
        </div>
        <p className="text-lg font-semibold">Thả file để tải lên</p>
        <p className="text-sm text-muted-foreground">Hệ thống sẽ tự gợi ý loại chứng từ và lô hàng</p>
      </div>
    </div>
  )
}
