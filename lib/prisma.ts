import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import os from 'os'

function resolveDatabaseUrl(): string {
  // 1. Nếu biến môi trường DATABASE_URL đã được chỉ định đến PostgreSQL hoặc dịch vụ DB bên ngoài
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return process.env.DATABASE_URL
  }

  // 2. Kiểm tra môi trường Serverless (Vercel, AWS Lambda, v.v.)
  const isServerless = Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.VERCEL_ENV
  )

  if (isServerless) {
    const tmpDir = os.tmpdir()
    const tmpDbPath = path.join(tmpDir, 'dev.db')

    // Nếu database tại /tmp chưa tồn tại, sao chép từ thư mục đóng gói dự án
    if (!fs.existsSync(tmpDbPath)) {
      const sourceDbPath = path.join(process.cwd(), 'prisma', 'dev.db')

      if (fs.existsSync(sourceDbPath)) {
        try {
          fs.copyFileSync(sourceDbPath, tmpDbPath)
          if (fs.existsSync(`${sourceDbPath}-wal`)) fs.copyFileSync(`${sourceDbPath}-wal`, `${tmpDbPath}-wal`)
          if (fs.existsSync(`${sourceDbPath}-shm`)) fs.copyFileSync(`${sourceDbPath}-shm`, `${tmpDbPath}-shm`)
          console.log(`[Prisma Serverless] Replicated SQLite database to writable ${tmpDbPath}`)
        } catch (err) {
          console.error(`[Prisma Serverless] Error copying from ${sourceDbPath}:`, err)
        }
      } else {
        console.warn(`[Prisma Serverless] Warning: Could not locate source dev.db at ${sourceDbPath}`)
      }
    }

    return `file:${tmpDbPath}`
  }

  // 3. Môi trường phát triển cục bộ (Local Development / Testing)
  const defaultSqlitePath = path.resolve(process.cwd(), 'prisma', 'dev.db')
  return process.env.DATABASE_URL || `file:${defaultSqlitePath}`
}

const activeDbUrl = resolveDatabaseUrl()
process.env.DATABASE_URL = activeDbUrl

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


