/**
 * IndexedDB storage layer for scanned documents.
 * Can be swapped for Supabase by replacing the functions below.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { DocType } from './types'

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
export interface ScannedPage {
  /** data-URL (image/jpeg) of the captured image */
  dataUrl: string
  /** Raw OCR text */
  ocrText: string
  /** Per-word confidence data from tesseract */
  words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[]
}

export interface SavedDocument {
  id: string
  shipmentId: string
  customerId: string
  type: DocType
  title: string
  docDate: string
  archiveBoxId?: string
  retentionUntil?: string
  pages: ScannedPage[]
  /** Rich-text HTML content (edited via Tiptap) */
  editedHtml: string
  /** Snapshot history */
  history: { at: string; html: string; label: string }[]
  createdAt: string
  updatedAt: string
  /** Actions for local audit trail */
  auditLog: { action: 'create' | 'edit' | 'export'; at: string; note?: string }[]
}

interface DocDB extends DBSchema {
  documents: { key: string; value: SavedDocument; indexes: { byShipment: string; byType: string } }
}

// ---------------------------------------------------------------------------
// DB singleton
// ---------------------------------------------------------------------------
let _db: IDBPDatabase<DocDB> | null = null

async function db(): Promise<IDBPDatabase<DocDB>> {
  if (_db) return _db
  _db = await openDB<DocDB>('tml-docs', 1, {
    upgrade(d) {
      const store = d.createObjectStore('documents', { keyPath: 'id' })
      store.createIndex('byShipment', 'shipmentId')
      store.createIndex('byType', 'type')
    },
  })
  return _db
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export async function saveDocument(doc: SavedDocument): Promise<void> {
  const d = await db()
  await d.put('documents', doc)
}

export async function getDocument(id: string): Promise<SavedDocument | undefined> {
  return (await db()).get('documents', id)
}

export async function listDocuments(): Promise<SavedDocument[]> {
  return (await db()).getAll('documents')
}

export async function deleteDocument(id: string): Promise<void> {
  await (await db()).delete('documents', id)
}

export function newDocId(): string {
  return `sdoc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export async function appendAudit(
  id: string,
  action: 'create' | 'edit' | 'export',
  note?: string,
): Promise<void> {
  const d = await db()
  const doc = await d.get('documents', id)
  if (!doc) return
  doc.auditLog.push({ action, at: new Date().toISOString(), note })
  doc.updatedAt = new Date().toISOString()
  await d.put('documents', doc)
}
