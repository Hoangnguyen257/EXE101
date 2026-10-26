'use client'

import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileTextIcon, PackageIcon, ScanLineIcon, ScanTextIcon, SearchXIcon, SparklesIcon } from 'lucide-react'
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Badge } from '@/components/ui/badge'
import { Kbd } from '@/components/ui/kbd'
import type { SearchIndex } from '@/lib/data'
import { search, type SearchScope, normalize } from '@/lib/search'
import type { SavedDocument } from '@/lib/storage'

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'job', label: 'Số Job' },
  { value: 'bill', label: 'Số Bill' },
  { value: 'customer', label: 'Khách hàng' },
  { value: 'content', label: 'Nội dung PDF (OCR)' },
]

const MATCH_LABEL: Record<SearchScope, string> = {
  all: '',
  job: 'Job',
  bill: 'Bill',
  customer: 'Khách hàng',
  content: 'OCR',
}

const TYPO_EXAMPLE = 'pangasus filet'
const SUGGESTIONS = ['TML-SE2610-0142', 'HLCUSGN', 'Phuong Nam', 'robusta coffee', TYPO_EXAMPLE]

export function CommandSearch({
  open,
  onOpenChange,
  index,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  index: SearchIndex
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<SearchScope>('all')
  const deferredQuery = useDeferredValue(query)
  const [idbDocs, setIdbDocs] = useState<SavedDocument[]>([])

  // Load scanned documents from IndexedDB on open
  useEffect(() => {
    if (!open) return
    import('@/lib/storage').then(({ listDocuments }) => listDocuments().then(setIdbDocs))
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  const hits = useMemo(() => search(index, deferredQuery, scope), [index, deferredQuery, scope])
  const shipmentHits = hits.filter((h) => h.kind === 'shipment')
  const documentHits = hits.filter((h) => h.kind === 'document')

  // Search IDB documents (client-side)
  const idbHits = useMemo(() => {
    if (!deferredQuery) return []
    const tokens = normalize(deferredQuery).split(/\s+/).filter(Boolean)
    return idbDocs.filter((d) => {
      const corpus = normalize(`${d.title} ${d.pages.map((p) => p.ocrText).join(' ')}`)
      return tokens.every((t) => corpus.includes(t))
    }).slice(0, 6)
  }, [deferredQuery, idbDocs])

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Tìm kiếm chứng từ"
      description="Tìm theo số Job, số Bill, khách hàng hoặc nội dung PDF"
      className="sm:max-w-2xl"
    >
      <Command shouldFilter={false}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Tìm số Job, số Bill, khách hàng, nội dung PDF..."
          aria-label="Từ khóa tìm kiếm"
        />
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
          <ToggleGroup
            value={[scope]}
            onValueChange={(v) => v[0] && setScope(v[0] as SearchScope)}
            variant="outline"
            size="sm"
            spacing={1}
            aria-label="Phạm vi tìm kiếm"
            className="flex-wrap"
          >
            {SCOPES.map((s) => (
              <ToggleGroupItem key={s.value} value={s.value} className="rounded-full px-3 text-xs">
                {s.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <CommandList className="max-h-[min(60vh,28rem)]">
          {!deferredQuery ? (
            <CommandGroup heading="Gợi ý tìm kiếm">
              {SUGGESTIONS.map((s) => (
                <CommandItem key={s} value={s} onSelect={() => setQuery(s)}>
                  <SparklesIcon className="text-muted-foreground" />
                  <span>{s}</span>
                  {s === TYPO_EXAMPLE && (
                    <Badge variant="secondary" className="ml-auto">
                      Gõ sai vẫn tìm được
                    </Badge>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : (
            <>
              <CommandEmpty>
                <div className="flex flex-col items-center gap-2 py-4 text-muted-foreground">
                  <SearchXIcon className="size-6" />
                  <p className="text-sm">{`Không tìm thấy kết quả cho "${deferredQuery}"`}</p>
                  <p className="text-xs">Thử bỏ dấu, rút gọn từ khóa hoặc chọn phạm vi “Tất cả”.</p>
                </div>
              </CommandEmpty>
              {shipmentHits.length > 0 && (
                <CommandGroup heading="Lô hàng">
                  {shipmentHits.map((h) => (
                    <CommandItem key={h.id} value={h.id} onSelect={() => go(h.href)}>
                      <PackageIcon className="text-primary" />
                      <div className="flex min-w-0 flex-col">
                        <span className="font-medium">{h.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                      </div>
                      <Badge variant="outline" className="ml-auto">
                        {MATCH_LABEL[h.matchedIn]}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {documentHits.length > 0 && (
                <CommandGroup heading="Chứng từ">
                  {documentHits.map((h) => (
                    <CommandItem key={h.id} value={h.id} onSelect={() => go(h.href)} className="items-start">
                      {h.matchedIn === 'content' ? (
                        <ScanTextIcon className="mt-0.5 text-primary" />
                      ) : (
                        <FileTextIcon className="mt-0.5 text-primary" />
                      )}
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-medium">{h.title}</span>
                        <span className="truncate text-xs text-muted-foreground">{h.subtitle}</span>
                        {h.snippet && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {h.snippet.before}
                            <mark className="rounded-sm bg-primary/15 px-0.5 font-medium text-foreground">
                              {h.snippet.match}
                            </mark>
                            {h.snippet.after}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="ml-auto shrink-0">
                        {MATCH_LABEL[h.matchedIn]}
                      </Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {idbHits.length > 0 && (
                <CommandGroup heading="Chứng từ đã quét">
                  {idbHits.map((d) => (
                    <CommandItem key={d.id} value={d.id} onSelect={() => go(`/documents/${d.id}/edit`)} className="items-start">
                      <ScanLineIcon className="mt-0.5 text-primary" />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate font-medium">{d.title}</span>
                        <span className="truncate text-xs text-muted-foreground">Lưu trên thiết bị · {d.pages.length} trang</span>
                      </div>
                      <Badge variant="secondary" className="ml-auto shrink-0">Quét</Badge>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
          <span>Hỗ trợ tìm không dấu và chịu lỗi chính tả</span>
          <span className="hidden items-center gap-1 sm:flex">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> di chuyển · <Kbd>Enter</Kbd> mở · <Kbd>Esc</Kbd> đóng
          </span>
        </div>
      </Command>
    </CommandDialog>
  )
}
