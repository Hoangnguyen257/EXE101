'use client'

import React, { useState, useEffect } from 'react'
import { TMLLogoScene } from '../shared/TMLLogoScene'
import { Document3D } from '../shared/Document3D'
import { ScanningBeam } from '../shared/ScanningBeam'
import { LockIcon } from 'lucide-react'

export interface LogoutExperienceProps {
  onComplete?: () => void
}

type LogoutPhase =
  | 'LOGO_APPEAR' // Logo appears as dashboard dims
  | 'DOC_EMERGE' // Document slides out from logo layers
  | 'DOC_EXPAND' // Document tilts and scales toward camera
  | 'DONE' // Transition completes and redirects to /login

export function LogoutExperience({ onComplete }: LogoutExperienceProps) {
  const [phase, setPhase] = useState<LogoutPhase>('LOGO_APPEAR')

  useEffect(() => {
    const t1 = setTimeout(() => {
      setPhase('DOC_EMERGE')
    }, 600)

    const t2 = setTimeout(() => {
      setPhase('DOC_EXPAND')
    }, 1400)

    const t3 = setTimeout(() => {
      setPhase('DONE')
      if (onComplete) {
        onComplete()
      } else {
        window.location.replace('/login')
      }
    }, 2400)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#061124] via-[#091a38] to-[#040b17] text-white select-none perspective-1200">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(14, 117, 255, 0.4) 0%, transparent 70%)',
        }}
      />

      <ScanningBeam isActive={phase === 'DOC_EMERGE'} />

      {/* --- SCENE A & B: TML LOGO (OPENS LAYERS TO RELEASE DOCUMENT) --- */}
      <div
        className="relative z-30 flex flex-col items-center justify-center transition-all duration-700 ease-out"
        style={{
          opacity: phase === 'DOC_EXPAND' ? 0.2 : 1,
          transform:
            phase === 'LOGO_APPEAR'
              ? 'scale(1) translateY(0px)'
              : phase === 'DOC_EMERGE'
                ? 'scale(0.9) translateY(40px)'
                : 'scale(0.6) translateY(120px)',
        }}
      >
        <TMLLogoScene
          size={160}
          layerSpread={phase === 'DOC_EMERGE' ? 1 : 0}
          arcPulse={phase === 'LOGO_APPEAR'}
          showGlow
        />
        <div className="mt-4 flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-950/40 px-4 py-1 text-xs font-mono text-amber-300 backdrop-blur-md">
          <LockIcon className="size-3.5" />
          <span>Đang đăng xuất & niêm phong phiên làm việc...</span>
        </div>
      </div>

      {/* --- SCENE B & C: DOCUMENT EMERGING & EXPANDING TOWARD CAMERA --- */}
      {(phase === 'DOC_EMERGE' || phase === 'DOC_EXPAND' || phase === 'DONE') && (
        <div
          className="absolute z-40 transition-all duration-1000 ease-out"
          style={{
            transform:
              phase === 'DOC_EMERGE'
                ? 'perspective(1200px) rotateX(25deg) rotateY(-10deg) translateY(-20px) translateZ(-200px) scale(0.35)'
                : 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0px) translateZ(0px) scale(1)',
            opacity: phase === 'DOC_EMERGE' ? 0.7 : 1,
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
}

