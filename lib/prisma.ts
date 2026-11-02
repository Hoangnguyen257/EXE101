import { PrismaClient } from '@prisma/client'
import fs from 'fs'
import path from 'path'

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL
  if (envUrl && !envUrl.startsWith('file:')) {
    return envUrl
  }

  // Mặc định cục bộ cho môi trường phát triển / kiểm thử
  const defaultSqlitePath = path.resolve(process.cwd(), 'prisma', 'dev.db')

  if (envUrl && envUrl.startsWith('file:')) {
    const rawPath = envUrl.replace(/^file:/, '').trim()
    if (path.isAbsolute(rawPath)) {
      return `file:${rawPath}`
    }
    // Đường dẫn tương đối: ưu tiên prisma/dev.db nếu tồn tại, sau đó root dev.db
    const inPrisma = path.resolve(process.cwd(), 'prisma', rawPath.replace(/^\.\//, ''))
    if (fs.existsSync(inPrisma)) {
      return `file:${inPrisma}`
    }
    const inRoot = path.resolve(process.cwd(), rawPath.replace(/^\.\//, ''))
    if (fs.existsSync(inRoot)) {
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



