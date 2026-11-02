'use client'

import React from 'react'
import Image from 'next/image'

interface TMLLogoProps {
  size?: number | string
  className?: string
  isInteractive?: boolean
  layerSpread?: number // 0 (closed) to 1 (fully spread/open to receive document)
  arcPulse?: boolean
  showGlow?: boolean
  useRasterImage?: boolean
}

/**
 * TML Brand Logo Scene (Task 16)
 * Supports pixel-perfect raster rendering and layered 3D vector animations
 * (folder opening, paper sheets fanning, orange orbital arc swoosh).
 */
export function TMLLogoScene({
  size = 120,
  className = '',
  layerSpread = 0,
  arcPulse = false,
  showGlow = false,
  useRasterImage = false,
}: TMLLogoProps) {
  const numericSize = typeof size === 'number' ? size : parseInt(size.toString(), 10) || 120

  if (useRasterImage) {
    return (
      <div
        className={`relative inline-flex items-center justify-center select-none ${className}`}
        style={{ width: numericSize, height: numericSize }}
      >
        <Image
          src="/tml-logo.jpg"
          alt="TML DocManager Logo"
          width={numericSize}
          height={numericSize}
          priority
          className="object-contain drop-shadow-md"
        />
        {showGlow && (
          <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse -z-10" />
        )}
      </div>
    )
  }

  // Interactive Layered Vector Emblem
  const spreadOffset = layerSpread * 14 // Pixels sheets separate
  const folderTilt = layerSpread * -6 // Degrees front folder angles out

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{
        width: numericSize,
        height: (numericSize * 0.72),
      }}
    >
      {/* Ambient Radial Glow */}
      {showGlow && (
        <div
          className="absolute inset-0 -m-4 rounded-full blur-2xl opacity-60 pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(10,101,255,0.35) 0%, rgba(255,122,0,0.2) 60%, transparent 80%)',
          }}
        />
      )}

      <svg
        viewBox="0 0 500 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full overflow-visible"
        style={{ filter: 'drop-shadow(0px 8px 16px rgba(10, 30, 60, 0.18))' }}
      >
        <defs>
          {/* Blue folder gradients */}
          <linearGradient id="tmlFolderGrad" x1="120" y1="110" x2="350" y2="300" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0E75FF" />
            <stop offset="50%" stopColor="#0456DF" />
            <stop offset="100%" stopColor="#003EAC" />
          </linearGradient>

          {/* Paper sheet gradients */}
          <linearGradient id="tmlPaper1" x1="190" y1="50" x2="320" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2F92FF" />
            <stop offset="100%" stopColor="#0B63E5" />
          </linearGradient>
          <linearGradient id="tmlPaper2" x1="220" y1="70" x2="350" y2="210" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#2586FA" />
            <stop offset="100%" stopColor="#095BD4" />
          </linearGradient>
          <linearGradient id="tmlPaper3" x1="250" y1="90" x2="370" y2="230" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1A78F2" />
            <stop offset="100%" stopColor="#074FB8" />
          </linearGradient>

          {/* Orange swoosh arc gradient */}
          <linearGradient id="tmlOrangeArc" x1="60" y1="280" x2="440" y2="100" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FF4D00" />
            <stop offset="30%" stopColor="#FF7A00" />
            <stop offset="70%" stopColor="#FFA000" />
            <stop offset="100%" stopColor="#FFC033" />
          </linearGradient>

          {/* Arc Outer Glow Filter */}
          <filter id="arcGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- LAYER 1: BACK PAPERS (FAN OUT ON SPREAD) --- */}
        <g
          className="transition-transform duration-500 ease-out"
          style={{ transform: `translate(${-spreadOffset * 0.7}px, ${-spreadOffset * 0.9}px)` }}
        >
          {/* Paper 1 (Backmost) */}
          <path
            d="M 180 80 Q 200 45 240 50 L 300 65 Q 320 70 325 90 L 300 160 L 160 140 Z"
            fill="url(#tmlPaper1)"
            stroke="#4CA3FF"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Paper 1 inner highlight lines */}
          <line x1="205" y1="75" x2="285" y2="90" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
          <line x1="195" y1="95" x2="275" y2="110" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
        </g>

        <g
          className="transition-transform duration-500 ease-out"
          style={{ transform: `translate(${-spreadOffset * 0.3}px, ${-spreadOffset * 0.5}px)` }}
        >
          {/* Paper 2 (Middle) */}
          <path
            d="M 215 100 Q 235 65 275 70 L 335 85 Q 355 90 360 110 L 330 180 L 195 160 Z"
            fill="url(#tmlPaper2)"
            stroke="#5DB0FF"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Paper 2 inner highlight lines */}
          <line x1="240" y1="95" x2="320" y2="110" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.95" />
          <line x1="230" y1="115" x2="310" y2="130" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.95" />
        </g>

        <g
          className="transition-transform duration-500 ease-out"
          style={{ transform: `translate(${spreadOffset * 0.2}px, ${-spreadOffset * 0.2}px)` }}
        >
          {/* Paper 3 (Front sheet in stack) */}
          <path
            d="M 250 120 Q 270 85 310 90 L 370 105 Q 390 110 395 130 L 360 210 L 225 185 Z"
            fill="url(#tmlPaper3)"
            stroke="#70BDFF"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
        </g>

        {/* --- LAYER 2: FRONT MAIN BLUE FOLDER BODY --- */}
        <g
          className="transition-transform duration-500 ease-out"
          style={{
            transformOrigin: '150px 260px',
            transform: `rotate(${folderTilt}deg) translate(${spreadOffset * 0.4}px, ${spreadOffset * 0.2}px)`,
          }}
        >
          {/* Front Folder Shape */}
          <path
            d="M 125 125 
               C 130 115, 145 110, 160 115 
               L 315 155 
               C 335 160, 345 175, 340 195 
               L 315 260 
               C 310 275, 295 285, 280 280 
               L 155 245 
               C 138 240, 128 225, 130 205 
               Z"
            fill="url(#tmlFolderGrad)"
            stroke="#0A50C2"
            strokeWidth="3"
          />

          {/* Folder Top Fold Bevel Highlight */}
          <path
            d="M 130 125 L 315 155 C 330 159, 335 168, 335 175 L 305 240 L 150 205 Z"
            fill="#FFFFFF"
            opacity="0.12"
          />

          {/* 3 White Signature Document Lines on Front */}
          <line
            x1="180"
            y1="180"
            x2="265"
            y2="180"
            stroke="#FFFFFF"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <line
            x1="180"
            y1="205"
            x2="245"
            y2="205"
            stroke="#FFFFFF"
            strokeWidth="11"
            strokeLinecap="round"
          />
          <line
            x1="180"
            y1="230"
            x2="225"
            y2="230"
            stroke="#FFFFFF"
            strokeWidth="11"
            strokeLinecap="round"
          />
        </g>

        {/* --- LAYER 3: ORANGE ORBITAL SWOOSH ARC --- */}
        <g className={arcPulse ? 'animate-pulse' : ''}>
          {/* Outer sweeping curved crescent arc */}
          <path
            d="M 75 255 
               C 60 295, 100 325, 165 330 
               C 270 338, 385 305, 430 215 
               C 455 165, 435 95, 350 75 
               C 385 95, 410 145, 390 195 
               C 355 270, 245 300, 155 290 
               C 105 285, 80 268, 75 255 
               Z"
            fill="url(#tmlOrangeArc)"
            filter="url(#arcGlow)"
          />

          {/* Specular Edge Highlight on Orange Arc */}
          <path
            d="M 110 305 
               C 210 325, 340 300, 405 220 
               C 425 195, 432 165, 420 140 
               C 426 160, 420 185, 400 210 
               C 340 285, 215 310, 110 305 
               Z"
            fill="#FFF1D0"
            opacity="0.6"
          />
        </g>
      </svg>
    </div>
  )
}

