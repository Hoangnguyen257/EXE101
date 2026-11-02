import { PrismaClient } from '@prisma/client'
import path from 'path'

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }
  // Mặc định cục bộ cho môi trường phát triển / kiểm thử
  const defaultSqlitePath = path.resolve(process.cwd(), 'prisma', 'dev.db')
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



