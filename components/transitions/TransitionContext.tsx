'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { LogoutExperience } from './logout/LogoutExperience'

interface TransitionContextType {
  isLoggingOut: boolean
  startLogout: () => Promise<void>
}

const TransitionContext = createContext<TransitionContextType>({
  isLoggingOut: false,
  startLogout: async () => {},
})

export function useTransitionContext() {
  return useContext(TransitionContext)
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const startLogout = useCallback(async () => {
    setIsLoggingOut(true)
    try {
      // Gọi API logout ở backend ngay lập tức để hủy session bảo mật
      await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    } catch {
      // Phòng vệ nếu mạng lỗi
    }
  }, [])

  return (
    <TransitionContext.Provider value={{ isLoggingOut, startLogout }}>
      {children}
      {isLoggingOut && <LogoutExperience onComplete={() => window.location.replace('/login')} />}
    </TransitionContext.Provider>
  )
}

