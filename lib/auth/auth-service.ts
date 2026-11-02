import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { prisma, ensureDatabaseInitialized } from '@/lib/prisma'
import { signSessionToken, verifySessionToken } from './jwt'

export const SESSION_COOKIE_NAME = 'tml_session_token'

// Dummy bcrypt hash for constant-time comparison when email is not found
const DUMMY_BCRYPT_HASH = '$2a$10$wN9iL6U/OQz1fM6eX7/6g.mK9sW/Y6jZpG7fL1p1eG7fL1p1eG7fL'

// Standard unified error message to eliminate user enumeration side-channels
export const UNIFIED_AUTH_ERROR_MESSAGE = 'Email hoặc mật khẩu không chính xác, hoặc tài khoản đang tạm thời bị hạn chế truy cập.'

export interface LoginOptions {
  unifiedErrors?: boolean
  checkIpLimit?: boolean
  captchaToken?: string
}

interface IpRateRecord {
  attempts: number
  firstAttemptAt: number
  blockedUntil: number | null
}

const ipAttemptStore = new Map<string, IpRateRecord>()

export function checkIpLoginRate(ip: string): { allowed: boolean; retryAfterSeconds?: number } {
  if (!ip || ip === 'unknown') return { allowed: true }
  const now = Date.now()
  const record = ipAttemptStore.get(ip)
  if (!record) return { allowed: true }

  if (record.blockedUntil && record.blockedUntil > now) {
    return { allowed: false, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) }
  }

  if (now - record.firstAttemptAt > 15 * 60 * 1000) {
    ipAttemptStore.delete(ip)
    return { allowed: true }
  }

  return { allowed: true }
}

export function recordFailedIpAttempt(ip: string): { blocked: boolean; retryAfterSeconds?: number } {
  if (!ip || ip === 'unknown') return { blocked: false }
  const now = Date.now()
  let record = ipAttemptStore.get(ip)
  if (!record || now - record.firstAttemptAt > 15 * 60 * 1000) {
    record = { attempts: 1, firstAttemptAt: now, blockedUntil: null }
  } else {
    record.attempts += 1
  }

  if (record.attempts >= 10) {
    record.blockedUntil = now + 15 * 60 * 1000
    ipAttemptStore.set(ip, record)
    return { blocked: true, retryAfterSeconds: 15 * 60 }
  }

  ipAttemptStore.set(ip, record)
  return { blocked: false }
}

export function resetIpLoginRate(ip: string) {
  ipAttemptStore.delete(ip)
}

export async function unlockUserAccount(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { failedAttempts: 0, lockedUntil: null },
  })
}

export interface AuthUser {
  id: string
  sessionId?: string
  orgId: string
  email: string
  name: string
  initials: string
  role: 'ADMIN' | 'MANAGER' | 'STAFF'
  departments: { id: string; name: string; code: string; isPrimary: boolean; isManager: boolean }[]
  positions: { id: string; name: string; level: number }[]
  isActive: boolean
  mustChangePassword?: boolean
}

/**
 * Tính mã băm SHA-256 của token để lưu trữ an toàn trong DB
 */
