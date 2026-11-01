import { PrismaClient } from '@prisma/client'
import path from 'path'

// Tự động gán fallback DATABASE_URL nếu biến môi trường chưa được cấu hình trên Vercel
// Tránh lỗi PrismaClientInitializationError trong quá trình build static / collect page data
if (!process.env.DATABASE_URL) {
  const defaultSqlitePath = path.resolve(process.cwd(), 'prisma', 'dev.db')
  process.env.DATABASE_URL = `file:${defaultSqlitePath}`
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
        url: process.env.DATABASE_URL,
      },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

