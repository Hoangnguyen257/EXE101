'use client'

import React, { useState } from 'react'
import {
  ShieldCheckIcon,
  QrCodeIcon,
  FileTextIcon,
  BarcodeIcon,
  ScanIcon,
  CheckIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  EyeOffIcon,
  SparklesIcon,
  CheckCircle2Icon,
  UserCheckIcon,
} from 'lucide-react'
import { TMLLogoScene } from './TMLLogoScene'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'

export type DocumentViewMode = 'DOCUMENT' | 'FORM' | 'DIGITIZING'

export interface Document3DProps {
  className?: string
  width?: number | string
  height?: number | string
  viewMode?: DocumentViewMode
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
  onLoginSuccess?: (targetUrl: string) => void
  isSuccessMorphing?: boolean
  children?: React.ReactNode
}

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@tml.vn', label: 'Nguyễn Hoàng (Admin/Giám đốc)', color: 'bg-red-500/10 text-red-600 border-red-200' },
  { role: 'MANAGER', email: 'ha.tran@tml.vn', label: 'Trần Thu Hà (Manager Chứng từ)', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  { role: 'STAFF', email: 'lan.pham@tml.vn', label: 'Phạm Ngọc Lan (Staff Chứng từ)', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
]

/**
 * 3D Physical Document Sheet (Task 16 - Seamless Document-to-Form Continuity)
 * THE LOGIN FORM IS THE PAPER:
 * The physical paper surface acts as the unified container throughout:
 * 1. Intro (Physical logistics bill of lading)
 * 2. Intelligent OCR Scanning (Bounding boxes and laser sweep)
 * 3. Interactive Login Document (Form formed directly on the paper surface)
 * 4. Digital Archiving (Laser scan & ingestion into TML Logo portal)
 * 5. Logout Outro (Paper reconstructed and restored to the exact same form)
 */
export function Document3D({
  className = '',
  width = 440,
  height,
  viewMode = 'DOCUMENT',
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
  onLoginSuccess,
  isSuccessMorphing = false,
  children,
}: Document3DProps) {
  const isDark = theme === 'dark'

  // Interactive Form States
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPass?: string) => {
    if (e) e.preventDefault()
    setErrorMessage('')
    setLoading(true)

    const loginEmail = customEmail ?? email
    const loginPass = customPass ?? password

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setIsSuccess(true)
        toast.success(`Xác thực thành công. Chào mừng ${data.user?.name || 'Quý khách'}!`)
        if (onLoginSuccess) {
          onLoginSuccess(data.targetUrl || '/dashboard')
        } else {
          setTimeout(() => {
            window.location.href = data.targetUrl || '/dashboard'
          }, 1200)
        }
      } else {
        setErrorMessage(data.error || 'Email hoặc mật khẩu không chính xác.')
        toast.error(data.error || 'Đăng nhập không thành công.')
        setLoading(false)
      }
    } catch {
      setErrorMessage('Không thể kết nối đến máy chủ bảo mật. Vui lòng thử lại.')
      toast.error('Lỗi kết nối')
      setLoading(false)
    }
  }

  const fillAccountEmail = (accEmail: string) => {
    setEmail(accEmail)
    setPassword('Tml@2026!')
    handleLogin(undefined, accEmail, 'Tml@2026!')
  }

  const isFormMode = viewMode === 'FORM'
  const isScanningOrDoc = viewMode === 'DOCUMENT' || viewMode === 'DIGITIZING'

  return (
    <div
      className={`relative w-full max-w-[440px] rounded-2xl border transition-all duration-700 ease-out preserve-3d overflow-hidden select-none ${
        isDark
          ? 'border-blue-500/30 bg-[#07182F] text-white shadow-[0_25px_60px_-15px_rgba(0,10,30,0.8)]'
          : 'border-slate-200/90 bg-white text-slate-800 shadow-[0_20px_50px_-12px_rgba(10,30,60,0.15),0_4px_16px_rgba(0,0,0,0.06)]'
      } ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        minHeight: height ? (typeof height === 'number' ? `${height}px` : height) : '590px',
        opacity,
        transform: `perspective(1200px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(${scale}, ${scale}, 1)`,
        boxShadow: isDigitizing
          ? '0 25px 50px -12px rgba(10, 101, 255, 0.45), 0 0 35px rgba(0, 102, 255, 0.3)'
          : undefined,
      }}
    >
      {/* Paper Top Corner Fold / Texture */}
      <div
        className="absolute top-0 right-0 size-10 pointer-events-none z-20"
        style={{
          background: isDark
            ? 'linear-gradient(225deg, rgba(255,255,255,0.12) 0%, transparent 50%)'
            : 'linear-gradient(225deg, rgba(0,0,0,0.07) 0%, transparent 50%)',
        }}
      />

      {/* Security Guilloche Background Watermark */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          opacity: isDark ? 0.05 : 0.035,
          backgroundImage:
            'repeating-linear-gradient(45deg, #0875E8 0, #0875E8 1px, transparent 0, transparent 12px)',
        }}
      />

      {/* Laser Scanning Beam Sweep */}
      {(showLaser || isDigitizing) && (
        <div className="absolute inset-x-0 h-1.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_18px_5px_rgba(34,211,238,0.85)] z-40 animate-scan-beam pointer-events-none">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan-500/90 text-[9px] font-mono font-bold text-white tracking-widest uppercase shadow-md flex items-center gap-1">
            <ScanIcon className="size-2.5 animate-spin" />
            <span>INTELLIGENT OCR 256-BIT</span>
          </div>
        </div>
      )}

      {/* Unified Paper Content Container */}
      <div className="relative z-10 flex min-h-[590px] flex-col justify-between p-6">
        {/* Document Header (Present across both Document and Form modes) */}
        <div className={`border-b pb-3.5 transition-colors duration-500 ${isDark ? 'border-blue-900/60' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0875E8] to-[#044ba0] text-white shadow-md shadow-blue-500/25">
                <TMLLogoScene size={30} showGlow={false} />
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[#0875E8] uppercase flex items-center gap-1.5">
                  <span>TML DOCMANAGER</span>
                  <span className="size-1 rounded-full bg-amber-500" />
                  <span className="text-slate-400 font-medium">LOGISTICS VAULT</span>
                </div>
                <div className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {isFormMode ? 'XÁC THỰC QUYỀN TRUY CẬP CHỨNG TỪ' : docTitle}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-mono text-[11px] font-bold text-[#0875E8]">
                {isFormMode ? 'TML / SECURE ACCESS' : docCode}
              </span>
              <span className="text-[9px] text-muted-foreground font-mono">ISO 27001 VERIFIED</span>
            </div>
          </div>
        </div>

        {/* --- MAIN BODY TRANSFORMATION REGION --- */}
        <div className="my-auto py-2">
          {children ? (
            children
          ) : isFormMode ? (
            /* =========================================================================
               MODE 1: INTERACTIVE LOGIN DOCUMENT (Form is the Paper surface)
               ========================================================================= */
            <div className="space-y-4 transition-all duration-500">
              {/* Form Title & Subtitle */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold tracking-tight text-slate-900 dark:text-white">
                    Chào mừng quay trở lại
                  </h2>
                  <Badge variant="outline" className="border-blue-200 text-[#0875E8] bg-blue-50/50 text-[10px] font-mono">
                    SECURE WORKSPACE ACCESS
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Truy cập không gian làm việc chứng từ thông minh của Tân Minh Logistics.
                </p>
              </div>

              {/* Error Alert */}
              {errorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400 animate-in fade-in">
                  {errorMessage}
                </div>
              )}

              {/* Interactive Form Fields */}
              <form onSubmit={handleLogin} className="space-y-3.5">
                {/* Email Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="doc-email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Email chuyên viên
                  </Label>
                  <div className="relative">
                    <MailIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="doc-email"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="chuyenvien@tml.vn"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="pl-9 text-xs h-9 border-slate-200 focus-visible:ring-[#0875E8] bg-slate-50/50 dark:bg-slate-900/50 transition-colors"
                      disabled={loading || isSuccess || isSuccessMorphing}
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="doc-password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Mật khẩu bảo mật
                    </Label>
                    <span className="text-[11px] text-[#0875E8] hover:underline cursor-pointer">
                      Quên mật khẩu?
                    </span>
                  </div>
                  <div className="relative">
                    <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="doc-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pl-9 pr-9 text-xs h-9 border-slate-200 focus-visible:ring-[#0875E8] bg-slate-50/50 dark:bg-slate-900/50 transition-colors"
                      disabled={loading || isSuccess || isSuccessMorphing}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Checkbox */}
                <div className="flex items-center space-x-2 pt-0.5">
                  <input
                    type="checkbox"
                    id="doc-remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="size-3.5 rounded border-slate-300 text-[#0875E8] focus:ring-[#0875E8]"
                  />
                  <label htmlFor="doc-remember" className="text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    Ghi nhớ phiên đăng nhập trên thiết bị này
                  </label>
                </div>

                {/* Quick Demo Accounts Selection */}
                <div className="pt-1">
                  <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-500">
                    <span className="flex items-center gap-1 font-medium">
                      <UserCheckIcon className="size-3 text-[#0875E8]" />
                      Tài khoản thử nghiệm:
                    </span>
                    <span className="text-[10px] text-muted-foreground font-mono">Pass: Tml@2026!</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {DEMO_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() => fillAccountEmail(acc.email)}
                        className={`truncate rounded border px-2 py-1 text-[11px] font-semibold transition-all hover:scale-102 active:scale-98 ${acc.color}`}
                        disabled={loading || isSuccess || isSuccessMorphing}
                      >
                        {acc.role}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sign In Button */}
                <Button
                  type="submit"
                  disabled={loading || isSuccess || isSuccessMorphing}
                  className={`w-full h-10 font-medium text-xs shadow-md transition-all duration-300 ${
                    isSuccess
                      ? 'bg-emerald-600 hover:bg-emerald-600 text-white shadow-emerald-500/25 ring-2 ring-emerald-400/50'
                      : 'bg-[#0875E8] hover:bg-[#0661c4] text-white shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.99]'
                  }`}
                >
                  {isSuccess ? (
                    <span className="flex items-center gap-1.5 font-bold tracking-wider uppercase text-white animate-in zoom-in-95">
                      <CheckCircle2Icon className="size-4 text-white" />
                      ACCESS GRANTED · XÁC THỰC THÀNH CÔNG
                    </span>
                  ) : loading ? (
                    <span className="flex items-center gap-2">
                      <span className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Đang xác thực thông tin...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <ShieldCheckIcon className="size-4" />
                      MỞ KHÓA KHO CHỨNG TỪ (SIGN IN)
                    </span>
                  )}
                </Button>
              </form>
            </div>
          ) : (
            /* =========================================================================
               MODE 2: PHYSICAL LOGISTICS DOCUMENT (Bill of Lading / Cargo / OCR)
               ========================================================================= */
            <div className="space-y-3.5 transition-all duration-500">
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

        {/* Unified Document Footer */}
        <div
          className={`flex flex-col gap-1.5 border-t pt-2.5 text-[9px] text-muted-foreground transition-colors duration-500 ${
            isDark ? 'border-blue-900/60' : 'border-slate-200'
          }`}
        >
          {/* Subtle Orange Accent Bar inspired by TML Logo */}
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-80" />
          <div className="flex items-center justify-between">
            <span className="font-mono">
              {isFormMode ? 'Secure Document Access · TML Logistics' : 'TML SECURE LOGISTICS VAULT // 2026'}
            </span>
            <span className="flex items-center gap-1 font-mono text-[#0875E8]">
              <QrCodeIcon className="size-3" />
              SHA-256: 8f4a..92bc
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