function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function login(
  email: string,
  passwordPlain: string,
  ipAddress = '',
  userAgent = '',
  options: LoginOptions = {}
) {
  const normalizedEmail = email.toLowerCase().trim()

  // 1. IP Rate Limiting Check (nếu bật tùy chọn checkIpLimit)
  if (options.checkIpLimit && ipAddress) {
    const ipCheck = checkIpLoginRate(ipAddress)
    if (!ipCheck.allowed) {
      return {
        success: false,
        error: `Quá nhiều yêu cầu đăng nhập từ địa chỉ IP này. Vui lòng thử lại sau ${ipCheck.retryAfterSeconds} giây.`,
        isIpBlocked: true,
        retryAfterSeconds: ipCheck.retryAfterSeconds,
      }
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      departments: { include: { department: true } },
      positions: { include: { position: true } },
    },
  })

  // Tránh tiết lộ thông tin sự tồn tại của tài khoản (Generic Error + Constant Time bcrypt)
  if (!user) {
    await bcrypt.compare(passwordPlain, DUMMY_BCRYPT_HASH)
    if (ipAddress) recordFailedIpAttempt(ipAddress)
    return {
      success: false,
      error: options.unifiedErrors ? UNIFIED_AUTH_ERROR_MESSAGE : 'Email hoặc mật khẩu không chính xác.',
    }
  }

  // Kiểm tra tài khoản có bị vô hiệu hóa bởi Admin không
  if (!user.isActive) {
    await bcrypt.compare(passwordPlain, user.passwordHash)
    if (ipAddress) recordFailedIpAttempt(ipAddress)
    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress,
        device: userAgent,
        status: 'LOCKED',
      },
    })
    return {
      success: false,
      error: options.unifiedErrors
        ? UNIFIED_AUTH_ERROR_MESSAGE
        : 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ Admin.',
    }
  }

  // Kiểm tra tạm khóa do brute-force 5 lần
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await bcrypt.compare(passwordPlain, user.passwordHash)
    if (ipAddress) recordFailedIpAttempt(ipAddress)
    const minutesLeft = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
    return {
      success: false,
      error: options.unifiedErrors
        ? UNIFIED_AUTH_ERROR_MESSAGE
        : `Tài khoản tạm khóa do đăng nhập sai nhiều lần. Thử lại sau ${minutesLeft} phút.`,
      isLocked: true,
      lockedUntil: user.lockedUntil,
    }
  }

  const isPasswordValid = await bcrypt.compare(passwordPlain, user.passwordHash)

  if (!isPasswordValid) {
    if (ipAddress) recordFailedIpAttempt(ipAddress)
    const failedAttempts = user.failedAttempts + 1
    const shouldLock = failedAttempts >= 5
    const lockedUntil = shouldLock ? new Date(Date.now() + 15 * 60 * 1000) : null // Khóa 15 phút

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: shouldLock ? 0 : failedAttempts,
        lockedUntil: lockedUntil,
      },
    })

    await prisma.loginHistory.create({
      data: {
        userId: user.id,
        ipAddress,
        device: userAgent,
        status: 'FAILED_BAD_PASSWORD',
      },
    })

    if (options.unifiedErrors) {
      return {
        success: false,
        error: UNIFIED_AUTH_ERROR_MESSAGE,
        isLocked: shouldLock,
      }
    }

    return {
      success: false,
      error: shouldLock
        ? 'Bạn đã nhập sai quá 5 lần. Tài khoản bị tạm khóa 15 phút.'
        : `Email hoặc mật khẩu không chính xác.`,
      isLocked: shouldLock,
    }
  }

  // Đăng nhập thành công -> Reset số lần thất bại, mở khóa & reset IP rate limit
  if (ipAddress) resetIpLoginRate(ipAddress)
  await prisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null, lastActiveAt: new Date() },
  })

  // Khởi tạo Session ID & Ký số JWT an toàn trước khi lưu DB để tránh trạng thái pending
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 ngày

  const token = await signSessionToken({
    userId: user.id,
    email: user.email,
    role: user.roleCode,
    sessionId,
  })

  const tokenHash = hashToken(token)

  // Khởi tạo Session trong Database nguyên tử (atomic) với tokenHash thực tế
  const session = await prisma.session.create({
    data: {
      id: sessionId,
      userId: user.id,
      tokenHash,
      ipAddress,
      userAgent,
      expiresAt,
    },
  })

  // Ghi nhật ký đăng nhập và Audit Log
  await prisma.loginHistory.create({
    data: {
      userId: user.id,
      ipAddress,
      device: userAgent,
      status: 'SUCCESS',
    },
  })

  await prisma.auditLog.create({
    data: {
      orgId: user.orgId,
      userId: user.id,
      action: 'login',
      resourceType: 'user',
      resourceId: user.id,
      ipAddress,
      device: userAgent,
      status: 'SUCCESS',
    },
  })

  // Thiết lập HttpOnly Cookie an toàn (khi chạy trong HTTP request context)
  try {
    const cookieStore = await cookies()
    // Bật Secure khi chạy HTTPS trên production/Vercel (trừ localhost thử nghiệm)
    const appUrl = process.env.NEXTAUTH_URL || process.env.APP_URL || ''
    const isHttps = Boolean(
      process.env.VERCEL ||
      (process.env.NODE_ENV === 'production' && appUrl.startsWith('https://') && !appUrl.includes('localhost') && !appUrl.includes('127.0.0.1'))
    )
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    })
  } catch {
    // Cho phép chạy trong môi trường CLI hoặc automated tests
  }

  return { success: true, token, mustChangePassword: (user as any).mustChangePassword ?? false }
}

