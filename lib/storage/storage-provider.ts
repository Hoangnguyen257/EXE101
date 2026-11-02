/**
 * TML LOGISTICS - UNIFIED STORAGE PROVIDER ARCHITECTURE
 * 
 * Cung cấp tầng trừu tượng lưu trữ tập tin hỗ trợ 2 driver:
 * 1. 'local': Lưu trữ trên ổ đĩa vật lý (phù hợp Local Dev & VPS triển khai truyền thống)
 * 2. 's3': Lưu trữ hướng đối tượng trên AWS S3, Cloudflare R2, hoặc MinIO (bắt buộc khi chạy Serverless/Vercel)
 * 
 * Đảm bảo:
 * - storageKey hoàn toàn do server sinh ngẫu nhiên an toàn, tuyệt đối không dùng tên file từ client
 * - Hỗ trợ cơ chế Presigned URL Upload trực tiếp từ client lên S3 để vượt qua giới hạn body 4.5MB của Serverless
 * - Đối soát tính toàn vẹn băm SHA-256 và chữ ký nhị phân Magic Bytes trước khi ghi nhận chứng từ
 * - Tự động dọn dẹp các bản ghi upload quá hạn (24 giờ) chưa được xác nhận
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { prisma } from '@/lib/prisma'
import { VAULT_DIR, calculateChecksum, validateComprehensiveUpload } from './document-storage'

export type StorageDriverType = 'local' | 's3'

export interface StoragePutResult {
  sizeBytes: number
  checksumSha256: string
  storageKey: string
}

export interface StorageGetResult {
  buffer: Buffer
  mimeType: string
  sizeBytes: number
}

export interface PresignedUploadResult {
  uploadUrl: string
  storageKey: string
  method: 'PUT' | 'POST'
  headers?: Record<string, string>
  expiresInSeconds: number
}

export interface StorageProvider {
  readonly driver: StorageDriverType
  put(storageKey: string, body: Buffer | Uint8Array, mimeType?: string): Promise<StoragePutResult>
  get(storageKey: string): Promise<StorageGetResult>
  delete(storageKey: string): Promise<boolean>
  exists(storageKey: string): Promise<boolean>
  createUploadUrl(
    storageKey: string,
    options: {
      mimeType: string
      maxSizeBytes: number
      expiresInSeconds?: number
    }
  ): Promise<PresignedUploadResult>
}

/**
 * Sinh khóa lưu trữ an toàn do server kiểm soát
 * Cấu trúc: vault/YYYYMMDD/uuid_v4.ext
 * Không sử dụng tên file do người dùng cung cấp nhằm triệt tiêu lỗ hổng Path Traversal & Null Byte
 */
export function generateStorageKey(options?: { extension?: string; prefix?: string }): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const randomId = crypto.randomUUID()
  let ext = (options?.extension || '').toLowerCase()
  if (ext && !ext.startsWith('.')) {
    ext = `.${ext}`
  }
  const prefix = options?.prefix || 'vault'
  return `${prefix}/${dateStr}/${randomId}${ext}`
}

/**
 * LOCAL STORAGE PROVIDER (Dành cho Dev và VPS có ổ cứng cục bộ)
 */
export class LocalStorageProvider implements StorageProvider {
  readonly driver: StorageDriverType = 'local'
  private baseDir: string

  constructor(customBaseDir?: string) {
    this.baseDir = customBaseDir || VAULT_DIR
    if (!fs.existsSync(this.baseDir)) {
      try {
        fs.mkdirSync(this.baseDir, { recursive: true })
      } catch {}
    }
  }

  private resolvePath(storageKey: string): string {
    // Chuẩn hóa loại bỏ các ký tự điều hướng thư mục ..
    const cleanKey = storageKey.replace(/\\/g, '/').replace(/\.\.+/g, '')
    return path.resolve(this.baseDir, cleanKey)
  }

  private findExistingPath(storageKey: string): string | null {
    const direct = this.resolvePath(storageKey)
    if (fs.existsSync(direct)) return direct

    // Hỗ trợ cấu trúc lưu trữ phẳng cũ trong VAULT_DIR
    const flat = path.resolve(this.baseDir, path.basename(storageKey))
    if (fs.existsSync(flat)) return flat

    return null
  }

