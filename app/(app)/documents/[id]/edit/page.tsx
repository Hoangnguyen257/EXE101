import type { Metadata } from 'next'
import { DocEditorShell } from '@/components/editor/doc-editor-shell'

export const metadata: Metadata = { title: 'Soạn thảo chứng từ' }

export default async function DocEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <DocEditorShell docId={id} />
}