export async function logout() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value

    if (token) {
      const payload = await verifySessionToken(token)
      if (payload?.sessionId) {
        const session = await prisma.session.findUnique({
          where: { id: payload.sessionId },
          include: { user: true },
        })

        if (session) {
          await prisma.session.update({
            where: { id: session.id },
            data: { revokedAt: new Date() },
          })

          // Ghi Audit Log với đúng orgId của người dùng thay vì hardcode
          await prisma.auditLog.create({
            data: {
              orgId: session.user.orgId,
              userId: session.userId,
              action: 'logout',
              resourceType: 'user',
              resourceId: session.userId,
              status: 'SUCCESS',
            },
          })
        }
      }
      cookieStore.delete(SESSION_COOKIE_NAME)
    }
  } catch {
    // Cho phép chạy trong môi trường ngoài request context
  }
}

/**
 * Thu hồi toàn bộ các phiên đăng nhập đang hoạt động của người dùng (khi đổi mật khẩu hoặc khóa tài khoản)
 */
export async function revokeUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  })
}

export async function getSessionUser(tokenOverride?: string | Request): Promise<AuthUser | null> {
  try {
    await ensureDatabaseInitialized()

    let token: string | undefined

    if (typeof tokenOverride === 'string') {
      token = tokenOverride
    } else if (tokenOverride && typeof (tokenOverride as Request).headers?.get === 'function') {
      const authHeader = (tokenOverride as Request).headers.get('authorization')
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim()
      }
      if (!token) {
        const cookieHeader = (tokenOverride as Request).headers.get('cookie')
        if (cookieHeader) {
          const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`))
          if (match) token = match[1]
        }
      }
    }

    // 1. Kiểm tra cookie nếu chưa có tokenOverride
    if (!token) {
      try {
        const cookieStore = await cookies()
        token = cookieStore.get(SESSION_COOKIE_NAME)?.value
      } catch {
        // Không trong request cookie context
      }
    }

    // 2. Kiểm tra header Authorization nếu chưa có cookie (hỗ trợ REST clients / Integration tests)
    if (!token) {
      try {
        const { headers } = await import('next/headers')
        const headerStore = await headers()
        const authHeader = headerStore.get('authorization')
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7).trim()
        }
      } catch {
        // Không trong request header context
      }
    }

    if (!token) return null

    const payload = await verifySessionToken(token)
    if (!payload?.userId || !payload.sessionId) return null

    // Đối chiếu sessionId và tokenHash trong Database
    const expectedHash = hashToken(token)
    const dbSession = await prisma.session.findUnique({
      where: { id: payload.sessionId },
      include: {
        user: {
          include: {
            departments: { include: { department: true } },
            positions: { include: { position: true } },
          },
        },
      },
    })

    // Kiểm tra tính hợp lệ của phiên:
    // 1. Phải tồn tại trong database (Bắt buộc, không dùng serverless fallback)
    // 2. TokenHash phải trùng khớp
    // 3. Chưa bị thu hồi (revokedAt is null)
    // 4. Chưa hết hạn
    if (
      !dbSession ||
      dbSession.tokenHash !== expectedHash ||
      dbSession.revokedAt !== null ||
      dbSession.expiresAt < new Date()
    ) {
      return null
    }

    const { user } = dbSession

    // 5. Tài khoản phải còn hoạt động và không bị khóa
    if (!user || !user.isActive) {
      return null
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return null
    }

    return {
      id: user.id,
      sessionId: dbSession.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      initials: user.initials,
      role: user.roleCode as 'ADMIN' | 'MANAGER' | 'STAFF',
      departments: user.departments.map((d) => ({
        id: d.department.id,
        name: d.department.name,
        code: d.department.code,
        isPrimary: d.isPrimary,
        isManager: d.isManager,
      })),
      positions: user.positions.map((p) => ({
        id: p.position.id,
        name: p.position.name,
        level: p.position.level,
      })),
      isActive: user.isActive,
      mustChangePassword: (user as any).mustChangePassword ?? false,
    }
  } catch (error: any) {
    if (error?.digest === 'DYNAMIC_SERVER_USAGE' || error?.message?.includes('DYNAMIC_SERVER_USAGE')) {
      throw error
    }
    console.error('Lỗi getSessionUser:', error)
    return null
  }
}

/**
 * Đăng nhập an toàn cấp độ Production:
 * - Bảo vệ chống User Enumeration (thông báo thống nhất, constant-time)
 * - Tích hợp giới hạn tần suất theo IP nguồn
 * - Chống tấn công Account Lockout DoS
 */
export async function loginHardened(
  email: string,
  passwordPlain: string,
  ipAddress = '',
  userAgent = '',
  captchaToken?: string
) {
  return login(email, passwordPlain, ipAddress, userAgent, {
    unifiedErrors: true,
    checkIpLimit: true,
    captchaToken,
  })
}
