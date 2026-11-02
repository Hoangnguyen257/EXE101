'use client'

import React from 'react'
import { TMLLogoScene } from '../shared/TMLLogoScene'
import { FolderIcon, ShieldCheckIcon } from 'lucide-react'

interface Folder3DProps {
  isOpen?: boolean
  isExtracting?: boolean
  className?: string
}

/**
 * 3D Logistics Folder (Task 16 - Flow 1 Intro)
 * Features an authentic 3D enterprise dossier with opening cover,
 * stacked physical documents inside, and smooth extraction dynamics.
 */
export function Folder3D({ isOpen = false, isExtracting = false, className = '' }: Folder3DProps) {
  return (
    <div
      className={`relative flex items-center justify-center preserve-3d select-none transition-transform duration-1000 ease-out ${className}`}
      style={{
        width: 480,
        height: 340,
        transform: isOpen
          ? 'perspective(1400px) rotateX(15deg) rotateY(-8deg) scale3d(0.95, 0.95, 1)'
          : 'perspective(1400px) rotateX(20deg) rotateY(-15deg) scale3d(1, 1, 1)',
      }}
    >
      {/* 3D Drop Shadow on Floor */}
      <div
        className="absolute -bottom-8 w-4/5 h-12 rounded-full blur-xl transition-opacity duration-1000 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(0, 20, 60, 0.45) 0%, transparent 70%)',
          opacity: isOpen ? 0.7 : 0.9,
          transform: 'rotateX(80deg) scale(1.1)',
        }}
      />

      {/* --- BACK FOLDER COVER (BASE) --- */}
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#063b8c] via-[#052c6b] to-[#031d47] border border-blue-400/20 shadow-2xl preserve-3d"
        style={{
          transform: 'translateZ(-10px)',
        }}
      >
        {/* Top Folder Tab */}
        <div className="absolute -top-6 left-6 h-6 px-4 rounded-t-lg bg-[#07449e] border-t border-l border-r border-blue-300/30 flex items-center gap-1.5 text-[11px] font-bold text-blue-100 uppercase tracking-wider">
          <FolderIcon className="size-3 text-cyan-300" />
          <span>TML-LOGISTICS-ARCHIVE // 2026</span>
        </div>
      </div>

      {/* --- STACKED INNER DOCUMENT SHEETS --- */}
      {/* Sheet 3 (Deepest) */}
      <div
        className="absolute inset-4 rounded-lg bg-slate-100 border border-slate-300 shadow-md transition-transform duration-700 pointer-events-none"
        style={{
          transform: isOpen ? 'translateZ(2px) rotate(2deg) translateY(-4px)' : 'translateZ(0px)',
        }}
      />

      {/* Sheet 2 (Middle) */}
      <div
        className="absolute inset-4 rounded-lg bg-slate-50 border border-slate-300 shadow-md transition-transform duration-700 pointer-events-none"
        style={{
          transform: isOpen ? 'translateZ(8px) rotate(-1.5deg) translateY(-8px)' : 'translateZ(2px)',
        }}
      />

      {/* Sheet 1 (Top Target Document - Extracts outwards on command) */}
      <div
        className="absolute inset-4 rounded-lg bg-white border border-slate-300/90 p-5 shadow-lg transition-all duration-1000 ease-out preserve-3d"
        style={{
          transform: isExtracting
            ? 'translateZ(140px) translateY(-140px) rotateX(-12deg) scale(1.08)'
            : isOpen
              ? 'translateZ(16px) translateY(-12px) rotate(0.5deg)'
              : 'translateZ(4px)',
          opacity: isExtracting ? 0 : 1, // Fades out as the main Document3D takes over
        }}
      >
        {/* Document Header Line Preview */}
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <div className="size-4 rounded bg-primary" />
            <span className="text-[10px] font-bold tracking-wider text-slate-800">
              TML BILL OF LADING #2026-X89
            </span>
          </div>
          <span className="text-[9px] font-mono text-slate-500">ORIGINAL COPY</span>
        </div>
        <div className="mt-3 space-y-2">
          <div className="h-2 w-3/4 bg-slate-200 rounded" />
          <div className="h-2 w-1/2 bg-slate-200 rounded" />
          <div className="h-2 w-5/6 bg-slate-100 rounded" />
        </div>
      </div>

      {/* --- FRONT FOLDER COVER (FLIPS OPEN AROUND LEFT HINGE) --- */}
      <div
        className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#0c5edd] via-[#094bb3] to-[#063582] border border-blue-400/30 p-8 flex flex-col justify-between shadow-2xl transition-transform duration-1000 preserve-3d"
        style={{
          transformOrigin: 'left center',
          transform: isOpen ? 'rotateY(-115deg) translateZ(2px)' : 'rotateY(0deg) translateZ(20px)',
          backfaceVisibility: 'hidden',
        }}
      >
        {/* Folder Cover Branding */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white/90">
            <span className="text-xs font-bold tracking-widest uppercase">
              TÂN MINH LOGISTICS CORP
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-cyan-300 font-mono">
            <ShieldCheckIcon className="size-3.5" />
            <span>CONFIDENTIAL</span>
          </div>
        </div>

        {/* Center Emblem on Cover */}
        <div className="my-auto flex flex-col items-center justify-center text-center">
          <TMLLogoScene size={110} className="mb-2 drop-shadow-lg" />
          <h2 className="text-lg font-bold text-white tracking-wide">TML DocManager</h2>
          <p className="text-[11px] text-blue-200/80">Hồ sơ Quản lý & Số hóa Chứng từ Vận tải</p>
        </div>

        {/* Cover Bottom Meta */}
        <div className="flex items-center justify-between border-t border-white/10 pt-2 text-[10px] text-blue-200/60 font-mono">
          <span>PORTAL: SECURE ACCESS</span>
          <span>v2.4 ENTERPRISE</span>
        </div>
      </div>
    </div>
  )
}

