'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
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

interface AppProviderProps {
  children: React.ReactNode
  searchIndex: SearchIndex
  shipments: ShipmentWithProgress[]
  customers: Customer[]
  currentUser: User
  users: User[]
}

export function AppProvider({ children, searchIndex, shipments, customers, currentUser, users }: AppProviderProps) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [upload, setUpload] = useState<{ open: boolean; preset?: UploadPreset; files?: File[]; key: number }>({
    open: false,
    key: 0,
  })
  const [shareDoc, setShareDoc] = useState<ShareTarget | null>(null)
  const [sync, setSync] = useState<SyncState>('synced')
  const [tourRun, setTourRun] = useState(0)

  const markSyncing = useCallback(() => {
    setSync('syncing')
    window.setTimeout(() => setSync('synced'), 2200)
  }, [])

  const openUpload = useCallback((preset?: UploadPreset, files?: File[]) => {
    setUpload((u) => ({ open: true, preset, files, key: u.key + 1 }))
  }, [])

  const value = useMemo<AppContextValue>(
    () => ({
      currentUser,
      users,
      openSearch: () => setSearchOpen(true),
      openUpload,
      openShare: setShareDoc,
      startTour: () => setTourRun((n) => n + 1),
      sync,
      markSyncing,
    }),
    [currentUser, users, openUpload, sync, markSyncing],
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
        shipments={shipments}
        customers={customers}
        onUploaded={markSyncing}
      />
      <ShareDialog doc={shareDoc} onOpenChange={(open) => !open && setShareDoc(null)} />
      <GlobalDropzone onFiles={(files) => openUpload(undefined, files)} disabled={upload.open} />
      <OnboardingTour forceRun={tourRun} />
    </AppContext.Provider>
  )
}
