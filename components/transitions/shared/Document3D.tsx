'use client'

import React from 'react'
import { ShieldCheckIcon, QrCodeIcon, FileTextIcon, BarcodeIcon } from 'lucide-react'

interface Document3DProps {
  className?: string
  width?: number | string
  height?: number | string
  isDigitizing?: boolean
  showLaser?: boolean
  tiltX?: number
  tiltY?: number
  scale?: number
  opacity?: number
  docTitle?: string
  docCode?: string
  children?: React.ReactNode
}

/**
 * 3D Physical Document Sheet (Task 16)
 * Renders an enterprise logistics document with micro-details (barcode, stamps, watermarks)
 * and hardware-accelerated 3D perspective transforms.
 */
export function Document3D({
  className = '',
  width = 440,
  height = 560,
  isDigitizing = false,
  showLaser = false,
  tiltX = 0,
  tiltY = 0,
  scale = 1,
  opacity = 1,
  docTitle = 'GIẤY VẬN TẢI ĐƯỜNG BIỂN · BILL OF LADING',
  docCode = 'TML-BL-2026-X89',
  children,
}: Document3DProps) {
  return (
    <div
      className={`relative rounded-xl border border-border/80 bg-background/95 shadow-2xl backdrop-blur-md transition-all duration-700 ease-out preserve-3d overflow-hidden ${className}`}
      style={{
        width,
        height,
        opacity,
        transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(${scale}, ${scale}, 1)`,
        boxShadow: isDigitizing
          ? '0 25px 50px -12px rgba(10, 101, 255, 0.35), 0 0 30px rgba(0, 102, 255, 0.2)'
          : '0 20px 40px -10px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      {/* Paper Top Corner Fold / Texture */}
      <div className="absolute top-0 right-0 size-8 bg-gradient-to-bl from-muted-foreground/15 to-transparent pointer-events-none" />

      {/* Security Guilloche Background Watermark */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.035]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 12px)',
        }}
      />

      {/* Laser Scanning Beam Sweep */}
      {(showLaser || isDigitizing) && (
        <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_4px_rgba(34,211,238,0.8)] z-30 animate-scan-beam pointer-events-none">
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-cyan-500/80 text-[9px] font-mono font-bold text-white tracking-widest uppercase">
            DIGITIZING OCR 256-BIT
          </div>
        </div>
      )}

      {/* Document Content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-6 text-foreground">
        {/* Document Header */}
        <div className="border-b border-border/70 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <FileTextIcon className="size-4" />
              </div>
              <div>
                <div className="text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                  TÂN MINH LOGISTICS ARCHIVE
                </div>
                <div className="text-xs font-bold text-foreground">{docTitle}</div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-[10px] font-bold text-primary">{docCode}</span>
              <span className="text-[9px] text-muted-foreground">BẢO MẬT ISO 27001</span>
            </div>
          </div>
        </div>

        {/* Custom Body (Or Default Logistics Document Body) */}
        <div className="my-auto py-2">
          {children || (
            <div className="space-y-4">
              {/* Dummy Document Sections */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="rounded border bg-muted/20 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Người gửi hàng (Shipper)</div>
                  <div className="font-medium text-foreground">TML CO., LTD — VIETNAM</div>
                  <div className="text-[10px] text-muted-foreground">Tax: 0100109106</div>
                </div>
                <div className="rounded border bg-muted/20 p-2.5">
                  <div className="text-[10px] text-muted-foreground">Người nhận hàng (Consignee)</div>
                  <div className="font-medium text-foreground">PACIFIC LOGISTICS HUB</div>
                  <div className="text-[10px] text-muted-foreground">Port of Discharge: SGN</div>
                </div>
              </div>

              {/* Data Table Lines */}
              <div className="rounded border border-border/60 bg-muted/10 p-2.5 space-y-2">
                <div className="flex justify-between text-[11px] font-medium border-b pb-1">
                  <span>Mô tả hàng hóa</span>
                  <span>Mã HS Code</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Robusta Green Coffee Beans Grade 1</span>
                  <span className="font-mono">0901.11.10</span>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Black Pepper 500g/l FAQ</span>
                  <span className="font-mono">0904.11.20</span>
                </div>
              </div>

              {/* Barcode and Verification Seal */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <BarcodeIcon className="size-8" />
                  <span className="font-mono text-[9px] tracking-widest">*20261102TML*</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-[10px] font-medium text-success">
                  <ShieldCheckIcon className="size-3.5" />
                  <span>XÁC THỰC SỐ HÓA</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Document Footer */}
        <div className="flex items-center justify-between border-t border-border/70 pt-2.5 text-[9px] text-muted-foreground">
          <span>Hệ thống Quản lý Chứng từ Điện tử TML</span>
          <span className="flex items-center gap-1 font-mono">
            <QrCodeIcon className="size-3 text-primary" />
            HASH: 8f4a..92bc
          </span>
        </div>
      </div>
    </div>
  )
}

