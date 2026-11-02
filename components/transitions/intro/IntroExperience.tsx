'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Folder3D } from './Folder3D'
import { Document3D } from '../shared/Document3D'
import { LoginFormCard } from '../auth/LoginFormCard'
import { FastForwardIcon, SparklesIcon, ScanIcon } from 'lucide-react'

export interface IntroExperienceProps {
  onLoginSuccess?: (targetUrl: string) => void
  isSuccessMorphing?: boolean
  forceReplay?: boolean
}

type IntroPhase =
  | 'INITIAL' // Scene A1: Cinematic opening in Deep Navy
  | 'OPENING' // Scene A2: Folder cover rotates on hinge, revealing inner sheets
  | 'EXTRACTING' // Scene A3: Document sheet glides out toward camera
  | 'SCANNING' // Scene A4: Intelligent OCR scanning with cyan laser & bounding boxes
  | 'MORPHING' // Scene A5: Paper transforms seamlessly into Login Form
  | 'READY' // Scene A5 completed: Full interactive Light Premium Login Form

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

    // Sequence the 5 Cinematic Scenes (Flow A)
    const timer1 = setTimeout(() => {
      setPhase('OPENING') // 0.6s: Folder begins opening
    }, 600)

    const timer2 = setTimeout(() => {
      setPhase('EXTRACTING') // 1.5s: Document slides out
    }, 1500)

    const timer3 = setTimeout(() => {
      setPhase('SCANNING') // 2.5s: Intelligent OCR laser scan sweeps over document
    }, 2500)

    const timer4 = setTimeout(() => {
      setPhase('MORPHING') // 3.4s: Paper-to-Login transformation starts
    }, 3400)

    const timer5 = setTimeout(() => {
      setPhase('READY') // 4.3s: Fully interactive Light Premium form
      try {
        sessionStorage.setItem('tml_intro_seen', 'true')
      } catch {}
    }, 4300)

    return () => {
      clearTimeout(timer1)
      clearTimeout(timer2)
      clearTimeout(timer3)
      clearTimeout(timer4)
      clearTimeout(timer5)
    }
  }, [forceReplay])

  const isFormActive = skipIntro || phase === 'MORPHING' || phase === 'READY'
  const isLightBackground = skipIntro || phase === 'MORPHING' || phase === 'READY'

  return (
    <div
      className={`relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 select-none perspective-1200 transition-colors duration-1000 ${
        isLightBackground ? 'bg-[#F5F8FC] text-slate-800' : 'bg-[#07182F] text-white'
      }`}
    >
      {/* Background Volumetric Glow & Subtle Grid (Dark Cinematic for A1-A4) */}
      {!isLightBackground && (
        <div
          className="pointer-events-none absolute inset-0 opacity-35 transition-opacity duration-1000"
          style={{
            backgroundImage:
              'radial-gradient(circle at 50% 35%, rgba(8, 117, 232, 0.4) 0%, transparent 65%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 40px 40px, 40px 40px',
          }}
        />
      )}

      {/* Top Header Bar with Brand & Skip Option (Only visible before READY) */}
      {phase !== 'READY' && !skipIntro && (
        <div className="absolute top-6 inset-x-6 flex items-center justify-between z-40 transition-opacity duration-500">
          <div className="flex items-center gap-2 text-xs font-mono tracking-widest text-blue-300">
            <SparklesIcon className="size-4 text-cyan-400 animate-pulse" />
            <span>TML INTELLIGENT DOCUMENT VAULT</span>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs text-white backdrop-blur-md transition-all hover:bg-white/20 hover:scale-105 active:scale-95 shadow-sm"
          >
            <FastForwardIcon className="size-3.5" />
            <span>Bỏ qua intro</span>
          </button>
        </div>
      )}

      {/* --- SCENE A1 & A2: 3D BLUE FOLDER --- */}
      {!isFormActive && (
        <div
          className="transition-all duration-700 ease-out"
          style={{
            willChange: 'transform, opacity',
            transform:
              phase === 'EXTRACTING' || phase === 'SCANNING'
                ? 'translate3d(0, 110px, 0) scale(0.86)'
                : 'translate3d(0, 0, 0) scale(1)',
          }}
        >
          <Folder3D
            isOpen={phase === 'OPENING' || phase === 'EXTRACTING' || phase === 'SCANNING'}
            isExtracting={phase === 'EXTRACTING' || phase === 'SCANNING'}
          />
        </div>
      )}

      {/* --- SCENE A3 & A4: EXTRACTING & INTELLIGENT SCANNING DOCUMENT --- */}
      {(phase === 'EXTRACTING' || phase === 'SCANNING') && (
        <div
          className="absolute z-30 transition-all duration-700 ease-out"
          style={{
            willChange: 'transform, opacity',
            transform:
              phase === 'SCANNING'
                ? 'perspective(1200px) rotateX(6deg) rotateY(-2deg) translate3d(0, -40px, 0) scale(1.02)'
                : 'perspective(1200px) rotateX(15deg) rotateY(-8deg) translate3d(0, -70px, 0) scale(0.94)',
            opacity: 1,
          }}
        >
          <Document3D
            docTitle="VẬN ĐƠN ĐƯỜNG BIỂN QUỐC TẾ · BILL OF LADING"
            docCode="TML-BL-2026-X89"
            scale={1}
            isDigitizing={phase === 'SCANNING'}
            showLaser={phase === 'SCANNING'}
            showOcrBoxes={phase === 'SCANNING'}
            theme="light"
          />
        </div>
      )}

      {/* --- SCENE A5: PAPER-TO-LOGIN CONTINUOUS FORM --- */}
      {isFormActive && (
        <div
          className="relative z-40 w-full max-w-[440px] transition-all duration-700 ease-out"
          style={{
            willChange: 'transform, opacity',
            animation:
              phase === 'MORPHING'
                ? 'scaleInMorph 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                : undefined,
          }}
        >
          <LoginFormCard
            onLoginSuccess={onLoginSuccess}
            isSuccessMorphing={isSuccessMorphing}
          />
        </div>
      )}

      {/* Bottom Subtitle / Guidance */}
      {phase !== 'READY' && !skipIntro && (
        <div className="absolute bottom-6 text-center text-xs text-blue-200/70 font-mono tracking-wider transition-opacity duration-300">
          {phase === 'INITIAL' && 'Đang kết nối tới kho chứng từ TML...'}
          {phase === 'OPENING' && 'Mở hồ sơ vận tải số hóa...'}
          {phase === 'EXTRACTING' && 'Tiếp nhận chứng từ vận đơn...'}
          {phase === 'SCANNING' && 'Công nghệ OCR: Quét và nhận diện tự động dữ liệu Logistics...'}
          {phase === 'MORPHING' && 'Chuyển hóa chứng từ thành giao diện xác thực quyền truy cập...'}
        </div>
      )}
    </div>
  )
}
