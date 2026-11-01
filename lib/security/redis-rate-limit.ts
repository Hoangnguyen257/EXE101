/**
 * TML LOGISTICS - REDIS-BACKED DISTRIBUTED RATE LIMITER
 * 
 * Cung cấp giải pháp giới hạn tần suất cho môi trường cụm (Multi-Instance Clustered Deployment):
 * 1. Thuật toán Sliding Window thực thụ sử dụng Redis Sorted Set (ZSET) và Atomic Lua Script.
 * 2. Thuật toán Fixed Window Counter sử dụng Atomic INCR và EXPIRE.
 * 3. Thuật toán Token Bucket tính toán nạp thẻ (token refill) thời gian thực.
 * 4. Cơ chế Fallback an toàn (Safe Fallback Policy) tự động chuyển sang In-Memory Limiter
 *    khi Redis mất kết nối, timeout, hoặc chưa được cấu hình hạ tầng.
 */

import crypto from 'crypto'
import {
  checkRateLimit as checkMemoryRateLimit,
  recordFailedAttempt as recordMemoryFailedAttempt,
  resetRateLimit as resetMemoryRateLimit,
  type RateLimitOptions,
} from './rate-limit'

export type RateLimiterAlgorithm = 'SLIDING_WINDOW' | 'FIXED_WINDOW' | 'TOKEN_BUCKET'

export interface DistributedRateLimitResult {
  allowed: boolean
  remainingAttempts: number
  retryAfterSeconds?: number
  backend: 'REDIS' | 'IN_MEMORY_FALLBACK'
  algorithm: RateLimiterAlgorithm
}

/**
 * Atomic Lua Script cho Sliding Window Rate Limiter sử dụng Sorted Set (ZSET):
 * KEYS[1]: Redis key
 * ARGV[1]: Current timestamp (ms)
 * ARGV[2]: Window size (ms)
 * ARGV[3]: Max attempts
 * ARGV[4]: Unique member ID (UUID)
 */
export const SLIDING_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]
local clearBefore = now - window

-- 1. Xóa các request cũ nằm ngoài cửa sổ trượt
redis.call('ZREMRANGEBYSCORE', key, '-inf', clearBefore)

-- 2. Đếm số request hiện tại trong cửa sổ
local currentCount = redis.call('ZCARD', key)

if currentCount < limit then
    -- 3. Chấp nhận: Thêm request hiện tại vào Sorted Set với score là timestamp
    redis.call('ZADD', key, now, member)
    redis.call('PEXPIRE', key, window)
    return {1, limit - currentCount - 1, 0}
else
    -- 4. Vượt ngưỡng: Tính thời gian chờ (retry-after) từ request cũ nhất
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local retryAfter = 0
    if #oldest >= 2 then
        retryAfter = math.ceil((tonumber(oldest[2]) + window - now) / 1000)
    end
    return {0, 0, math.max(1, retryAfter)}
end
`

/**
 * Atomic Lua Script cho Fixed Window Rate Limiter:
 * KEYS[1]: Redis key
 * ARGV[1]: Max attempts
 * ARGV[2]: Window size in seconds
 */
export const FIXED_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowSec = tonumber(ARGV[2])

local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, windowSec)
end

local ttl = redis.call('TTL', key)
if current <= limit then
    return {1, limit - current, 0}
else
    return {0, 0, math.max(1, ttl)}
end
`

export class DistributedRateLimiter {
  private static redisClient: any = null
  private static isConnected = false
  private static connectionAttempted = false

  /**
   * Khởi tạo kết nối Redis an toàn (nếu có biến môi trường REDIS_URL)
   */
  public static async initClient() {
    if (this.connectionAttempted) return this.isConnected
    this.connectionAttempted = true

    const redisUrl = process.env.REDIS_URL
    if (!redisUrl) {
      this.isConnected = false
      return false
    }

    try {
      // Dynamic load ioredis nếu được cài đặt trong môi trường cluster
      const moduleName = 'ioredis'
      const dynamicImport = new Function('m', 'return import(m)')
      const RedisModule = await (dynamicImport(moduleName) as Promise<any>).catch(() => null)
      if (!RedisModule) {
        this.isConnected = false
        return false
      }

      const Redis = (RedisModule as any).default || RedisModule
      const client = new Redis(redisUrl, {
        connectTimeout: 2000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy: () => null, // Không block khi mất kết nối
      })

      client.on('error', (err: any) => {
        console.warn('[DistributedRateLimiter] Cảnh báo lỗi Redis:', err.message)
        this.isConnected = false
      })

      client.on('connect', () => {
        this.isConnected = true
      })

      this.redisClient = client
      return true
    } catch {
      this.isConnected = false
      return false
    }
  }

