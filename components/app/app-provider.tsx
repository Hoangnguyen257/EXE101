'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { SearchIndex, ShipmentWithProgress } from '@/lib/data'
import type { Customer, DocType, DocumentFile, User } from '@/lib/types'
import { CommandSearch } from './command-search'
import { UploadDialog } from './upload-dialog'
import { ShareDialog } from './share-dialog'
import { GlobalDropzone } from './global-dropzone'
import { OnboardingTour } from './onboarding-tour'

export interface UploadPreset {
  shipmentId?: string
  docType?: DocType
}

type SyncState = 'synced' | 'syncing'
type ShareTarget = Pick<DocumentFile, 'id' | 'title' | 'fileName'>

interface AppContextValue {
  currentUser: User
  users: User[]
  shipments: ShipmentWithProgress[]
  customers: Customer[]
  openSearch: () => void
  openUpload: (preset?: UploadPreset, files?: File[]) => void
  openShare: (doc: ShareTarget) => void
  startTour: () => void
  sync: SyncState
  markSyncing: () => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/** Alias that also exposes shipments & customers */
export const useAppContext = useApp

interface AppProviderProps {
  children: React.ReactNode
  searchIndex?: SearchIndex
  shipments?: ShipmentWithProgress[]
  customers?: Customer[]
  currentUser: User
  users?: User[]
}

export function AppProvider({
  children,
  searchIndex,
  shipments: initialShipments,
  customers: initialCustomers,
  currentUser,
  users = [],
}: AppProviderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [shipmentsList, setShipmentsList] = useState<ShipmentWithProgress[]>(initialShipments || [])
  const [customersList, setCustomersList] = useState<Customer[]>(initialCustomers || [])
  const [upload, setUpload] = useState<{ open: boolean; preset?: UploadPreset; files?: File[]; key: number }>({
    open: false,
    key: 0,
  })
  const [shareDoc, setShareDoc] = useState<ShareTarget | null>(null)
  const [sync, setSync] = useState<SyncState>('synced')
  const [tourRun, setTourRun] = useState(0)

  // Nạp danh sách lô hàng & khách hàng theo yêu cầu (on-demand) khi mở hộp thoại Tải lên
  useEffect(() => {
    if (upload.open && shipmentsList.length === 0) {
      fetch('/api/shipments?limit=100')
        .then((res) => (res.ok ? res.json() : { shipments: [] }))
        .then((data) => {
          if (Array.isArray(data.shipments)) {
            setShipmentsList(data.shipments)
          }
        })
        .catch(() => {})
    }
    if (upload.open && customersList.length === 0) {
      fetch('/api/customers')
        .then((res) => (res.ok ? res.json() : { customers: [] }))
        .then((data) => {
          if (Array.isArray(data.customers)) {
            setCustomersList(data.customers)
          }
        })
        .catch(() => {})
    }
  }, [upload.open, shipmentsList.length, customersList.length])

  const markSyncing = useCallback(() => {
    setSync('syncing')
    window.setTimeout(() => setSync('synced'), 1200)
  }, [])

  // Real-time multi-device synchronization via Server-Sent Events (SSE)
  useEffect(() => {
    if (typeof window === 'undefined') return
    let es: EventSource | null = null

    try {
      es = new EventSource('/api/sync/events')

      es.addEventListener('sync', (e) => {
        try {
          const data = JSON.parse(e.data)
          setSync('syncing')
          if (data.eventType === 'DOCUMENT_CREATED') {
            toast.info(`Có chứng từ mới tải lên: ${data.payload.title || ''}`, {
              description: 'Dữ liệu hệ thống đã được đồng bộ tự động.',
            })
          }
          window.setTimeout(() => setSync('synced'), 1200)
        } catch {
          // ignore
        }
      })

      es.onerror = () => {
        // Fallback or retry
      }
    } catch {
      // Fallback
    }

    return () => {
      es?.close()
    }
  }, [])

  const openUpload = useCallback((preset?: UploadPreset, files?: File[]) => {
    setUpload((u) => ({ open: true, preset, files, key: u.key + 1 }))
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      users,
      shipments: shipmentsList,
      customers: customersList,
      openSearch: () => setSearchOpen(true),
      openUpload,
      openShare: setShareDoc,
      startTour: () => setTourRun((n) => n + 1),
      sync,
      markSyncing,
    }),
    [currentUser, users, shipmentsList, customersList, openUpload, sync, markSyncing],
  )

  return (
    <AppContext.Provider value={value}>
      {children}
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} index={searchIndex} />
      <UploadDialog
        key={upload.key}
        open={upload.open}
        onOpenChange={(open) => setUpload((u) => ({ ...u, open }))}
        preset={upload.preset}
        initialFiles={upload.files}
        shipments={shipmentsList}
        customers={customersList}
        onUploaded={markSyncing}
      />
      <ShareDialog doc={shareDoc} onOpenChange={(open) => !open && setShareDoc(null)} />
      <GlobalDropzone onFiles={(files) => openUpload(undefined, files)} disabled={upload.open} />
      <OnboardingTour forceRun={tourRun} />
    </AppContext.Provider>
  )
}
