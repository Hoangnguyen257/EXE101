'use client'

import React, { useState, useEffect } from 'react'
import { TMLLogoScene } from '../shared/TMLLogoScene'
import { Document3D } from '../shared/Document3D'
import { ScanningBeam } from '../shared/ScanningBeam'
import { SparklesIcon } from 'lucide-react'

export interface LoginSuccessExperienceProps {
  targetUrl: string
  onComplete?: () => void
}

type SuccessPhase =
  | 'CARD_TO_DOC' // Form flattens into 3D document sheet
  | 'DIGITIZING' // Cyan laser scanning sweeps over document
  | 'INTO_LOGO' // Document scales down and flies directly into TML logo layers
  | 'LOGO_ABSORB' // Logo receives document, orange arc swooshes & pulses
  | 'EXPAND_DASHBOARD' // Logo expands towards camera, revealing Dashboard

export function LoginSuccessExperience({
  targetUrl,
  onComplete,
}: LoginSuccessExperienceProps) {
  const [phase, setPhase] = useState<SuccessPhase>('CARD_TO_DOC')

  useEffect(() => {
    // Tinh chỉnh chuỗi thời gian tối ưu (2.2s tổng thể - dứt khoát, mượt mà chuẩn Enterprise)
    const t1 = setTimeout(() => {
      setPhase('DIGITIZING')
    }, 350)

    const t2 = setTimeout(() => {
      setPhase('INTO_LOGO')
    }, 950)

    const t3 = setTimeout(() => {
      setPhase('LOGO_ABSORB')
    }, 1500)

    const t4 = setTimeout(() => {
      setPhase('EXPAND_DASHBOARD')
    }, 1900)

    const t5 = setTimeout(() => {
      if (onComplete) {
        onComplete()
      } else {
        window.location.replace(targetUrl)
      }
    }, 2250)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  }, [targetUrl, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#061124] via-[#091a38] to-[#040b17] text-white select-none perspective-1200">
      {/* Background Deep Space Logistics Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-45 transition-all duration-700"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(14, 117, 255, 0.45) 0%, rgba(255, 122, 0, 0.15) 50%, transparent 80%)',
          transform: phase === 'EXPAND_DASHBOARD' ? 'scale(2.5)' : 'scale(1)',
        }}
      />

      <ScanningBeam isActive={phase === 'DIGITIZING' || phase === 'INTO_LOGO'} />

      {/* --- SCENE B & C: FLOATING 3D DOCUMENT (BEING DIGITIZED) --- */}
      <div
        className="relative z-30"
        style={{
          willChange: 'transform, opacity',
          transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          transform:
            phase === 'CARD_TO_DOC'
              ? 'perspective(1200px) rotateX(10deg) translate3d(0, 0, 0) scale(1)'
              : phase === 'DIGITIZING'
                ? 'perspective(1200px) rotateX(14deg) rotateY(-6deg) translate3d(0, -15px, 0) scale(0.96)'
                : phase === 'INTO_LOGO' || phase === 'LOGO_ABSORB' || phase === 'EXPAND_DASHBOARD'
                  ? 'perspective(1200px) rotateX(30deg) rotateY(12deg) translate3d(0, -50px, -350px) scale(0.2)'
                  : 'scale(1)',
          opacity:
            phase === 'INTO_LOGO'
              ? 0.7
              : phase === 'LOGO_ABSORB' || phase === 'EXPAND_DASHBOARD'
                ? 0
                : 1,
        }}
      >
        <Document3D
          docTitle="PHIÊN ĐĂNG NHẬP XÁC THỰC · DIGITAL CREDENTIAL"
          docCode="TML-SEC-AUTH-SUCCESS"
          isDigitizing={phase === 'DIGITIZING' || phase === 'INTO_LOGO'}
          showLaser={phase === 'DIGITIZING'}
        />
      </div>

      {/* --- SCENE D & E: TML LOGO (RECEIVES DOCUMENT & EXPANDS INTO DASHBOARD) --- */}
      <div
        className="absolute z-40 flex flex-col items-center justify-center"
        style={{
          willChange: 'transform, opacity',
          transition: 'all 0.65s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity:
            phase === 'CARD_TO_DOC'
              ? 0
              : phase === 'EXPAND_DASHBOARD'
                ? 0.15
                : 1,
          transform:
            phase === 'CARD_TO_DOC'
              ? 'scale(0.5) translate3d(0, 30px, 0)'
              : phase === 'DIGITIZING'
                ? 'scale(0.85) translate3d(0, 70px, 0)'
                : phase === 'INTO_LOGO'
                  ? 'scale(1.15) translate3d(0, 0, 0)'
                  : phase === 'LOGO_ABSORB'
                    ? 'scale(1.25) translate3d(0, 0, 0)'
                    : 'scale(12) translate3d(0, 0, 600px)',
        }}
      >
        <TMLLogoScene
          size={180}
          layerSpread={phase === 'INTO_LOGO' ? 1 : 0}
          arcPulse={phase === 'LOGO_ABSORB'}
          showGlow
        />

        {phase !== 'EXPAND_DASHBOARD' && phase !== 'CARD_TO_DOC' && (
          <div className="mt-3 flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-950/40 px-3.5 py-1 text-xs font-mono text-cyan-300 backdrop-blur-md">
            <SparklesIcon className="size-3.5 text-cyan-400 animate-spin" />
            <span>
              {phase === 'DIGITIZING' && 'Đang quét số hóa chứng từ...'}
              {phase === 'INTO_LOGO' && 'Đưa chứng từ vào kho TML...'}
              {phase === 'LOGO_ABSORB' && 'Xác thực thành công. Đang mở Dashboard...'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
