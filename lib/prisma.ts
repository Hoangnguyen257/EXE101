import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  if (envUrl && !envUrl.startsWith('file:')) {
    return envUrl
  }

  // Khi chạy trên Vercel Serverless với SQLite:
  // Thư mục gốc /var/task là read-only, chỉ có /tmp là writable
  if (process.env.VERCEL) {
    const tmpDbPath = '/tmp/dev.db'
    if (!fs.existsSync(/*turbopackIgnore: true*/ tmpDbPath) || fs.statSync(/*turbopackIgnore: true*/ tmpDbPath).size === 0) {
      const candidates = [
        path.resolve(process.cwd(), 'prisma', 'dev.db'),
        path.resolve(process.cwd(), 'dev.db'),
        path.join(__dirname, '..', 'prisma', 'dev.db'),
        path.join(__dirname, '..', 'dev.db'),
      ]
      for (const candidate of candidates) {
        if (fs.existsSync(/*turbopackIgnore: true*/ candidate) && fs.statSync(/*turbopackIgnore: true*/ candidate).size > 0) {
          try {
            fs.copyFileSync(candidate, tmpDbPath)
            console.log(`[Prisma Vercel] Đã sao chép CSDL từ ${candidate} sang ${tmpDbPath}`)
            break
          } catch (e) {
            console.error('[Prisma Vercel] Lỗi sao chép dev.db sang /tmp:', e)
          }
        }
      }
    }
    if (fs.existsSync(/*turbopackIgnore: true*/ tmpDbPath)) {
      return `file:${tmpDbPath}`
    }
  }

  // Mặc định cục bộ cho môi trường phát triển / kiểm thử / VPS
  const defaultSqlitePath = path.resolve(process.cwd(), 'prisma', 'dev.db')

  if (envUrl && envUrl.startsWith('file:')) {
    const rawPath = envUrl.replace(/^file:/, '').trim()
    if (path.isAbsolute(rawPath)) {
      return `file:${rawPath}`
    }
    // Đường dẫn tương đối: ưu tiên prisma/dev.db nếu tồn tại, sau đó root dev.db
    const inPrisma = path.resolve(process.cwd(), 'prisma', rawPath.replace(/^\.\//, ''))
    if (fs.existsSync(/*turbopackIgnore: true*/ inPrisma) && fs.statSync(/*turbopackIgnore: true*/ inPrisma).size > 0) {
      return `file:${inPrisma}`
    }
    const inRoot = path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath.replace(/^\.\//, ''))
    if (fs.existsSync(/*turbopackIgnore: true*/ inRoot) && fs.statSync(/*turbopackIgnore: true*/ inRoot).size > 0) {
      return `file:${inRoot}`
    }
    return `file:${inPrisma}`
  }

  return `file:${defaultSqlitePath}`
}

const activeDbUrl = resolveDatabaseUrl()
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = activeDbUrl
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: activeDbUrl,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma



