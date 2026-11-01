import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'

const VAULT_DIR = path.resolve(process.cwd(), 'storage_vault')

export async function GET() {
  const startTime = Date.now()
  const health: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    timestamp: string
    uptimeSeconds: number
    environment: string
    database: { connected: boolean; latencyMs?: number; error?: string }
    storage: { writable: boolean; vaultDir: string; error?: string }
    memory: { rssMb: number; heapUsedMb: number }
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    database: { connected: false },
    storage: { writable: false, vaultDir: VAULT_DIR },
    memory: {
      rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
    },
  }

  // 1. Kiểm tra kết nối cơ sở dữ liệu
  try {
    const dbStart = Date.now()
    await prisma.$queryRaw`SELECT 1`
    health.database.connected = true
    health.database.latencyMs = Date.now() - dbStart
  } catch (err: any) {
    health.status = 'unhealthy'
    health.database.connected = false
    health.database.error = err?.message || 'Database connection failure'
  }

  // 2. Kiểm tra quyền ghi/đọc kho lưu trữ Storage Vault
  try {
    if (!fs.existsSync(VAULT_DIR)) {
      fs.mkdirSync(VAULT_DIR, { recursive: true })
    }
    const testFile = path.join(VAULT_DIR, `.health_${Date.now()}.tmp`)
    fs.writeFileSync(testFile, 'health-check-ok')
    fs.unlinkSync(testFile)
    health.storage.writable = true
  } catch (err: any) {
    health.status = health.status === 'unhealthy' ? 'unhealthy' : 'degraded'
    health.storage.writable = false
    health.storage.error = err?.message || 'Storage write failure'
  }

  const httpStatus = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

  return NextResponse.json(
    {
      ...health,
      responseTimeMs: Date.now() - startTime,
    },
    { status: httpStatus }
  )
}

