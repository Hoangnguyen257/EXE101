'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { KeyRoundIcon, LockIcon, ArrowLeftIcon, CheckCircle2Icon } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage('')

    if (!token) {
      setErrorMessage('Thiếu mã xác nhận (token) đặt lại mật khẩu.')
      return
    }

    if (!newPassword || !confirmPassword) {
      setErrorMessage('Vui lòng nhập mật khẩu mới và xác nhận mật khẩu.')
      return
    }

    if (newPassword.length < 8) {
      setErrorMessage('Mật khẩu mới phải có ít nhất 8 ký tự.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không trùng khớp.')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErrorMessage(data.error || 'Đặt lại mật khẩu thất bại.')
        toast.error('Không thành công', { description: data.error })
        setLoading(false)
        return
      }

      setIsSuccess(true)
      toast.success('Thành công', { description: data.message })
    } catch {
      setErrorMessage('Đã xảy ra lỗi kết nối máy chủ. Vui lòng thử lại.')
      setLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2Icon className="size-6" />
          </div>
          <CardTitle className="text-xl font-bold">Đặt lại mật khẩu thành công</CardTitle>
          <CardDescription>
            Mật khẩu mới của bạn đã được cập nhật an toàn. Mọi phiên đăng nhập trước đó đã được thu hồi.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex justify-center">
          <Button onClick={() => router.push('/login')} className="w-full">
            Đăng nhập ngay
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md shadow-lg">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <KeyRoundIcon className="size-6" />
        </div>
        <CardTitle className="text-xl font-bold">Đặt lại mật khẩu tài khoản</CardTitle>
        <CardDescription>
          Nhập mật khẩu mới cho tài khoản của bạn. Mật khẩu phải có tối thiểu 8 ký tự.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleResetPassword}>
        <CardContent className="space-y-4">
          {errorMessage && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm font-medium text-destructive">
              {errorMessage}
            </div>
          )}

          {!token && (
            <div className="rounded-md bg-warning/10 p-3 text-sm text-warning">
              Không tìm thấy token đặt lại mật khẩu trong liên kết. Vui lòng kiểm tra lại liên kết được gửi bởi Admin.
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="newPassword">Mật khẩu mới</Label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="newPassword"
                type="password"
                placeholder="Tối thiểu 8 ký tự..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading || !token}
                className="pl-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
            <div className="relative">
              <LockIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Nhập lại mật khẩu mới..."
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading || !token}
                className="pl-9"
                required
              />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" disabled={loading || !token} className="w-full">
            {loading ? 'Đang cập nhật...' : 'Cập nhật mật khẩu mới'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => router.push('/login')}
          >
            <ArrowLeftIcon className="mr-1.5 size-4" />
            Quay lại trang Đăng nhập
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-muted/30">
      <Suspense fallback={<div className="text-center p-8">Đang tải biểu mẫu...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
