'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TMLLogoScene } from '../shared/TMLLogoScene'
import { Document3D } from '../shared/Document3D'
import { ScanningBeam } from '../shared/ScanningBeam'
import { LockIcon } from 'lucide-react'

export interface LogoutExperienceProps {
  onComplete?: () => void
}

type LogoutPhase =
  | 'LOGO_APPEAR' // Logo appears centered as background darkens
  | 'DOC_EMERGE' // Document slides out from logo layers with cyan scan
  | 'DOC_EXPAND' // Document tilts and scales toward camera
  | 'DONE' // Transition completes and redirects to /login

export function LogoutExperience({ onComplete }: LogoutExperienceProps) {
  const [phase, setPhase] = useState<LogoutPhase>('LOGO_APPEAR')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    const t1 = setTimeout(() => {
      setPhase('DOC_EMERGE')
    }, 450)

    const t2 = setTimeout(() => {
      setPhase('DOC_EXPAND')
    }, 1100)

    const t3 = setTimeout(() => {
      setPhase('DONE')
      if (onComplete) {
        onComplete()
      } else {
        window.location.replace('/login')
      }
    }, 1800)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onComplete])

  if (!mounted) return null

  const content = (
    <div
      className="fixed inset-0 z-[999999] flex h-screen w-screen items-center justify-center overflow-hidden bg-[#040b17] text-white select-none perspective-1200"
      style={{
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Background ambient deep blue glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-700"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(14, 117, 255, 0.45) 0%, rgba(4, 11, 23, 0.8) 60%, transparent 80%)',
        }}
      />

      {/* Laser Scanning Beam */}
      <ScanningBeam isActive={phase === 'DOC_EMERGE'} />

      {/* --- SCENE A: TML LOGO (OPENS LAYERS TO RELEASE SEALED RECEIPT) --- */}
      <div
        className="relative z-30 flex flex-col items-center justify-center"
        style={{
          willChange: 'transform, opacity',
          transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: phase === 'DOC_EXPAND' ? 0.25 : 1,
          transform:
            phase === 'LOGO_APPEAR'
              ? 'translate3d(0, 0, 0) scale(1)'
              : phase === 'DOC_EMERGE'
                ? 'translate3d(0, 35px, 0) scale(0.9)'
                : 'translate3d(0, 90px, 0) scale(0.65)',
        }}
      >
        <TMLLogoScene
          size={160}
          layerSpread={phase === 'DOC_EMERGE' ? 1 : 0}
          arcPulse={phase === 'LOGO_APPEAR'}
          showGlow
        />
        <div className="mt-4 flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-950/60 px-4 py-1.5 text-xs font-mono text-amber-300 backdrop-blur-md shadow-lg shadow-amber-950/40">
          <LockIcon className="size-3.5 animate-pulse text-amber-400" />
          <span>Đang đăng xuất & niêm phong phiên làm việc...</span>
        </div>
      </div>

      {/* --- SCENE B: DOCUMENT EMERGING & EXPANDING TOWARD CAMERA --- */}
      {(phase === 'DOC_EMERGE' || phase === 'DOC_EXPAND' || phase === 'DONE') && (
        <div
          className="absolute z-40"
          style={{
            willChange: 'transform, opacity',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
            transform:
              phase === 'DOC_EMERGE'
                ? 'perspective(1200px) rotateX(25deg) rotateY(-8deg) translate3d(0, -30px, -200px) scale(0.4)'
                : 'perspective(1200px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0) scale(1)',
            opacity: phase === 'DOC_EMERGE' ? 0.75 : 1,
          }}
        >
          <Document3D
            docTitle="CHỨNG TỪ KHOÁ NIÊM PHONG · LOGOUT RECEIPT"
            docCode="TML-SESSION-TERMINATED"
            isDigitizing={phase === 'DOC_EMERGE'}
          />
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}
