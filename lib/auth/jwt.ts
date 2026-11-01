import { SignJWT, jwtVerify } from 'jose'

const ISSUER = 'tml-logistics'
const AUDIENCE = 'tml-web'
const SHARE_AUDIENCE = 'tml-share-access'

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET

  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret)
  }

  // Resilient fallback for serverless deployments (Vercel, etc.) when env var has not been configured yet
  if (process.env.NODE_ENV === 'production') {
    console.warn(
      '[SECURITY WARNING] JWT_SECRET is not configured or shorter than 32 chars. Using resilient fallback secret for continuity. Please configure JWT_SECRET in your Vercel project environment variables.'
    )
  }

  const devSecret = 'tml-enterprise-super-secure-jwt-secret-key-min-32-chars-2026'
  return new TextEncoder().encode(devSecret)
}

export interface SessionPayload {
  userId: string
  email: string
  role: string
  sessionId: string
}

export interface ShareAccessPayload {
  shareId: string
  token: string
}

/**
 * Tạo JWT Session an toàn với đầy đủ claims: iss, aud, sub, jti, iat, exp
 */
export async function signSessionToken(payload: SessionPayload, expiresIn = '7d'): Promise<string> {
  const secret = getJwtSecret()

  return new SignJWT({
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    sessionId: payload.sessionId,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(payload.userId)
    .setJti(payload.sessionId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret)
}

/**
 * Xác minh chữ ký số JWT, issuer, audience và tính hợp lệ của phiên
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    })

    if (!payload.userId || !payload.sessionId) {
      return null
    }

    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as string,
      sessionId: payload.sessionId as string,
    }
  } catch {
    return null
  }
}

/**
 * Cấp Share Access Token có thời hạn sau khi người dùng nhập đúng mật khẩu link chia sẻ
 */
export async function signShareAccessToken(
  params: { shareId: string; token: string; documentId?: string } | string,
  tokenOrExpires?: string | number,
  expiresIn = '2h'
): Promise<string> {
  const secret = getJwtSecret()
  let shareId: string
  let token: string
  let exp = '2h'

  if (typeof params === 'object') {
    shareId = params.shareId
    token = params.token
    if (typeof tokenOrExpires === 'number') {
      exp = `${tokenOrExpires}s`
    } else if (typeof tokenOrExpires === 'string') {
      exp = tokenOrExpires
    }
  } else {
    shareId = params
    token = typeof tokenOrExpires === 'string' ? tokenOrExpires : ''
    exp = expiresIn
  }

  return new SignJWT({
    shareId,
    token,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(ISSUER)
    .setAudience(SHARE_AUDIENCE)
    .setSubject(`share:${shareId}`)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret)
}

/**
 * Xác minh Share Access Token cho đúng tài liệu chia sẻ
 */
export async function verifyShareAccessToken(
  credentialToken: string,
  expectedShareId?: string,
  expectedToken?: string
): Promise<{ shareId: string; token: string } | null> {
  try {
    const secret = getJwtSecret()
    const { payload } = await jwtVerify(credentialToken, secret, {
      issuer: ISSUER,
      audience: SHARE_AUDIENCE,
    })

    if (!payload.shareId || !payload.token) {
      return null
    }

    if (expectedShareId && payload.shareId !== expectedShareId) {
      return null
    }

    if (expectedToken && payload.token !== expectedToken) {
      return null
    }

    return {
      shareId: payload.shareId as string,
      token: payload.token as string,
    }
  } catch {
    return null
  }
}
