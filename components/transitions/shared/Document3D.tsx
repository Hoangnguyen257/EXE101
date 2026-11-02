'use client'

import React from 'react'
import { ShieldCheckIcon, QrCodeIcon, FileTextIcon, BarcodeIcon, ScanIcon, CheckIcon } from 'lucide-react'

interface Document3DProps {
  className?: string
  width?: number | string
  height?: number | string
  isDigitizing?: boolean
  showLaser?: boolean
  showOcrBoxes?: boolean
  tiltX?: number
  tiltY?: number
  scale?: number
  opacity?: number
  docTitle?: string
  docCode?: string
  theme?: 'dark' | 'light'
  children?: React.ReactNode
}

/**
 * 3D Physical Document Sheet (Task 16 - Intelligent Document Vault)
 * Features an authentic enterprise logistics document with micro-details:
 * - Security Guilloche watermark
 * - Intelligent OCR Bounding Boxes (Job No, B/L, Container, Tax Code)
 * - Laser Scanning Beam Sweep & Digital Data Stream
 * - Official ISO 27001 Security Seal & QR Code
 */
export function Document3D({
  className = '',
  width = 440,
  height = 580,
  isDigitizing = false,
  showLaser = false,
  showOcrBoxes = false,
  tiltX = 0,
  tiltY = 0,
  scale = 1,
  opacity = 1,
  docTitle = 'VẬN ĐƠN ĐƯỜNG BIỂN QUỐC TẾ · BILL OF LADING',
  docCode = 'TML-BL-2026-X89',
  theme = 'light',
  children,
}: Document3DProps) {
  const isDark = theme === 'dark'

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-700 ease-out preserve-3d overflow-hidden ${
        isDark
          ? 'border-blue-500/30 bg-[#07182F] text-white shadow-[0_25px_60px_-15px_rgba(0,10,30,0.8)]'
          : 'border-slate-200/90 bg-white text-slate-800 shadow-[0_20px_50px_-12px_rgba(10,30,60,0.15),0_4px_16px_rgba(0,0,0,0.06)]'
      } ${className}`}
      style={{
        width,
        height,
        opacity,
        transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(${scale}, ${scale}, 1)`,
        boxShadow: isDigitizing
          ? '0 25px 50px -12px rgba(10, 101, 255, 0.45), 0 0 35px rgba(0, 102, 255, 0.3)'
          : undefined,
      }}
    >
      {/* Paper Top Corner Fold / Texture */}
      <div
        className="absolute top-0 right-0 size-10 pointer-events-none"
        style={{
          background: isDark
            ? 'linear-gradient(225deg, rgba(255,255,255,0.1) 0%, transparent 50%)'
            : 'linear-gradient(225deg, rgba(0,0,0,0.06) 0%, transparent 50%)',
        }}
      />

      {/* Security Guilloche Background Watermark */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: isDark ? 0.05 : 0.035,
          backgroundImage:
            'repeating-linear-gradient(45deg, #0875E8 0, #0875E8 1px, transparent 0, transparent 12px)',
        }}
      />

      {/* Laser Scanning Beam Sweep */}
      {(showLaser || isDigitizing) && (
        <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_18px_5px_rgba(34,211,238,0.85)] z-30 animate-scan-beam pointer-events-none">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan-500/90 text-[9px] font-mono font-bold text-white tracking-widest uppercase shadow-md flex items-center gap-1">
            <ScanIcon className="size-2.5 animate-spin" />
            <span>INTELLIGENT OCR 256-BIT</span>
          </div>
        </div>
      )}

      {/* Document Content Container */}
      <div className="relative z-10 flex h-full flex-col justify-between p-6">
        {/* Document Header */}
        <div className={`border-b pb-3.5 ${isDark ? 'border-blue-900/60' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-[#0875E8] text-white shadow-md shadow-blue-500/30">
                <FileTextIcon className="size-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[#0875E8] uppercase">
                  TÂN MINH LOGISTICS INTELLIGENT VAULT
                </div>
                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {docTitle}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-[11px] font-bold text-[#0875E8]">{docCode}</span>
              <span className="text-[9px] text-muted-foreground font-mono">ISO 27001 VERIFIED</span>
            </div>
          </div>
        </div>

        {/* Custom Body (Or Default Logistics Document Body) */}
        <div className="my-auto py-2">
          {children || (
            <div className="space-y-3.5">
              {/* Shipper & Consignee Boxes with OCR Bounding Box Highlights */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div
                  className={`relative rounded-lg border p-2.5 transition-all duration-500 ${
                    showOcrBoxes
                      ? 'border-cyan-400/80 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40'
                      : isDark
                        ? 'border-blue-900/50 bg-[#0B2D59]/40'
                        : 'border-slate-200 bg-slate-50/80'
                  }`}
                >
                  {showOcrBoxes && (
                    <span className="absolute -top-2 right-2 rounded bg-cyan-500 px-1 py-0.2 text-[8px] font-mono text-white font-bold">
                      OCR: SHIPPER (99.4%)
                    </span>
                  )}
                  <div className="text-[10px] text-muted-foreground">Người gửi hàng (Shipper)</div>
                  <div className="font-bold text-foreground">TML CO., LTD — VIETNAM</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Tax ID: 0100109106</div>
                </div>

                <div
                  className={`relative rounded-lg border p-2.5 transition-all duration-500 ${
                    showOcrBoxes
                      ? 'border-cyan-400/80 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40'
                      : isDark
                        ? 'border-blue-900/50 bg-[#0B2D59]/40'
                        : 'border-slate-200 bg-slate-50/80'
                  }`}
                >
                  {showOcrBoxes && (
                    <span className="absolute -top-2 right-2 rounded bg-cyan-500 px-1 py-0.2 text-[8px] font-mono text-white font-bold">
                      OCR: CONSIGNEE (98.9%)
                    </span>
                  )}
                  <div className="text-[10px] text-muted-foreground">Người nhận hàng (Consignee)</div>
                  <div className="font-bold text-foreground">PACIFIC LOGISTICS HUB</div>
                  <div className="text-[10px] text-muted-foreground font-mono">Port: VNSGN (Cát Lái)</div>
                </div>
              </div>

              {/* Logistics Cargo Details Table */}
              <div
                className={`relative rounded-lg border p-3 space-y-2 transition-all duration-500 ${
                  showOcrBoxes
                    ? 'border-cyan-400/80 bg-cyan-500/10 shadow-[0_0_12px_rgba(34,211,238,0.25)] ring-1 ring-cyan-400/40'
                    : isDark
                      ? 'border-blue-900/50 bg-[#0B2D59]/30'
                      : 'border-slate-200 bg-slate-50/60'
                }`}
              >
                {showOcrBoxes && (
                  <span className="absolute -top-2 right-2 rounded bg-cyan-500 px-1 py-0.2 text-[8px] font-mono text-white font-bold">
                    OCR: CARGO TABLE (99.1%)
                  </span>
                )}
                <div className="flex justify-between text-[11px] font-bold border-b pb-1">
                  <span>Mô tả hàng hóa (Goods Description)</span>
                  <span className="font-mono">Mã HS Code</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Robusta Green Coffee Beans Grade 1</span>
                  <span className="font-mono font-semibold text-foreground">0901.11.10</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Black Pepper 500g/l FAQ Clean</span>
                  <span className="font-mono font-semibold text-foreground">0904.11.20</span>
                </div>
              </div>

              {/* Barcode, Container Number & Verification Seal */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BarcodeIcon className="size-8" />
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] font-bold tracking-widest text-foreground">
                      *TML-SE2611-3483*
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground">CONT: TEMU9482103 (40HC)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <ShieldCheckIcon className="size-3.5" />
                  <span>XÁC THỰC SỐ HÓA</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Document Footer */}
        <div
          className={`flex items-center justify-between border-t pt-2.5 text-[9px] text-muted-foreground ${
            isDark ? 'border-blue-900/60' : 'border-slate-200'
          }`}
        >
          <span className="font-mono">TML SECURE LOGISTICS VAULT // 2026</span>
          <span className="flex items-center gap-1 font-mono text-[#0875E8]">
            <QrCodeIcon className="size-3" />
            SHA-256: 8f4a..92bc
          </span>
        </div>
      </div>
    </div>
  )
}
