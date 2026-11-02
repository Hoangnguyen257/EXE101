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
    const candidates = [
      path.resolve(process.cwd(), 'prisma', 'dev.db'),
      path.resolve(process.cwd(), 'dev.db'),
      path.join(__dirname, '..', 'prisma', 'dev.db'),
      path.join(__dirname, '..', 'dev.db'),
      path.join(process.cwd(), '.next', 'server', 'prisma', 'dev.db'),
    ]
    if (!fs.existsSync(/*turbopackIgnore: true*/ tmpDbPath) || fs.statSync(/*turbopackIgnore: true*/ tmpDbPath).size === 0) {
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
    // Nếu vẫn chưa có, tạo tệp trống tại /tmp/dev.db để SQLite có thể mở an toàn trên writable filesystem
    if (!fs.existsSync(/*turbopackIgnore: true*/ tmpDbPath)) {
      try {
        fs.writeFileSync(tmpDbPath, Buffer.alloc(0))
      } catch {}
    }
    // Trên Vercel với SQLite, LUÔN LUÔN trả về file:/tmp/dev.db
    // Tuyệt đối KHÔNG BAO GIỜ trả về file trong /var/task vì filesystem là read-only (gây ra Error code 14)
    return `file:${tmpDbPath}`
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

let isDatabaseChecked = false

/**
 * Tự động kiểm tra và phục hồi CSDL (Self-Healing)
 * Nếu chạy trên môi trường Serverless (Vercel) mà CSDL chưa có bảng,
 * hàm này sẽ tự động chạy migration DDL và nạp người dùng admin mẫu.
 */
export async function ensureDatabaseInitialized(): Promise<void> {
  if (isDatabaseChecked) return

  // Chỉ áp dụng tự phục hồi cho SQLite
  const dbUrl = process.env.DATABASE_URL || activeDbUrl
  if (dbUrl && !dbUrl.startsWith('file:')) {
    isDatabaseChecked = true
    return
  }

  try {
    const userTable = await prisma.$queryRawUnsafe<any[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='User';"
    )
    if (!Array.isArray(userTable) || userTable.length === 0) {
      console.log('[Prisma Auto-Init] Bảng User chưa tồn tại trong SQLite. Đang tự động nạp DDL schema...')
      const migrationDir = path.resolve(process.cwd(), 'prisma', 'migrations')
      if (fs.existsSync(/*turbopackIgnore: true*/ migrationDir)) {
        const folders = fs.readdirSync(/*turbopackIgnore: true*/ migrationDir).sort()
        for (const folder of folders) {
          const sqlPath = path.join(migrationDir, folder, 'migration.sql')
          if (fs.existsSync(/*turbopackIgnore: true*/ sqlPath)) {
            const sql = fs.readFileSync(/*turbopackIgnore: true*/ sqlPath, 'utf-8')
            const stmts = sql.split(';').map((s) => s.trim()).filter(Boolean)
            for (const stmt of stmts) {
              await prisma.$executeRawUnsafe(stmt).catch(() => {})
            }
          }
        }
      }

      // Tạo tài khoản admin mặc định nếu chưa tồn tại
      const bcrypt = (await import('bcryptjs')).default
      const defaultHash = await bcrypt.hash('Tml@2026!', 10)

      // Tạo tổ chức, vai trò ADMIN và người dùng admin
      const org = await prisma.organization.upsert({
        where: { taxCode: '0312456789' },
        update: {},
        create: {
          name: 'Công ty TNHH Logistics Tân Minh (TML)',
          taxCode: '0312456789',
          address: '12 Nguyễn Tất Thành, Phường 12, Quận 4, TP. Hồ Chí Minh',
          plan: 'Enterprise Business',
        },
      }).catch(() => null)

      const orgId = org?.id || 'org_tml_default'

      await prisma.role.upsert({
        where: { code: 'ADMIN' },
        update: {},
        create: { code: 'ADMIN', name: 'Quản trị viên hệ thống', description: 'Toàn quyền quản trị' },
      }).catch(() => {})

      await prisma.user.create({
        data: {
          orgId,
          email: 'admin@tml.vn',
          name: 'Nguyễn Hoàng',
          initials: 'NH',
          passwordHash: defaultHash,
          roleCode: 'ADMIN',
          isActive: true,
          mustChangePassword: false,
        },
      }).catch(() => {})
      console.log('[Prisma Auto-Init] Đã nạp thành công tài khoản admin@tml.vn vào CSDL SQLite!')
    }
    isDatabaseChecked = true
  } catch (err: any) {
    console.error('[Prisma Auto-Init] Lỗi kiểm tra / nạp CSDL tự động:', err.message)
  }
}