  async put(storageKey: string, body: Buffer | Uint8Array, mimeType?: string): Promise<StoragePutResult> {
    const targetPath = this.resolvePath(storageKey)
    const dir = path.dirname(targetPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
    fs.writeFileSync(targetPath, buffer)
    const checksumSha256 = calculateChecksum(buffer)

    return {
      sizeBytes: buffer.length,
      checksumSha256,
      storageKey,
    }
  }

  async get(storageKey: string): Promise<StorageGetResult> {
    const filePath = this.findExistingPath(storageKey)
    if (!filePath) {
      throw new Error(`Tập tin lưu trữ không tồn tại: ${storageKey}`)
    }

    const buffer = fs.readFileSync(filePath)
    const ext = path.extname(filePath).toLowerCase()
    let mimeType = 'application/octet-stream'
    if (ext === '.pdf') mimeType = 'application/pdf'
    else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
    else if (ext === '.png') mimeType = 'image/png'

    return {
      buffer,
      mimeType,
      sizeBytes: buffer.length,
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    const filePath = this.findExistingPath(storageKey)
    if (filePath) {
      try {
        fs.unlinkSync(filePath)
        return true
      } catch {
        return false
      }
    }
    return false
  }

  async exists(storageKey: string): Promise<boolean> {
    return this.findExistingPath(storageKey) !== null
  }

  async createUploadUrl(
    storageKey: string,
    options: {
      mimeType: string
      maxSizeBytes: number
      expiresInSeconds?: number
    }
  ): Promise<PresignedUploadResult> {
    // Với môi trường Local, upload qua API endpoint /api/documents/upload
    return {
      uploadUrl: `/api/documents/upload`,
      storageKey,
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      expiresInSeconds: options.expiresInSeconds || 3600,
    }
  }
}

/**
 * S3 STORAGE PROVIDER (AWS S3 / Cloudflare R2 / MinIO)
 */
export class S3StorageProvider implements StorageProvider {
  readonly driver: StorageDriverType = 's3'
  private s3Client: S3Client
  private bucket: string

  constructor(config?: {
    bucket?: string
    region?: string
    endpoint?: string
    accessKeyId?: string
    secretAccessKey?: string
    forcePathStyle?: boolean
  }) {
    this.bucket = config?.bucket || process.env.S3_BUCKET || 'tml-storage-vault'
    const region = config?.region || process.env.S3_REGION || 'us-east-1'
    const endpoint = config?.endpoint || process.env.S3_ENDPOINT || undefined
    const accessKeyId = config?.accessKeyId || process.env.S3_ACCESS_KEY_ID || 'minioadmin'
    const secretAccessKey = config?.secretAccessKey || process.env.S3_SECRET_ACCESS_KEY || 'minioadmin'
    const forcePathStyle = config?.forcePathStyle ?? (process.env.S3_FORCE_PATH_STYLE === 'true' || Boolean(endpoint))

    this.s3Client = new S3Client({
      region,
      endpoint,
      forcePathStyle,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    })
  }

  async put(storageKey: string, body: Buffer | Uint8Array, mimeType?: string): Promise<StoragePutResult> {
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body)
    const checksumSha256 = calculateChecksum(buffer)

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: mimeType || 'application/octet-stream',
        ContentLength: buffer.length,
      })
    )

    return {
      sizeBytes: buffer.length,
      checksumSha256,
      storageKey,
    }
  }

  async get(storageKey: string): Promise<StorageGetResult> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      })
    )

    if (!response.Body) {
      throw new Error(`Tập tin S3 không có nội dung: ${storageKey}`)
    }

    const byteArray = await response.Body.transformToByteArray()
    const buffer = Buffer.from(byteArray)

    return {
      buffer,
      mimeType: response.ContentType || 'application/octet-stream',
      sizeBytes: buffer.length,
    }
  }

  async delete(storageKey: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        })
      )
      return true
    } catch {
      return false
    }
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
        })
      )
      return true
    } catch (err: any) {
      if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
        return false
      }
      return false
    }
  }

  async createUploadUrl(
    storageKey: string,
    options: {
      mimeType: string
      maxSizeBytes: number
      expiresInSeconds?: number
    }
  ): Promise<PresignedUploadResult> {
    const expiresIn = options.expiresInSeconds || 900 // Mặc định 15 phút

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      ContentType: options.mimeType,
    })

    const uploadUrl = await getSignedUrl(this.s3Client, command, { expiresIn })

    return {
      uploadUrl,
      storageKey,
      method: 'PUT',
      headers: {
        'Content-Type': options.mimeType,
      },
      expiresInSeconds: expiresIn,
    }
  }
}

// Singleton provider instance
let cachedStorageProvider: StorageProvider | null = null

export function getStorageProvider(): StorageProvider {
  if (cachedStorageProvider) return cachedStorageProvider

  const driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase() as StorageDriverType
  if (driver === 's3') {
    cachedStorageProvider = new S3StorageProvider()
  } else {
    cachedStorageProvider = new LocalStorageProvider()
  }

  return cachedStorageProvider
}

/**
 * Reset instance để phục vụ test kiểm thử mô phỏng khởi động lại server
 */
export function resetStorageProvider(): void {
  cachedStorageProvider = null
}

/**
 * Thiết lập instance tùy chỉnh phục vụ kiểm thử tích hợp
 */
export function setStorageProvider(provider: StorageProvider | null): void {
  cachedStorageProvider = provider
}

/**
 * Dọn dẹp các yêu cầu upload quá hạn (24 giờ) chưa được người dùng xác nhận
 */
export async function cleanupPendingUploads(): Promise<{ cleanedCount: number }> {
  const expiredDate = new Date()
  const provider = getStorageProvider()

  const expiredPending = await prisma.pendingUpload.findMany({
    where: {
      confirmedAt: null,
      expiresAt: { lt: expiredDate },
    },
    take: 100,
  })

  let cleanedCount = 0

  for (const item of expiredPending) {
    try {
      // Xóa file rác trên storage nếu đã tồn tại
      await provider.delete(item.storageKey)
    } catch {}

    try {
      await prisma.pendingUpload.delete({
        where: { id: item.id },
      })
      cleanedCount++
    } catch {}
  }

  return { cleanedCount }
}
