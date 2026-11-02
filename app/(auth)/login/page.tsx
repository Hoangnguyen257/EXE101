'use client'

import React, { useState } from 'react'
import dynamic from 'next/dynamic'
import { IntroExperience } from '@/components/transitions/intro/IntroExperience'

const DynamicLoginSuccessExperience = dynamic(
  () => import('@/components/transitions/auth/LoginSuccessExperience').then((m) => m.LoginSuccessExperience),
  { ssr: false }
)

export default function LoginPage() {
  const [successRedirectUrl, setSuccessRedirectUrl] = useState<string | null>(null)

  const handleLoginSuccess = (targetUrl: string) => {
    // Kích hoạt Flow 2: Form -> Tờ chứng từ -> Số hóa -> Bay vào Logo TML -> Mở Dashboard
    setSuccessRedirectUrl(targetUrl)
  }

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* 1. Màn hình Intro 3D mở hồ sơ & rút chứng từ hiện Form Đăng nhập (Flow 1) */}
      <IntroExperience
        onLoginSuccess={handleLoginSuccess}
        isSuccessMorphing={Boolean(successRedirectUrl)}
      />

      {/* 2. Màn hình Số hóa chứng từ bay vào Logo TML khi Đăng nhập thành công (Flow 2) */}
      {successRedirectUrl && (
        <DynamicLoginSuccessExperience
          targetUrl={successRedirectUrl}
          onComplete={() => {
            window.location.replace(successRedirectUrl)
          }}
        />
      )}
    </main>
  )
}
