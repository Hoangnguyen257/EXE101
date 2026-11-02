'use client'

import React from 'react'
import { Document3D } from '../shared/Document3D'

export interface LoginFormCardProps {
  onLoginSuccess?: (targetUrl: string) => void
  isSuccessMorphing?: boolean
  className?: string
}

/**
 * Light Premium Login Form (Task 16 - Intelligent Document Vault)
 * THE LOGIN FORM IS THE PAPER:
 * Wraps Document3D in viewMode="FORM", ensuring 100% visual and geometric
 * continuity without rendering a separate external card.
 * Preserves all 3 demo accounts:
 * - admin@tml.vn (Nguyễn Hoàng - Admin)
 * - ha.tran@tml.vn (Trần Thu Hà - Manager)
 * - lan.pham@tml.vn (Phạm Ngọc Lan - Staff)
 * Default password: Tml@2026!
 * Features ACCESS GRANTED and XÁC THỰC THÀNH CÔNG security confirmation states.
 */
export function LoginFormCard({
  onLoginSuccess,
  isSuccessMorphing = false,
  className = '',
}: LoginFormCardProps) {
  return (
    <div className={`w-full max-w-[440px] flex justify-center ${className}`}>
      <Document3D
        viewMode="FORM"
        theme="light"
        onLoginSuccess={onLoginSuccess}
        isSuccessMorphing={isSuccessMorphing}
        tiltX={0}
        tiltY={0}
        scale={1}
      />
    </div>
  )
}
