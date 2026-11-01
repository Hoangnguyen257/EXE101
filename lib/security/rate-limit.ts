/**
 * In-memory sliding window rate limiter
 * Thích hợp cho môi trường Node.js / Serverless instance đơn lẻ.
 */

interface RateLimitRecord {
  attempts: number
  firstAttemptAt: number
  blockedUntil: number | null
}

const rateLimitStore = new Map<string, RateLimitRecord>()

// Dọn dẹp bản ghi cũ định kỳ mỗi 5 phút (unref để không block event loop)
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of rateLimitStore.entries()) {
      if (record.blockedUntil && record.blockedUntil < now) {
        rateLimitStore.delete(key)
      } else if (now - record.firstAttemptAt > 3600000) {
        rateLimitStore.delete(key)
      }
    }
  }, 300000)
  if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref()
  }
}

export interface RateLimitOptions {
  maxAttempts: number
  windowMs: number
  blockDurationMs: number
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 }
): { allowed: boolean; remainingAttempts: number; retryAfterSeconds?: number } {
  const now = Date.now()
  const record = rateLimitStore.get(key)

  if (!record) {
    return { allowed: true, remainingAttempts: options.maxAttempts }
  }

  // Nếu đang trong thời gian bị khóa
  if (record.blockedUntil && record.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000)
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds }
  }

  // Nếu đã qua cửa sổ thời gian, reset
  if (now - record.firstAttemptAt > options.windowMs) {
    rateLimitStore.delete(key)
    return { allowed: true, remainingAttempts: options.maxAttempts }
  }

  const remaining = Math.max(0, options.maxAttempts - record.attempts)
  return { allowed: remaining > 0, remainingAttempts: remaining }
}

export function recordFailedAttempt(
  key: string,
  options: RateLimitOptions = { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 }
): { blocked: boolean; retryAfterSeconds?: number } {
  const now = Date.now()
  let record = rateLimitStore.get(key)

  if (!record || now - record.firstAttemptAt > options.windowMs) {
    record = {
      attempts: 1,
      firstAttemptAt: now,
      blockedUntil: null,
    }
  } else {
    record.attempts += 1
  }

  if (record.attempts >= options.maxAttempts) {
    record.blockedUntil = now + options.blockDurationMs
    rateLimitStore.set(key, record)
    return { blocked: true, retryAfterSeconds: Math.ceil(options.blockDurationMs / 1000) }
  }

  rateLimitStore.set(key, record)
  return { blocked: false }
}

export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key)
}

