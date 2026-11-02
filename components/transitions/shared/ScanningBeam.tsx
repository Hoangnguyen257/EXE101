'use client'

import React from 'react'

interface ScanningBeamProps {
  isActive?: boolean
  className?: string
}

/**
 * ScanningBeam & Digital Data Stream (Task 16)
 * Generates an energetic neon laser sweep and subtle digital data stream
 * for Flow 2 (Digitization into Logo) and Flow 3 (Logout Extraction).
 */
export function ScanningBeam({ isActive = false, className = '' }: ScanningBeamProps) {
  if (!isActive) return null

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden z-20 ${className}`}>
      {/* Vertical Cyan Laser Sweep */}
      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_5px_rgba(6,182,212,0.8)] animate-scan-beam" />

      {/* Ambient Cyber Grid Rays */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 50%, rgba(14, 165, 233, 0.4) 0%, transparent 70%)',
        }}
      />
    </div>
  )
}

