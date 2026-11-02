'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EyeIcon, EyeOffIcon, FileStackIcon, LockIcon, MailIcon, ShieldCheckIcon, UserCheckIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const DEMO_ACCOUNTS = [
  { role: 'ADMIN', email: 'admin@tml.vn', label: 'Nguyễn Hoàng (Admin/Giám đốc)', color: 'bg-red-500/10 text-red-600 border-red-200' },
  { role: 'MANAGER', email: 'ha.tran@tml.vn', label: 'Trần Thu Hà (Manager Chứng từ)', color: 'bg-amber-500/10 text-amber-600 border-amber-200' },
  { role: 'STAFF', email: 'lan.pham@tml.vn', label: 'Phạm Ngọc Lan (Staff Chứng từ)', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
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
        const desc = data.detail ? `${data.error} (${data.detail})` : (data.error || 'Đăng nhập thất bại.')
        setErrorMessage(desc)
        toast.error('Đăng nhập không thành công', { description: desc })
        setLoading(false)
        return
      }

      toast.success('Đăng nhập thành công', { description: 'Chào mừng bạn quay trở lại hệ thống TML.' })

      const targetUrl = data.mustChangePassword ? '/change-password' : '/dashboard'
      // Điều hướng ngay lập tức vào trang mục tiêu
      window.location.replace(targetUrl)

      // Phòng vệ giao diện: mở lại trạng thái sau 4 giây nếu trình duyệt trễ kết nối
      setTimeout(() => {
        setLoading(false)
      }, 4000)
    } catch {
      setErrorMessage('Không thể kết nối đến máy chủ xác thực.')
      toast.error('Lỗi kết nối')
      setLoading(false)
    }
  }

  const fillAccountEmail = (accEmail: string) => {
    setEmail(accEmail)
    setPassword('Tml@2026!')
    // Tự động đăng nhập nhanh với tài khoản thử nghiệm
    handleLogin(undefined, accEmail, 'Tml@2026!')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <FileStackIcon className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">TML DocManager</h1>
          <p className="text-sm text-muted-foreground">Hệ thống Quản lý Chứng từ Logistics Tân Minh</p>
        </div>

        <Card className="border-border/60 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Đăng nhập tài khoản</CardTitle>
            <CardDescription>Nhập email công vụ và mật khẩu để truy cập vào hệ thống</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email công vụ</Label>
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
                    className="pl-9"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Mật khẩu</Label>
                  <span className="text-xs text-muted-foreground">Bảo mật chuẩn ISO 27001</span>
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
                    className="pl-9 pr-9"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <UserCheckIcon className="size-3.5" />
                    Chọn email tài khoản:
                  </span>
                </div>
                <div className="grid gap-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => fillAccountEmail(acc.email)}
                      disabled={loading}
                      className="flex items-center justify-between rounded-md border bg-background px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                    >
                      <span className="font-medium text-foreground">{acc.label}</span>
                      <Badge variant="outline" className={acc.color}>
                        {acc.role}
                      </Badge>
                    </button>
                  ))}
                </div>
                <div className="mt-2 text-center text-xs text-muted-foreground">
                  Mật khẩu tài khoản thử nghiệm: <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground border">Tml@2026!</code>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Đang xác thực & chuyển hướng...' : 'Đăng nhập vào hệ thống'}
              </Button>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheckIcon className="size-3.5 text-success" />
                <span>Phiên đăng nhập được mã hóa JWT 256-bit an toàn</span>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}

