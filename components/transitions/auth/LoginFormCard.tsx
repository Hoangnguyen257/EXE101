'use client'

import React, { useState } from 'react'
import { EyeIcon, EyeOffIcon, LockIcon, MailIcon, ShieldCheckIcon, UserCheckIcon, CheckCircle2Icon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TMLLogoScene } from '../shared/TMLLogoScene'

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@tml.vn', label: 'Nguyễn Hoàng (Admin/Giám đốc)', color: 'bg-red-500/10 text-red-600 border-red-200' },
  { role: 'MANAGER', email: 'ha.tran@tml.vn', label: 'Trần Thu Hà (Manager Chứng từ)', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  { role: 'STAFF', email: 'lan.pham@tml.vn', label: 'Phạm Ngọc Lan (Staff Chứng từ)', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
]

export interface LoginFormCardProps {
  onLoginSuccess?: (targetUrl: string) => void
  isSuccessMorphing?: boolean
  className?: string
}

/**
 * Light Premium Login Form (Task 16 - Intelligent Document Vault)
 * Form được định hình theo kích thước và tỷ lệ của tờ chứng từ A4 tiêu chuẩn,
 * sử dụng bảng màu sáng cao cấp (#FFFFFF / #F5F8FC / Soft Gray #E9EEF5).
 */
export function LoginFormCard({
  onLoginSuccess,
  isSuccessMorphing = false,
  className = '',
}: LoginFormCardProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        credentials: 'include',
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      })

      const data = await res.json()

      if (!res.ok) {
        const desc = data.detail ? `${data.error} (${data.detail})` : data.error || 'Đăng nhập thất bại.'
        setErrorMessage(desc)
        toast.error('Đăng nhập không thành công', { description: desc })
        setLoading(false)
        return
      }

      setIsSuccess(true)
      toast.success('Xác thực thành công', { description: 'Chào mừng bạn quay trở lại hệ thống TML.' })

      const targetUrl = data.mustChangePassword ? '/change-password' : '/dashboard'

      if (onLoginSuccess) {
        onLoginSuccess(targetUrl)
      } else {
        window.location.replace(targetUrl)
      }
    } catch {
      setErrorMessage('Không thể kết nối đến máy chủ xác thực.')
      toast.error('Lỗi kết nối')
      setLoading(false)
    }
  }

  const fillAccountEmail = (accEmail: string) => {
    setEmail(accEmail)
    setPassword('Tml@2026!')
    handleLogin(undefined, accEmail, 'Tml@2026!')
  }

  return (
    <div className={`w-full max-w-[440px] transition-all duration-700 select-none ${className}`}>
      {/* Brand Header */}
      <div className="mb-4 flex flex-col items-center text-center">
        <TMLLogoScene size={72} className="mb-2 drop-shadow-md" showGlow />
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          TML DocManager
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          Hệ thống Quản lý & Khai thác Chứng từ Logistics
        </p>
      </div>

      {/* Main Form Sheet - Light Premium Document Style */}
      <Card className="border border-slate-200/90 dark:border-blue-900/40 bg-white/95 dark:bg-[#07182F]/95 shadow-[0_20px_50px_-10px_rgba(10,30,60,0.18)] backdrop-blur-md overflow-hidden rounded-2xl">
        <CardHeader className="space-y-1 pb-3 pt-5 px-6 border-b border-slate-100 dark:border-blue-900/30">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
              Xác thực quyền truy cập
            </CardTitle>
            <span className="text-[10px] font-mono font-bold text-[#0875E8] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
              SECURE LOGIN
            </span>
          </div>
          <CardDescription className="text-xs text-slate-500 dark:text-slate-400">
            Nhập thông tin tài khoản chuyên viên để mở khóa kho lưu trữ chứng từ
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin}>
          <CardContent className="space-y-3.5 pt-4 px-6">
            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-600 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400">
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email công vụ
              </Label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="chuyenvien@tml.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 text-xs h-9 border-slate-200 focus-visible:ring-[#0875E8] bg-slate-50/50 dark:bg-slate-900/50"
                  disabled={loading || isSuccess || isSuccessMorphing}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Mật khẩu bảo mật
                </Label>
              </div>
              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 pr-9 text-xs h-9 border-slate-200 focus-visible:ring-[#0875E8] bg-slate-50/50 dark:bg-slate-900/50 font-mono"
                  disabled={loading || isSuccess || isSuccessMorphing}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>

            {/* Quick Demo Credentials Selector */}
            <div className="rounded-xl border border-slate-100 dark:border-blue-900/30 bg-slate-50/80 dark:bg-slate-900/40 p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                <span className="flex items-center gap-1">
                  <UserCheckIcon className="size-3 text-[#0875E8]" />
                  Tài khoản dùng thử nghiệm:
                </span>
              </div>
              <div className="grid gap-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillAccountEmail(acc.email)}
                    disabled={loading || isSuccess || isSuccessMorphing}
                    className="flex items-center justify-between rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-left text-xs transition-colors hover:border-[#0875E8] hover:bg-blue-50/50 dark:hover:bg-blue-950/30 disabled:opacity-50"
                  >
                    <span className="font-medium text-slate-800 dark:text-slate-200 text-[11px] truncate">
                      {acc.label}
                    </span>
                    <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${acc.color}`}>
                      {acc.role}
                    </Badge>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-center text-[10px] text-slate-500">
                Mật khẩu chung: <code className="rounded bg-white dark:bg-slate-800 px-1 py-0.5 font-mono text-[10px] font-bold text-slate-800 dark:text-slate-200 border border-slate-200">Tml@2026!</code>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2.5 pt-2 pb-5 px-6 border-t border-slate-100 dark:border-blue-900/30">
            <Button
              type="submit"
              className={`w-full h-10 font-bold transition-all duration-300 shadow-md ${
                isSuccess
                  ? 'bg-emerald-600 hover:bg-emerald-600 text-white shadow-emerald-500/20'
                  : 'bg-[#0875E8] hover:bg-[#0764c7] text-white shadow-blue-500/20'
              }`}
              disabled={loading || isSuccess || isSuccessMorphing}
            >
              {isSuccess ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 animate-bounce" />
                  ACCESS GRANTED · ĐANG MỞ KHO LƯU TRỮ...
                </span>
              ) : loading ? (
                'Đang kiểm tra bảo mật...'
              ) : (
                'Đăng nhập vào hệ thống'
              )}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
              <ShieldCheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Phiên làm việc được mã hóa SHA-256 & bảo mật ISO 27001</span>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
