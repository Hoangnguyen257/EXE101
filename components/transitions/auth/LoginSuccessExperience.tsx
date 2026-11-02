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
    // Sequence the digitization & transition into logo
    const t1 = setTimeout(() => {
      setPhase('DIGITIZING')
    }, 700)

    const t2 = setTimeout(() => {
      setPhase('INTO_LOGO')
    }, 1700)

    const t3 = setTimeout(() => {
      setPhase('LOGO_ABSORB')
    }, 2700)

    const t4 = setTimeout(() => {
      setPhase('EXPAND_DASHBOARD')
    }, 3600)

    const t5 = setTimeout(() => {
      if (onComplete) {
        onComplete()
      } else {
        window.location.replace(targetUrl)
      }
    }, 4400)

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
        className="pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-1000"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(14, 117, 255, 0.45) 0%, rgba(255, 122, 0, 0.15) 50%, transparent 80%)',
          transform: phase === 'EXPAND_DASHBOARD' ? 'scale(2.5)' : 'scale(1)',
        }}
      />

      <ScanningBeam isActive={phase === 'DIGITIZING' || phase === 'INTO_LOGO'} />

      {/* --- SCENE B & C: FLOATING 3D DOCUMENT (BEING DIGITIZED) --- */}
      <div
        className="relative z-30 transition-all duration-1000 ease-in-out"
        style={{
          transform:
            phase === 'CARD_TO_DOC'
              ? 'perspective(1200px) rotateX(10deg) translateY(0px) scale(1)'
              : phase === 'DIGITIZING'
                ? 'perspective(1200px) rotateX(15deg) rotateY(-8deg) translateY(-20px) scale(0.95)'
                : phase === 'INTO_LOGO' || phase === 'LOGO_ABSORB' || phase === 'EXPAND_DASHBOARD'
                  ? 'perspective(1200px) rotateX(35deg) rotateY(15deg) translateY(-60px) translateZ(-400px) scale(0.18)'
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
        className="absolute z-40 flex flex-col items-center justify-center transition-all duration-1000 ease-out"
        style={{
          opacity:
            phase === 'CARD_TO_DOC'
              ? 0
              : phase === 'EXPAND_DASHBOARD'
                ? 0.15
                : 1,
          transform:
            phase === 'CARD_TO_DOC'
              ? 'scale(0.5) translateY(40px)'
              : phase === 'DIGITIZING'
                ? 'scale(0.85) translateY(100px)'
                : phase === 'INTO_LOGO'
                  ? 'scale(1.2) translateY(0px)'
                  : phase === 'LOGO_ABSORB'
                    ? 'scale(1.3) translateY(0px)'
                    : 'scale(14) translateZ(800px)', // Camera zooms into logo center
        }}
      >
        <TMLLogoScene
          size={180}
          layerSpread={phase === 'INTO_LOGO' ? 1 : 0}
          arcPulse={phase === 'LOGO_ABSORB'}
          showGlow
        />

        {phase !== 'EXPAND_DASHBOARD' && (
          <div className="mt-4 flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-950/40 px-4 py-1 text-xs font-mono text-cyan-300 backdrop-blur-md">
            <SparklesIcon className="size-3.5 text-cyan-400 animate-spin" />
            <span>
              {phase === 'CARD_TO_DOC' && 'Chuyển hóa giao diện thành chứng từ...'}
              {phase === 'DIGITIZING' && 'Số hóa dữ liệu & mã hóa 256-bit...'}
              {phase === 'INTO_LOGO' && 'Lưu trữ chứng từ vào kho số TML...'}
              {phase === 'LOGO_ABSORB' && 'Xác thực thành công! Đang mở Dashboard...'}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

