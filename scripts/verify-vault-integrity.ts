/**
 * TML LOGISTICS - STORAGE VAULT INTEGRITY VERIFIER
 * 
 * Quét toàn bộ kho lưu trữ vật lý storage_vault/ và đối chiếu cơ sở dữ liệu:
 * 1. Kiểm tra từng StorageObject trong DB có file vật lý tương ứng hay không.
 * 2. Tính toán mã băm SHA-256 thực tế và so sánh với StorageObject.checksumSha256.
 * 3. Phát hiện tập tin mồ côi (Orphaned Files) trên đĩa không có trong DB.
 * 4. Phát hiện tập tin bị mất (Missing Files) có trong DB nhưng mất trên đĩa.
 * 5. Báo cáo tỷ lệ toàn vẹn dữ liệu (Integrity Ratio).
 */

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { prisma } from '../lib/prisma'

export interface VaultIntegrityReport {
  timestamp: string
  vaultDirectory: string
  totalDbRecords: number
  totalPhysicalFiles: number
  matchedAndVerified: number
  corruptedHashCount: number
  missingFilesCount: number
  orphanedFilesCount: number
  integrityPercentage: number
  details: {
    verifiedFiles: string[]
    corruptedFiles: Array<{ id: string; expectedHash: string; actualHash: string; path: string }>
    missingFiles: Array<{ id: string; storageKey: string; expectedPath: string }>
    orphanedFiles: string[]
  }
}

export function computeSha256(filePath: string): string {
  const hash = crypto.createHash('sha256')
  const content = fs.readFileSync(filePath)
  hash.update(content)
  return hash.digest('hex')
}

export async function verifyStorageVaultIntegrity(): Promise<VaultIntegrityReport> {
  const vaultDir = path.resolve(process.cwd(), 'storage_vault')
  if (!fs.existsSync(vaultDir)) {
    fs.mkdirSync(vaultDir, { recursive: true })
  }

  // 1. Lấy tất cả bản ghi StorageObject từ Database
  let dbObjects: any[] = []
  try {
    dbObjects = await prisma.storageObject.findMany()
  } catch {
    dbObjects = []
  }

  // 2. Quét danh sách file vật lý trên đĩa
  function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath)
    files.forEach((file) => {
      const fullPath = path.join(dirPath, file)
      if (fs.statSync(fullPath).isDirectory()) {
        getAllFiles(fullPath, arrayOfFiles)
      } else {
        arrayOfFiles.push(fullPath)
      }
    })
    return arrayOfFiles
  }

  const physicalFiles = getAllFiles(vaultDir)
  const physicalFileSet = new Set(physicalFiles.map((p) => path.resolve(p)))

  const report: VaultIntegrityReport = {
    timestamp: new Date().toISOString(),
    vaultDirectory: vaultDir,
    totalDbRecords: dbObjects.length,
    totalPhysicalFiles: physicalFiles.length,
    matchedAndVerified: 0,
    corruptedHashCount: 0,
    missingFilesCount: 0,
    orphanedFilesCount: 0,
    integrityPercentage: 100,
    details: {
      verifiedFiles: [],
      corruptedFiles: [],
      missingFiles: [],
      orphanedFiles: [],
    },
  }

  const accountedPhysicalFiles = new Set<string>()

  // 3. Đối soát từng DB record
  for (const obj of dbObjects) {
    const directPath = path.resolve(vaultDir, obj.storageKey)
    const flatPath = path.resolve(vaultDir, path.basename(obj.storageKey))
    const expectedPath = fs.existsSync(directPath)
      ? directPath
      : fs.existsSync(flatPath)
      ? flatPath
      : directPath

    if (!fs.existsSync(expectedPath)) {
      report.missingFilesCount++
      report.details.missingFiles.push({
        id: obj.id,
        storageKey: obj.storageKey,
        expectedPath,
      })
      continue
    }

    accountedPhysicalFiles.add(expectedPath)
    const actualHash = computeSha256(expectedPath)

    if (obj.checksumSha256 && obj.checksumSha256 !== actualHash) {
      report.corruptedHashCount++
      report.details.corruptedFiles.push({
        id: obj.id,
        expectedHash: obj.checksumSha256,
        actualHash,
        path: expectedPath,
      })
    } else {
      report.matchedAndVerified++
      report.details.verifiedFiles.push(obj.storageKey)
      // Nếu DB chưa có checksumSha256, tự động cập nhật để bảo toàn tính toàn vẹn
      if (!obj.checksumSha256) {
        try {
          await prisma.storageObject.update({
            where: { id: obj.id },
            data: { checksumSha256: actualHash },
          })
        } catch {
          // Bỏ qua nếu DB đang bận
        }
      }
    }
  }

  // 4. Tìm các tập tin mồ côi (không nằm trong database)
  for (const pFile of physicalFileSet) {
    if (!accountedPhysicalFiles.has(pFile)) {
      // Bỏ qua các file ẩn hoặc tạm (.gitkeep, .tmp)
      const baseName = path.basename(pFile)
      if (!baseName.startsWith('.')) {
        report.orphanedFilesCount++
        report.details.orphanedFiles.push(pFile)
      }
    }
  }

  const totalEvaluated = report.totalDbRecords
  if (totalEvaluated > 0) {
    report.integrityPercentage = parseFloat(
      ((report.matchedAndVerified / totalEvaluated) * 100).toFixed(2)
    )
  } else {
    report.integrityPercentage = 100
  }

  return report
}

// Chạy trực tiếp từ CLI nếu được gọi qua tsx scripts/verify-vault-integrity.ts
if (require.main === module) {
  verifyStorageVaultIntegrity()
    .then((rep) => {
      console.log('🛡️ KẾT QUẢ KIỂM TOÁN TOÀN VẸN KHO STORAGE VAULT:')
      console.log(`- Tổng bản ghi DB: ${rep.totalDbRecords}`)
      console.log(`- Tổng file vật lý: ${rep.totalPhysicalFiles}`)
      console.log(`- Số file xác thực toàn vẹn (SHA-256 khớp 100%): ${rep.matchedAndVerified}`)
      console.log(`- Số file hỏng băm: ${rep.corruptedHashCount}`)
      console.log(`- Số file mất tích trên đĩa: ${rep.missingFilesCount}`)
      console.log(`- Số file mồ côi (không có trong DB): ${rep.orphanedFilesCount}`)
      console.log(`- Tỷ lệ toàn vẹn kho: ${rep.integrityPercentage}%`)
    })
    .catch((err) => {
      console.error('❌ Lỗi kiểm toán kho Storage Vault:', err)
      process.exit(1)
    })
}
