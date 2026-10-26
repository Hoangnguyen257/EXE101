'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  TableIcon,
  Undo2Icon,
  Redo2Icon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  DownloadIcon,
  SaveIcon,
  HistoryIcon,
  SearchIcon,
  XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SavedDocument, ScannedPage } from '@/lib/storage'
import { SaveDocDialog } from '@/components/editor/save-doc-dialog'

// ---------------------------------------------------------------------------
// Toolbar button helper
// ---------------------------------------------------------------------------
function TB({
  active,
  label,
  onClick,
  children,
}: {
  active?: boolean
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<button type="button" />} onClick={onClick} className={cn('flex size-8 items-center justify-center rounded transition hover:bg-muted', active && 'bg-muted text-primary')} aria-label={label}>
          {children}
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function Divider() {
  return <div className="mx-1 h-5 w-px bg-border" />
}

// ---------------------------------------------------------------------------
// Find & Replace mini panel
// ---------------------------------------------------------------------------
function FindReplace({ editor }: { editor: ReturnType<typeof useEditor> }) {
  const [find, setFind] = useState('')
  const [replace, setReplace] = useState('')
  if (!editor) return null

  const doReplace = () => {
    const html = editor.getHTML().replaceAll(find, replace)
    editor.commands.setContent(html)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 text-sm">
      <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
      <Input
        className="h-7 w-36 text-xs"
        placeholder="Tìm..."
        value={find}
        onChange={(e) => setFind(e.target.value)}
      />
      <Input
        className="h-7 w-36 text-xs"
        placeholder="Thay bằng..."
        value={replace}
        onChange={(e) => setReplace(e.target.value)}
      />
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={doReplace} disabled={!find}>
        Thay thế tất cả
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Version history drawer
// ---------------------------------------------------------------------------
function HistoryDrawer({
  open,
  onClose,
  history,
  onRestore,
}: {
  open: boolean
  onClose: () => void
  history: SavedDocument['history']
  onRestore: (html: string) => void
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-[380px]">
        <SheetHeader>
          <SheetTitle>Lịch sử phiên bản</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-3 overflow-y-auto">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">Chưa có phiên bản nào được lưu.</p>
          )}
          {history.map((h, i) => (
            <div key={i} className="rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{new Date(h.at).toLocaleString('vi-VN')}</span>
                <Button size="sm" variant="ghost" onClick={() => { onRestore(h.html); onClose() }}>
                  Khôi phục
                </Button>
              </div>
              <p className="mt-1 text-sm">{h.label}</p>
              <div
                className="prose prose-sm mt-2 max-h-32 overflow-hidden rounded border p-2 text-xs opacity-60"
                dangerouslySetInnerHTML={{ __html: h.html }}
              />
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Main shell
// ---------------------------------------------------------------------------
export function DocEditorShell({ docId }: { docId: string }) {
  const [pages, setPages] = useState<{ id: string } & ScannedPage[]>()
  const [previewPage, setPreviewPage] = useState<ScannedPage | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [showFindReplace, setShowFindReplace] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [history, setHistory] = useState<SavedDocument['history']>([])
  const [ocrPages, setOcrPages] = useState<(ScannedPage & { id: string })[]>([])
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load OCR results from session
  useEffect(() => {
    const raw = sessionStorage.getItem('ocr_results')
    if (raw) {
      const parsed: (ScannedPage & { id: string })[] = JSON.parse(raw)
      setOcrPages(parsed)
      if (parsed[0]) setPreviewPage(parsed[0])
    }
  }, [])

  const initialHtml = ocrPages.map((p) => `<p>${p.ocrText.replace(/\n/g, '</p><p>')}</p>`).join('<hr/>')

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialHtml || '<p>Bắt đầu soạn thảo...</p>',
    onUpdate: () => {
      // Autosave debounce
      if (autosaveRef.current) clearTimeout(autosaveRef.current)
      autosaveRef.current = setTimeout(autosave, 2000)
    },
  })

  // Re-set content when OCR data arrives
  useEffect(() => {
    if (!editor || ocrPages.length === 0) return
    const html = ocrPages.map((p) => `<p>${p.ocrText.replace(/\n/g, '</p><p>')}</p>`).join('<hr/>')
    editor.commands.setContent(html)
  }, [editor, ocrPages])

  const autosave = useCallback(() => {
    if (!editor) return
    setSavedAt(new Date())
    // Snapshot to history every autosave
    setHistory((h) => [
      { at: new Date().toISOString(), html: editor.getHTML(), label: 'Tự động lưu' },
      ...h.slice(0, 19),
    ])
  }, [editor])

  const exportDocx = async () => {
    if (!editor) return
    const { Document, Paragraph, TextRun, Packer } = await import('docx')
    const { saveAs } = await import('file-saver')
    const text = editor.getText()
    const doc = new Document({
      sections: [{ children: text.split('\n').map((line) => new Paragraph({ children: [new TextRun(line)] })) }],
    })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, 'chung-tu.docx')
  }

  const exportPdf = () => {
    if (!editor) return
    const win = window.open('', '_blank')!
    win.document.write(`<html><head><title>Chứng từ</title><style>body{font-family:serif;margin:40px;line-height:1.6}</style></head><body>${editor.getHTML()}</body></html>`)
    win.document.close()
    win.print()
  }

  if (!editor) return null

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-xl border shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b bg-card px-3 py-2">
        {/* Undo/Redo */}
        <TB label="Hoàn tác" onClick={() => editor.chain().focus().undo().run()}><Undo2Icon className="size-4" /></TB>
        <TB label="Làm lại" onClick={() => editor.chain().focus().redo().run()}><Redo2Icon className="size-4" /></TB>
        <Divider />
        {/* Headings */}
        <Select
          value={
            editor.isActive('heading', { level: 1 }) ? 'h1' :
            editor.isActive('heading', { level: 2 }) ? 'h2' :
            editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'
          }
          onValueChange={(v) => {
            if (!v) return
            if (v === 'p') editor.chain().focus().setParagraph().run()
            else editor.chain().focus().toggleHeading({ level: Number(v[1]) as 1|2|3 }).run()
          }}
        >
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="p">Đoạn văn</SelectItem>
              <SelectItem value="h1">Tiêu đề 1</SelectItem>
              <SelectItem value="h2">Tiêu đề 2</SelectItem>
              <SelectItem value="h3">Tiêu đề 3</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Divider />
        <TB label="Đậm" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><BoldIcon className="size-4" /></TB>
        <TB label="Nghiêng" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><ItalicIcon className="size-4" /></TB>
        <TB label="Gạch dưới" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="size-4" /></TB>
        <Divider />
        <TB label="Danh sách chấm" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="size-4" /></TB>
        <TB label="Danh sách số" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-4" /></TB>
        <Divider />
        <TB label="Căn trái" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="size-4" /></TB>
        <TB label="Căn giữa" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="size-4" /></TB>
        <TB label="Căn phải" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="size-4" /></TB>
        <TB label="Đều hai bên" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="size-4" /></TB>
        <Divider />
        <TB label="Chèn bảng" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="size-4" /></TB>
        <TB label="Tìm & thay" active={showFindReplace} onClick={() => setShowFindReplace((v) => !v)}><SearchIcon className="size-4" /></TB>
        <Divider />
        <div className="ml-auto flex items-center gap-1">
          <TB label="Lịch sử phiên bản" onClick={() => setShowHistory(true)}><HistoryIcon className="size-4" /></TB>
          <TB label={showSidebar ? 'Ẩn ảnh gốc' : 'Hiện ảnh gốc'} onClick={() => setShowSidebar((v) => !v)}>
            {showSidebar ? <PanelRightCloseIcon className="size-4" /> : <PanelRightOpenIcon className="size-4" />}
          </TB>
          <Divider />
          <Button size="sm" variant="outline" onClick={exportDocx}><DownloadIcon className="mr-1 size-3.5" />Word</Button>
          <Button size="sm" variant="outline" onClick={exportPdf}><DownloadIcon className="mr-1 size-3.5" />PDF</Button>
          <Button size="sm" onClick={() => setShowSaveDialog(true)}><SaveIcon className="mr-1 size-3.5" />Lưu chứng từ</Button>
        </div>
      </div>

      {/* Find & Replace */}
      {showFindReplace && <FindReplace editor={editor} />}

      {/* Body */}
      <div className="flex flex-1 overflow-hidden bg-neutral-100 dark:bg-neutral-900">
        {/* A4 editor area */}
        <div className="flex flex-1 flex-col items-center overflow-y-auto py-8">
          <div className="w-full max-w-[21cm]">
            {/* Autosave indicator */}
            <div className="mb-2 flex items-center justify-end gap-2">
              {savedAt && (
                <span className="text-xs text-muted-foreground">
                  Đã lưu lúc {savedAt.toLocaleTimeString('vi-VN')}
                </span>
              )}
            </div>
            <EditorContent
              editor={editor}
              className="min-h-[29.7cm] rounded-sm bg-white p-[2.54cm] shadow-lg ring-0 outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[25cm] dark:bg-neutral-800"
            />
          </div>
        </div>

        {/* Side panel: original scanned image */}
        {showSidebar && ocrPages.length > 0 && (
          <div className="flex w-64 shrink-0 flex-col border-l bg-card">
            <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">Ảnh gốc</div>
            <div className="flex-1 overflow-y-auto p-2">
              {ocrPages.map((p, i) => (
                <button
                  key={p.id}
                  onClick={() => setPreviewPage(p)}
                  className={cn(
                    'mb-2 w-full overflow-hidden rounded border-2 transition',
                    previewPage?.dataUrl === p.dataUrl ? 'border-primary' : 'border-transparent',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={`Trang ${i + 1}`} className="w-full" />
                  <p className="py-0.5 text-center text-xs text-muted-foreground">Trang {i + 1}</p>
                </button>
              ))}
            </div>
            {previewPage && (
              <div className="border-t p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewPage.dataUrl} alt="Xem trước" className="w-full rounded shadow" />
              </div>
            )}
          </div>
        )}
      </div>

      {/* History drawer */}
      <HistoryDrawer
        open={showHistory}
        onClose={() => setShowHistory(false)}
        history={history}
        onRestore={(html) => editor.commands.setContent(html)}
      />

      {/* Save dialog */}
      {showSaveDialog && (
        <SaveDocDialog
          html={editor.getHTML()}
          ocrPages={ocrPages}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  )
}
