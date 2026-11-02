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
    // Check reduced motion preference
    if (typeof window !== 'undefined') {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const alreadySeen = sessionStorage.getItem('tml_intro_seen') === 'true'

      if ((prefersReduced || alreadySeen) && !forceReplay) {
        setPhase('READY')
        return
      }
    }

    // Sequence the 3D Intro
    const timer1 = setTimeout(() => {
      setPhase('OPENING')
    }, 600)

    const timer2 = setTimeout(() => {
      setPhase('EXTRACTING')
    }, 1600)

    const timer3 = setTimeout(() => {
      setPhase('MORPHING')
    }, 2800)

    const timer4 = setTimeout(() => {
      setPhase('READY')
      try {
        sessionStorage.setItem('tml_intro_seen', 'true')
      } catch {}
    }, 3600)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
    }
  }, [forceReplay])

  // Instant fallback for Skip or Reduced Motion
  if (skipIntro || phase === 'READY') {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center p-4">
        <LoginFormCard
          onLoginSuccess={onLoginSuccess}
          isSuccessMorphing={isSuccessMorphing}
        />
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-b from-[#061124] via-[#091a38] to-[#040b17] p-4 text-white perspective-1200 select-none">
      {/* Background Ambient Grid & Soft Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 40%, rgba(14, 117, 255, 0.3) 0%, transparent 70%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 40px 40px, 40px 40px',
        }}
      />

      {/* Top Bar with Brand & Skip Option */}
      <div className="absolute top-6 inset-x-6 flex items-center justify-between z-40">
        <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-blue-300/80">
          <SparklesIcon className="size-4 text-cyan-400 animate-pulse" />
          <span>TML LOGISTICS ENTERPRISE ARCHIVE</span>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/80 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white"
        >
          <FastForwardIcon className="size-3.5" />
          <span>Bỏ qua intro</span>
        </button>
      </div>

      {/* --- SCENE 1 & 2: 3D BLUE FOLDER --- */}
      <div
        className="transition-all duration-1000 ease-in-out"
        style={{
          opacity: phase === 'MORPHING' ? 0 : 1,
          transform:
            phase === 'EXTRACTING'
              ? 'translateY(120px) scale(0.85)'
              : phase === 'MORPHING'
                ? 'translateY(240px) scale(0.6)'
                : 'translateY(0px) scale(1)',
          pointerEvents: phase === 'MORPHING' ? 'none' : 'auto',
        }}
      >
        <Folder3D
          isOpen={phase === 'OPENING' || phase === 'EXTRACTING' || phase === 'MORPHING'}
          isExtracting={phase === 'EXTRACTING' || phase === 'MORPHING'}
        />
      </div>

      {/* --- SCENE 3 & 4: EXTRACTING DOCUMENT SHEET --- */}
      {(phase === 'EXTRACTING' || phase === 'MORPHING') && (
        <div
          className="absolute z-30 transition-all duration-1000 ease-out"
          style={{
            transform:
              phase === 'MORPHING'
                ? 'perspective(1200px) rotateX(0deg) rotateY(0deg) translateY(0px) scale(1)'
                : 'perspective(1200px) rotateX(16deg) rotateY(-6deg) translateY(-80px) scale(0.92)',
            opacity: phase === 'MORPHING' ? 0 : 1,
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

      {/* --- SCENE 4: PAPER-TO-INTERFACE MORPH (LOGIN FORM REVEAL) --- */}
      {phase === 'MORPHING' && (
        <div
          className="absolute z-40 transition-all duration-1000 ease-out"
          style={{
            animation: 'fadeIn 0.9s ease-out forwards',
          }}
        >
          <LoginFormCard
            onLoginSuccess={onLoginSuccess}
            isSuccessMorphing={isSuccessMorphing}
          />
        </div>
      )}

      {/* Bottom Subtitle / Guidance */}
      <div className="absolute bottom-6 text-center text-xs text-blue-200/50 font-mono tracking-wider">
        {phase === 'INITIAL' && 'Đang tải bộ hồ sơ bảo mật...'}
        {phase === 'OPENING' && 'Mở kho lưu trữ chứng từ vận tải...'}
        {phase === 'EXTRACTING' && 'Rút chứng từ xác thực...'}
        {phase === 'MORPHING' && 'Chuyển hóa chứng từ thành giao diện đăng nhập...'}
      </div>
    </div>
  )
}
