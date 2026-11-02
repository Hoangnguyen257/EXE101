import fs from 'fs'
import path from 'path'

/**
 * Đồng bộ hóa provider trong file prisma/schema.prisma duy nhất.
 * Loại bỏ hoàn toàn việc duy trì 2 file schema phân tán.
 * Tự động nhận diện qua DATABASE_URL hoặc biến môi trường DB_PROVIDER / tham số CLI.
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

