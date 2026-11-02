'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { TMLLogoScene } from '../shared/TMLLogoScene'
import { Document3D } from '../shared/Document3D'
import { ScanningBeam } from '../shared/ScanningBeam'
import { LockIcon, ShieldCheckIcon } from 'lucide-react'

export interface LogoutExperienceProps {
  onComplete?: () => void
}

type LogoutPhase =
  | 'DASHBOARD_COLLAPSE' // Scene D1: Dashboard dims as Deep Navy space takes over
  | 'DATA_TO_LOGO' // Scene D2: Access session data returns into TML Logo
  | 'PAPER_RECONSTRUCT' // Scene D3: Physical sealed session document emerges from logo
  | 'PAPER_TO_LOGIN' // Scene D4: Document transforms toward Light Premium Login
  | 'DONE' // Transition completes, redirecting to /login

export function LogoutExperience({ onComplete }: LogoutExperienceProps) {
  const [phase, setPhase] = useState<LogoutPhase>('DASHBOARD_COLLAPSE')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)

    // Sequence the 4 Scenes of Flow D (Reverse Archiving)
    const t1 = setTimeout(() => {
      setPhase('DATA_TO_LOGO') // 0.35s: Logo appears, absorbing session
    }, 350)

    const t2 = setTimeout(() => {
      setPhase('PAPER_RECONSTRUCT') // 0.95s: Sealed receipt emerges
    }, 950)

    const t3 = setTimeout(() => {
      setPhase('PAPER_TO_LOGIN') // 1.75s: Paper expands toward camera
    }, 1750)

    const t4 = setTimeout(() => {
      setPhase('DONE')
      if (onComplete) {
        onComplete()
      } else {
        window.location.replace('/login')
      }
    }, 2450)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [onComplete])

  if (!mounted) return null

  const isLightLogin = phase === 'PAPER_TO_LOGIN' || phase === 'DONE'

  const content = (
    <div
      className={`fixed inset-0 z-[999999] flex h-screen w-screen items-center justify-center overflow-hidden text-white select-none perspective-1200 transition-colors duration-700 ${
        isLightLogin ? 'bg-[#F5F8FC]' : 'bg-[#040b17]'
      }`}
      style={{
        animation: 'fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      }}
    >
      {/* Background ambient lighting */}
      {!isLightLogin && (
        <div
          className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-700"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 50%, rgba(8, 117, 232, 0.45) 0%, rgba(4, 11, 23, 0.8) 60%, transparent 80%)',
          }}
        />
      )}

      {/* Laser Scanning Beam */}
      <ScanningBeam isActive={phase === 'DATA_TO_LOGO' || phase === 'PAPER_RECONSTRUCT'} />

      {/* --- SCENE D1 & D2: TML LOGO (RECEIVES SESSION & RELEASES SEALED DOCUMENT) --- */}
      <div
        className="relative z-30 flex flex-col items-center justify-center"
        style={{
          willChange: 'transform, opacity',
          transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity: phase === 'PAPER_TO_LOGIN' ? 0.15 : 1,
          transform:
            phase === 'DASHBOARD_COLLAPSE'
              ? 'translate3d(0, -40px, 0) scale(0.8)'
              : phase === 'DATA_TO_LOGO'
                ? 'translate3d(0, 0, 0) scale(1)'
                : phase === 'PAPER_RECONSTRUCT'
                  ? 'translate3d(0, 30px, 0) scale(0.9)'
                  : 'translate3d(0, 80px, 0) scale(0.6)',
        }}
      >
        <TMLLogoScene
          size={160}
          layerSpread={phase === 'PAPER_RECONSTRUCT' ? 1 : 0}
          arcPulse={phase === 'DATA_TO_LOGO'}
          showGlow
        />
        <div className="mt-4 flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-950/70 px-4 py-1.5 text-xs font-mono text-amber-300 backdrop-blur-md shadow-lg shadow-amber-950/40">
          <LockIcon className="size-3.5 animate-pulse text-amber-400" />
          <span>
            {phase === 'DASHBOARD_COLLAPSE' && 'Đóng phiên làm việc Dashboard...'}
            {phase === 'DATA_TO_LOGO' && 'Thu hồi quyền truy cập & niêm phong dữ liệu...'}
            {(phase === 'PAPER_RECONSTRUCT' || phase === 'PAPER_TO_LOGIN') && 'Tái tạo chứng từ niêm phong...'}
          </span>
        </div>
      </div>

      {/* --- SCENE D3 & D4: RECONSTRUCTED PHYSICAL DOCUMENT EMERGING --- */}
      {(phase === 'PAPER_RECONSTRUCT' || phase === 'PAPER_TO_LOGIN' || phase === 'DONE') && (
        <div
          className="absolute z-40"
          style={{
            willChange: 'transform, opacity',
            transition: 'all 0.85s cubic-bezier(0.16, 1, 0.3, 1)',
            transform:
              phase === 'PAPER_RECONSTRUCT'
                ? 'perspective(1200px) rotateX(24deg) rotateY(-8deg) translate3d(0, -30px, -220px) scale(0.4)'
                : 'perspective(1200px) rotateX(0deg) rotateY(0deg) translate3d(0, 0, 0) scale(1)',
            opacity: phase === 'PAPER_RECONSTRUCT' ? 0.75 : 1,
          }}
        >
          <Document3D
            docTitle="CHỨNG TỪ KHOÁ NIÊM PHONG · LOGOUT RECEIPT"
            docCode="TML-SESSION-TERMINATED"
            isDigitizing={phase === 'PAPER_RECONSTRUCT'}
            showLaser={phase === 'PAPER_RECONSTRUCT'}
            theme="light"
          />
        </div>
      )}
    </div>
  )

  return createPortal(content, document.body)
}
