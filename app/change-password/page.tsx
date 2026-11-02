'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRoundIcon, ShieldAlertIcon, LockIcon, LogOutIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function ForceChangePasswordPage() {
  const router = useRouter()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMessage('Vui lòng điền đầy đủ tất cả các trường.')
      return
    }

    if (newPassword.length < 8) {
      setErrorMessage('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không khớp.')
      return
    }

    if (newPassword === currentPassword) {
      setErrorMessage('Mật khẩu mới không được trùng với mật khẩu hiện tại.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Đổi mật khẩu thất bại.')
        toast.error('Không thành công', { description: data.error })
        setLoading(false)
        return
      }

      toast.success('Đổi mật khẩu thành công!', {
        description: 'Mật khẩu đã được cập nhật. Đang chuyển hướng vào hệ thống...',
      })

      // Điều hướng trực tiếp vào trang quản trị
      window.location.href = '/dashboard'
    } catch {
      setErrorMessage('Không thể kết nối đến máy chủ xác thực.')
      toast.error('Lỗi kết nối')
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      window.location.href = '/login'
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg">
            <ShieldAlertIcon className="size-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">TML DocManager</h1>
          <p className="text-sm text-muted-foreground">Yêu cầu bảo mật cấp cao hệ thống</p>
        </div>

        <Card className="border-border/60 shadow-xl">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl flex items-center gap-2">
              <KeyRoundIcon className="size-5 text-amber-600" />
              Đổi mật khẩu khởi tạo
            </CardTitle>
            <CardDescription>
              Tài khoản của bạn đang sử dụng mật khẩu khởi tạo. Vì lý do an toàn bảo mật, bạn bắt buộc phải đổi mật khẩu mới ở lần đăng nhập đầu tiên.
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleChangePassword}>
            <CardContent className="space-y-4">
              {errorMessage && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive border border-destructive/20 font-medium">
                  {errorMessage}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mật khẩu hiện tại (khởi tạo)</Label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="Nhập mật khẩu hiện tại..."
                    className="pl-9"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">Mật khẩu mới (tối thiểu 8 ký tự)</Label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Nhập mật khẩu mới an toàn..."
                    className="pl-9"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Nhập lại mật khẩu mới..."
                    className="pl-9"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Đang cập nhật mật khẩu...' : 'Cập nhật mật khẩu & Vào hệ thống'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleLogout}
              >
                <LogOutIcon className="size-4 mr-2" /> Đăng xuất khỏi hệ thống
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  )
}
