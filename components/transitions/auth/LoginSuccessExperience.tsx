'use client'

import React, { useState, useEffect } from 'react'
import { TMLLogoScene } from '../shared/TMLLogoScene'
import { Document3D } from '../shared/Document3D'
import { ScanningBeam } from '../shared/ScanningBeam'
import { SparklesIcon, CheckCircle2Icon } from 'lucide-react'

export interface LoginSuccessExperienceProps {
  targetUrl: string
  onComplete?: () => void
}

type SuccessPhase =
  | 'AUTH_CONFIRMED' // Scene B1: "ACCESS GRANTED" light streak
  | 'FORM_TO_DOC' // Scene B2: Form flattens into 3D physical document sheet
  | 'DIGITIZING' // Scene B3: Cyan laser scanning & data stream extraction
  | 'INTO_LOGO' // Scene B4: Document glides between TML logo layers & arc swooshes
  | 'LOGO_PORTAL' // Scene B5: Logo expands into a cosmic portal, revealing Dashboard

/**
 * LoginSuccessExperience (Task 16 - Seamless Interactive Document into TML Logo Archiving)
 * THE LOGIN FORM IS THE PAPER:
 * The interactive document transforms directly into digitized metadata and glides
 * into the physical layers of the TML Logo.
 */
export function LoginSuccessExperience({
  targetUrl,
  onComplete,
}: LoginSuccessExperienceProps) {
  const [phase, setPhase] = useState<SuccessPhase>('AUTH_CONFIRMED')

  useEffect(() => {
    // Sequence the 5 Scenes of Flow B (Cinematic Archiving into TML Logo)
    const t1 = setTimeout(() => {
      setPhase('FORM_TO_DOC') // 0.35s: Interface flattens into document
    }, 350)

    const t2 = setTimeout(() => {
      setPhase('DIGITIZING') // 0.95s: Laser sweeps and digitizes
    }, 950)

    const t3 = setTimeout(() => {
      setPhase('INTO_LOGO') // 1.75s: Document scales down and enters logo layers
    }, 1750)

    const t4 = setTimeout(() => {
      setPhase('LOGO_PORTAL') // 2.55s: Logo expands into portal towards Dashboard
    }, 2550)

    const t5 = setTimeout(() => {
      if (onComplete) {
        onComplete()
      } else {
        window.location.replace(targetUrl)
      }
    }, 3350)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
      clearTimeout(t5)
    }
  }, [targetUrl, onComplete])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#07182F] via-[#0B2D59] to-[#040b17] text-white select-none perspective-1200">
      {/* Background Deep Space Logistics Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-45 transition-all duration-1000 ease-out"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(8, 117, 232, 0.5) 0%, rgba(245, 158, 11, 0.18) 50%, transparent 75%)',
          transform: phase === 'LOGO_PORTAL' ? 'scale(2.8)' : 'scale(1)',
        }}
      />

      <ScanningBeam isActive={phase === 'DIGITIZING' || phase === 'INTO_LOGO'} />

      {/* --- SCENE B1 & B2 & B3: FLOATING 3D DOCUMENT (BEING DIGITIZED) --- */}
      <div
        className="relative z-30"
        style={{
          willChange: 'transform, opacity',
          transition: 'all 0.75s cubic-bezier(0.16, 1, 0.3, 1)',
          transform:
            phase === 'AUTH_CONFIRMED' || phase === 'FORM_TO_DOC'
              ? 'perspective(1200px) rotateX(8deg) translate3d(0, 0, 0) scale(1)'
              : phase === 'DIGITIZING'
                ? 'perspective(1200px) rotateX(16deg) rotateY(-8deg) translate3d(0, -20px, 0) scale(0.96)'
                : phase === 'INTO_LOGO' || phase === 'LOGO_PORTAL'
                  ? 'perspective(1200px) rotateX(32deg) rotateY(15deg) translate3d(0, -60px, -400px) scale(0.18)'
                  : 'scale(1)',
          opacity:
            phase === 'INTO_LOGO'
              ? 0.5
              : phase === 'LOGO_PORTAL'
                ? 0
                : 1,
        }}
      >
        <Document3D
          viewMode={phase === 'AUTH_CONFIRMED' ? 'FORM' : 'DIGITIZING'}
          docTitle="HỒ SƠ XÁC THỰC TRUY CẬP · DIGITAL CREDENTIAL"
          docCode="TML-SEC-AUTH-SUCCESS"
          isDigitizing={phase === 'DIGITIZING' || phase === 'INTO_LOGO'}
          showLaser={phase === 'DIGITIZING'}
          showOcrBoxes={phase === 'DIGITIZING'}
          theme="light"
          isSuccessMorphing={true}
        />
      </div>

      {/* --- SCENE B4 & B5: TML LOGO (RECEIVES DOCUMENT & EXPANDS INTO PORTAL) --- */}
      <div
        className="absolute z-40 flex flex-col items-center justify-center"
        style={{
          willChange: 'transform, opacity',
          transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
          opacity:
            phase === 'AUTH_CONFIRMED' || phase === 'FORM_TO_DOC'
              ? 0
              : phase === 'LOGO_PORTAL'
                ? 0.2
                : 1,
          transform:
            phase === 'AUTH_CONFIRMED' || phase === 'FORM_TO_DOC'
              ? 'scale(0.4) translate3d(0, 40px, 0)'
              : phase === 'DIGITIZING'
                ? 'scale(0.85) translate3d(0, 80px, 0)'
                : phase === 'INTO_LOGO'
                  ? 'scale(1.2) translate3d(0, 0, 0)'
                  : 'scale(14) translate3d(0, 0, 800px)', // Camera pushes in through the logo center
        }}
      >
        <TMLLogoScene
          size={180}
          layerSpread={phase === 'INTO_LOGO' ? 1 : 0}
          arcPulse={phase === 'INTO_LOGO' || phase === 'LOGO_PORTAL'}
          showGlow
        />

        {phase !== 'LOGO_PORTAL' && phase !== 'AUTH_CONFIRMED' && (
          <div className="mt-4 flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-950/60 px-4 py-1.5 text-xs font-mono text-cyan-300 backdrop-blur-md shadow-lg shadow-cyan-950/50">
            <SparklesIcon className="size-3.5 text-cyan-400 animate-spin" />
            <span>
              {phase === 'DIGITIZING' && 'Đang quét số hóa chứng từ xác thực...'}
              {phase === 'INTO_LOGO' && 'Lưu trữ chứng từ vào kho số TML...'}
            </span>
          </div>
        )}
      </div>

      {/* Top Banner on Auth Confirmation */}
      {phase === 'AUTH_CONFIRMED' && (
        <div className="absolute top-10 flex items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-950/80 px-5 py-2 text-xs font-mono font-bold text-emerald-300 shadow-xl backdrop-blur-md animate-bounce">
          <CheckCircle2Icon className="size-4 text-emerald-400" />
          <span>ACCESS GRANTED · XÁC THỰC THÀNH CÔNG</span>
        </div>
      )}
    </div>
  )
}