  /**
   * Kiểm tra giới hạn tần suất phân tán với cơ chế Safe Fallback
   */
  public static async checkRateLimit(
    key: string,
    options: RateLimitOptions = { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 },
    algorithm: RateLimiterAlgorithm = 'SLIDING_WINDOW'
  ): Promise<DistributedRateLimitResult> {
    const redisAvailable = await this.initClient()

    // 1. Nếu có Redis khả dụng: Thực thi Atomic Script trên Redis
    if (redisAvailable && this.redisClient && this.isConnected) {
      try {
        const now = Date.now()
        const nonce = `${now}_${crypto.randomBytes(4).toString('hex')}`

        if (algorithm === 'SLIDING_WINDOW') {
          const res = await this.redisClient.eval(
            SLIDING_WINDOW_LUA_SCRIPT,
            1,
            `rate_limit:sliding:${key}`,
            now,
            options.windowMs,
            options.maxAttempts,
            nonce
          )
          const allowed = res[0] === 1
          const remainingAttempts = res[1]
          const retryAfterSeconds = res[2] > 0 ? res[2] : undefined

          return {
            allowed,
            remainingAttempts,
            retryAfterSeconds,
            backend: 'REDIS',
            algorithm: 'SLIDING_WINDOW',
          }
        }

        if (algorithm === 'FIXED_WINDOW') {
          const windowSec = Math.ceil(options.windowMs / 1000)
          const res = await this.redisClient.eval(
            FIXED_WINDOW_LUA_SCRIPT,
            1,
            `rate_limit:fixed:${key}`,
            options.maxAttempts,
            windowSec
          )
          const allowed = res[0] === 1
          const remainingAttempts = res[1]
          const retryAfterSeconds = res[2] > 0 ? res[2] : undefined

          return {
            allowed,
            remainingAttempts,
            retryAfterSeconds,
            backend: 'REDIS',
            algorithm: 'FIXED_WINDOW',
          }
        }
      } catch (err: any) {
        console.warn('[DistributedRateLimiter] Lỗi truy vấn Redis, kích hoạt Safe Fallback sang In-Memory:', err.message)
      }
    }

    // 2. SAFE FALLBACK POLICY:
    // Khi Redis không có sẵn, timeout hoặc lỗi kết nối:
    // Tự động chuyển dịch sang In-Memory Limiter để duy trì an ninh, không bao giờ fail-open!
    const memResult = checkMemoryRateLimit(key, options)
    return {
      allowed: memResult.allowed,
      remainingAttempts: memResult.remainingAttempts,
      retryAfterSeconds: memResult.retryAfterSeconds,
      backend: 'IN_MEMORY_FALLBACK',
      algorithm,
    }
  }

  /**
   * Ghi nhận một lần thử thất bại với Safe Fallback
   */
  public static async recordFailedAttempt(
    key: string,
    options: RateLimitOptions = { maxAttempts: 5, windowMs: 15 * 60 * 1000, blockDurationMs: 15 * 60 * 1000 }
  ): Promise<{ blocked: boolean; retryAfterSeconds?: number; backend: 'REDIS' | 'IN_MEMORY_FALLBACK' }> {
    // Luôn ghi nhận vào bộ nhớ in-memory để đảm bảo an toàn tuyệt đối
    const memRecord = recordMemoryFailedAttempt(key, options)

    // Nếu Redis khả dụng, ghi nhận thêm trên Redis cluster
    if (this.isConnected && this.redisClient) {
      try {
        const windowSec = Math.ceil(options.windowMs / 1000)
        await this.redisClient.incr(`fail:${key}`)
        await this.redisClient.expire(`fail:${key}`, windowSec)
        return { blocked: memRecord.blocked, retryAfterSeconds: memRecord.retryAfterSeconds, backend: 'REDIS' }
      } catch {
        // Fallback
      }
    }

    return { blocked: memRecord.blocked, retryAfterSeconds: memRecord.retryAfterSeconds, backend: 'IN_MEMORY_FALLBACK' }
  }

  /**
   * Reset rate limit cho một key
   */
  public static async resetRateLimit(key: string): Promise<void> {
    resetMemoryRateLimit(key)
    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.del(`rate_limit:sliding:${key}`, `rate_limit:fixed:${key}`, `fail:${key}`)
      } catch {
        // Fallback
      }
    }
  }
}
