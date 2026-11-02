import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

/**
 * Đồng bộ hóa provider trong file prisma/schema.prisma duy nhất.
 * Loại bỏ hoàn toàn việc duy trì 2 file schema phân tán.
 * Tự động nhận diện qua DATABASE_URL hoặc biến môi trường DB_PROVIDER / tham số CLI.
 * Tự động khởi tạo và seed CSDL nếu tệp dev.db chưa tồn tại (áp dụng cho môi trường deploy Vercel / CI / Git clone sạch).
 */
export function ensurePrismaProvider(forcedProvider?: 'sqlite' | 'postgresql'): 'sqlite' | 'postgresql' {
  const schemaPath = path.resolve(process.cwd(), 'prisma', 'schema.prisma')
  if (!fs.existsSync(schemaPath)) {
    console.error(`[Prisma Sync] Không tìm thấy file schema tại: ${schemaPath}`)
    return 'sqlite'
  }

  const content = fs.readFileSync(schemaPath, 'utf-8')

  let provider: 'sqlite' | 'postgresql' = forcedProvider || 'sqlite'
  if (!forcedProvider) {
    const dbUrl = process.env.DATABASE_URL || ''
    const envProvider = process.env.DB_PROVIDER || process.env.PRISMA_PROVIDER
    if (
      envProvider === 'postgresql' ||
      envProvider === 'postgres' ||
      dbUrl.startsWith('postgres://') ||
      dbUrl.startsWith('postgresql://')
    ) {
      provider = 'postgresql'
    } else {
      provider = 'sqlite'
    }
  }

  const updated = content.replace(
    /datasource\s+db\s*\{[\s\S]*?provider\s*=\s*["'](sqlite|postgresql)["']/,
    (match) => match.replace(/(sqlite|postgresql)/, provider)
  )

  if (updated !== content) {
    fs.writeFileSync(schemaPath, updated, 'utf-8')
    console.log(`[Prisma Schema] Đã đồng bộ datasource provider thành công -> "${provider}"`)
  }

  // Tự động kiểm tra và khởi tạo CSDL SQLite khi build deploy (Vercel / VPS / Clean Clone)
  if (provider === 'sqlite') {
    const devDbPath = path.resolve(process.cwd(), 'prisma', 'dev.db')
    const rootDbPath = path.resolve(process.cwd(), 'dev.db')
    const hasDb = (fs.existsSync(devDbPath) && fs.statSync(devDbPath).size > 0) ||
                  (fs.existsSync(rootDbPath) && fs.statSync(rootDbPath).size > 0)

    const buildEnv: NodeJS.ProcessEnv = {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
      JWT_SECRET: process.env.JWT_SECRET || 'tml-enterprise-build-secret-key-min-32-chars-2026',
    }

    if (!hasDb || process.env.VERCEL) {
      console.log('[Prisma Deploy Init] Đang tự động tạo cấu trúc bảng SQLite...')
      try {
        execSync('npx prisma db push --skip-generate --accept-data-loss', { env: buildEnv, stdio: 'inherit' })
        console.log('[Prisma Deploy Init] Đang nạp dữ liệu mẫu ban đầu (seed test)...')
        execSync('npx tsx prisma/seed.ts --test', { env: buildEnv, stdio: 'inherit' })
        if (fs.existsSync(devDbPath)) {
          fs.copyFileSync(devDbPath, rootDbPath)
        }
        console.log('[Prisma Deploy Init] Đã khởi tạo và nạp dữ liệu dev.db thành công!')
      } catch (err: any) {
        console.error('[Prisma Deploy Init] Cảnh báo lỗi khởi tạo CSDL tự động:', err.message)
      }
    } else {
      // Đảm bảo cả prisma/dev.db và ./dev.db luôn đồng bộ
      if (fs.existsSync(devDbPath) && !fs.existsSync(rootDbPath)) {
        try { fs.copyFileSync(devDbPath, rootDbPath) } catch {}
      } else if (fs.existsSync(rootDbPath) && !fs.existsSync(devDbPath)) {
        try { fs.copyFileSync(rootDbPath, devDbPath) } catch {}
      }
    }
  } else if (provider === 'postgresql') {
    // Với PostgreSQL, nếu có DATABASE_URL kết nối được thì chạy deploy migration
    const dbUrl = process.env.DATABASE_URL || ''
    if (dbUrl && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://'))) {
      try {
        console.log('[Prisma Deploy] Thực thi migration PostgreSQL...')
        execSync('npx prisma migrate deploy', { stdio: 'inherit' })
      } catch (err: any) {
        console.warn('[Prisma Deploy] Không thể tự động migrate PostgreSQL (có thể do chưa kết nối được DB):', err.message)
      }
    }
  }

  return provider
}

// Chạy qua CLI
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith('ensure-db-provider.ts') || 
  process.argv[1].endsWith('ensure-db-provider.js')
)

if (isDirectRun) {
  const target = process.argv[2] as 'sqlite' | 'postgresql' | undefined
  ensurePrismaProvider(target)
}

