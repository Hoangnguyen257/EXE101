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
      toast.success('Đăng nhập thành công', { description: 'Chào mừng bạn quay trở lại hệ thống TML.' })

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
    <div className={`w-full max-w-md transition-all duration-700 ${className}`}>
      {/* Brand Header */}
      <div className="mb-5 flex flex-col items-center text-center">
        <TMLLogoScene size={70} className="mb-2" showGlow />
        <h1 className="text-2xl font-bold tracking-tight text-foreground">TML DocManager</h1>
        <p className="text-xs text-muted-foreground">Hệ thống Quản lý Chứng từ Logistics Tân Minh</p>
      </div>

      <Card className="border-border/60 shadow-xl backdrop-blur-sm bg-card/95">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-lg font-bold">Đăng nhập tài khoản</CardTitle>
          <CardDescription className="text-xs">
            Nhập email công vụ và mật khẩu để truy cập vào hệ thống
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold">
                Email công vụ
              </Label>
              <div className="relative">
                <MailIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  placeholder="ten.nguoidung@tml.vn"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="pl-9 text-xs"
                  disabled={loading || isSuccess || isSuccessMorphing}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold">
                  Mật khẩu
                </Label>
                <span className="text-[11px] text-muted-foreground">Bảo mật chuẩn ISO 27001</span>
              </div>
              <div className="relative">
                <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="pl-9 pr-9 text-xs"
                  disabled={loading || isSuccess || isSuccessMorphing}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                  disabled={loading}
                >
                  {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                </button>
              </div>
            </div>

            {/* Quick Demo Accounts Selection */}
            <div className="rounded-lg border bg-muted/30 p-2.5">
              <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span className="flex items-center gap-1.5 text-[11px]">
                  <UserCheckIcon className="size-3.5" />
                  Chọn tài khoản kiểm thử nhanh:
                </span>
              </div>
              <div className="grid gap-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillAccountEmail(acc.email)}
                    disabled={loading || isSuccess || isSuccessMorphing}
                    className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent disabled:opacity-50"
                  >
                    <span className="font-medium text-foreground">{acc.label}</span>
                    <Badge variant="outline" className={`text-[10px] ${acc.color}`}>
                      {acc.role}
                    </Badge>
                  </button>
                ))}
              </div>
              <div className="mt-1.5 text-center text-[11px] text-muted-foreground">
                Mật khẩu chung: <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[10px] font-semibold text-foreground border">Tml@2026!</code>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2.5 pt-1">
            <Button
              type="submit"
              className={`w-full font-semibold transition-all duration-300 ${
                isSuccess
                  ? 'bg-success hover:bg-success text-success-foreground'
                  : 'bg-primary hover:bg-primary/90'
              }`}
              disabled={loading || isSuccess || isSuccessMorphing}
            >
              {isSuccess ? (
                <span className="flex items-center gap-2">
                  <CheckCircle2Icon className="size-4" />
                  Đăng nhập thành công! Đang số hóa chứng từ...
                </span>
              ) : loading ? (
                'Đang xác thực thông tin...'
              ) : (
                'Đăng nhập vào hệ thống'
              )}
            </Button>
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheckIcon className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Phiên đăng nhập được mã hóa JWT 256-bit an toàn</span>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

