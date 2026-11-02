'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Folder3D } from './Folder3D'
import { Document3D } from '../shared/Document3D'
import { LoginFormCard } from '../auth/LoginFormCard'
import { FastForwardIcon, SparklesIcon } from 'lucide-react'

export interface IntroExperienceProps {
  onLoginSuccess?: (targetUrl: string) => void
  isSuccessMorphing?: boolean
  forceReplay?: boolean
}

type IntroPhase =
  | 'INITIAL' // Folder closed in center
  | 'OPENING' // Folder cover flips open
  | 'EXTRACTING' // Document slides out in 3D
  | 'MORPHING' // Document smoothly expands into Login Form
  | 'READY' // Full interactive Login Form active

export function IntroExperience({
  onLoginSuccess,
  isSuccessMorphing = false,
  forceReplay = false,
}: IntroExperienceProps) {
  const [phase, setPhase] = useState<IntroPhase>('INITIAL')
  const [skipIntro, setSkipIntro] = useState(false)

  const handleSkip = useCallback(() => {
    setSkipIntro(true)
    setPhase('READY')
    try {
      sessionStorage.setItem('tml_intro_seen', 'true')
    } catch {}
  }, [])

  useEffect(() => {
    // Check reduced motion preference or previously viewed session
    if (typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const alreadySeen = sessionStorage.getItem('tml_intro_seen') === 'true'

      if ((prefersReduced || alreadySeen) && !forceReplay) {
        setPhase('READY')
        return
      }
    }

    // Sequence the 3D Intro with smooth GPU-accelerated intervals
    const timer1 = setTimeout(() => {
      setPhase('OPENING')
    }, 450)

    const timer2 = setTimeout(() => {
      setPhase('EXTRACTING')
    }, 1200)

    const timer3 = setTimeout(() => {
      setPhase('MORPHING')
    }, 2200)

    const timer4 = setTimeout(() => {
      setPhase('READY')
      try {
        sessionStorage.setItem('tml_intro_seen', 'true')
      } catch {}
    }, 2900)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
    }
  }, [forceReplay])

  const isFormActive = skipIntro || phase === 'MORPHING' || phase === 'READY'

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#061124] via-[#091a38] to-[#040b17] p-4 text-white perspective-1200 select-none">
      {/* Background Ambient Grid & Soft Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 40%, rgba(14, 117, 255, 0.35) 0%, transparent 70%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      />

      {/* Top Bar with Brand & Skip Option (Only visible before READY) */}
      {phase !== 'READY' && !skipIntro && (
        <div className="absolute top-6 inset-x-6 flex items-center justify-between z-40 transition-opacity duration-500">
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-blue-300/80">
            <SparklesIcon className="size-4 text-cyan-400 animate-pulse" />
            <span>TML LOGISTICS ENTERPRISE ARCHIVE</span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs text-white/90 backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105 active:scale-95"
          >
            <FastForwardIcon className="size-3.5" />
            <span>Bỏ qua intro</span>
          </button>
        </div>
      )}

      {/* --- SCENE 1 & 2: 3D BLUE FOLDER --- */}
      {!isFormActive && (
        <div
          className="transition-all duration-700 ease-out"
          style={{
            willChange: 'transform, opacity',
            transform:
              phase === 'EXTRACTING'
                ? 'translate3d(0, 100px, 0) scale(0.88)'
                : 'translate3d(0, 0, 0) scale(1)',
          }}
        >
          <Folder3D
            isOpen={phase === 'OPENING' || phase === 'EXTRACTING'}
            isExtracting={phase === 'EXTRACTING'}
          />
        </div>
      )}

      {/* --- SCENE 3: EXTRACTING DOCUMENT SHEET --- */}
      {phase === 'EXTRACTING' && (
        <div
          className="absolute z-30 transition-all duration-700 ease-out"
          style={{
            willChange: 'transform, opacity',
            transform:
              'perspective(1200px) rotateX(12deg) rotateY(-5deg) translate3d(0, -60px, 0) scale(0.95)',
            opacity: 1,
          }}
        >
          <Document3D
            docTitle="CHỨNG TỪ XÁC THỰC DOANH NGHIỆP · TML SECURE PASS"
            docCode="ISO27001-AUTH-2026"
            scale={1}
            isDigitizing={false}
          />
        </div>
      )}

      {/* --- SCENE 4: SMOOTH CONTINUOUS LOGIN FORM CONTAINER --- */}
      {isFormActive && (
        <div
          className="relative z-40 w-full max-w-[450px] transition-all duration-700 ease-out"
          style={{
            willChange: 'transform, opacity',
            animation:
              phase === 'MORPHING'
                ? 'scaleInMorph 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                : undefined,
          }}
        >
          <LoginFormCard
            onLoginSuccess={onLoginSuccess}
            isSuccessMorphing={isSuccessMorphing}
          />
        </div>
      )}

      {/* Bottom Subtitle / Guidance during intro */}
      {phase !== 'READY' && !skipIntro && (
        <div className="absolute bottom-6 text-center text-xs text-blue-200/60 font-mono tracking-wider transition-opacity duration-300">
          {phase === 'INITIAL' && 'Đang tải bộ hồ sơ bảo mật...'}
          {phase === 'OPENING' && 'Mở kho lưu trữ chứng từ vận tải...'}
          {phase === 'EXTRACTING' && 'Rút chứng từ xác thực số...'}
          {phase === 'MORPHING' && 'Khởi tạo giao diện đăng nhập...'}
        </div>
      )}
    </div>
  )
}
