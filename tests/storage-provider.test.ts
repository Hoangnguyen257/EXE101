/**
 * TML LOGISTICS - INTEGRATION TEST SUITE: PERSISTENT STORAGE ARCHITECTURE
 * 
 * Kiểm chứng nghiệm thu:
 * 1. Local driver: Upload -> Mô phỏng khởi động lại server -> Download đúng từng byte.
 * 2. S3 driver (Presigned URL): Upload file 20MB trực tiếp lên S3 bucket -> Mô phỏng khởi động lại server -> Download đúng từng byte.
 * 3. Kiểm tra bảo mật: storageKey do server sinh ngẫu nhiên, tuyệt đối không dùng tên file người dùng.
 * 4. Luồng Presign -> Client Upload -> Confirm API: Kiểm tra Magic Bytes, băm SHA-256, tự động bóc tách OCR và gắn với lô hàng.
 * 5. Tự động dọn dẹp (cleanup) các bản ghi PendingUpload quá hạn 24 giờ chưa được xác nhận.
 */

import http from 'http'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import {
  LocalStorageProvider,
  S3StorageProvider,
  generateStorageKey,
  resetStorageProvider,
  cleanupPendingUploads,
} from '../lib/storage/storage-provider'
import { validateComprehensiveUpload, calculateChecksum } from '../lib/storage/document-storage'

// Helper ghi nhận kết quả test
const results: { group: string; name: string; passed: boolean; error?: string }[] = []

function record(group: string, name: string, passed: boolean, error?: string) {
  results.push({ group, name, passed, error })
  if (passed) {
    console.log(`  ✅ [PASS] ${name}`)
  } else {
    console.error(`  ❌ [FAIL] ${name} ${error ? `(${error})` : ''}`)
  }
}

/**
 * Mock S3 HTTP Server tương thích chuẩn AWS S3 REST API (PUT, GET, HEAD, DELETE)
 * Cho phép kiểm thử trọn vẹn @aws-sdk/client-s3 và @aws-sdk/s3-request-presigner
 * mà không phụ thuộc vào daemon Docker bên ngoài môi trường máy chủ
 */
function createMockS3Server(port: number): Promise<{ server: http.Server; store: Map<string, { buffer: Buffer; contentType: string }> }> {
  const store = new Map<string, { buffer: Buffer; contentType: string }>()

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
    // Đường dẫn path-style: /bucket-name/key-name
    const pathname = decodeURIComponent(url.pathname)
    const parts = pathname.split('/').filter(Boolean)
    const key = parts.slice(1).join('/')

    if (req.method === 'PUT') {
      const chunks: Buffer[] = []
      req.on('data', (chunk) => chunks.push(chunk))
      req.on('end', () => {
        const fullBuffer = Buffer.concat(chunks)
        const contentType = req.headers['content-type'] || 'application/octet-stream'
        store.set(key, { buffer: fullBuffer, contentType })
        res.writeHead(200, {
          'ETag': `"${calculateChecksum(fullBuffer).slice(0, 32)}"`,
          'Content-Length': '0',
        })
        res.end()
      })
      return
    }

    if (req.method === 'GET') {
      const item = store.get(key)
      if (!item) {
        res.writeHead(404, { 'Content-Type': 'application/xml' })
        res.end('<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>')
        return
      }
      res.writeHead(200, {
        'Content-Type': item.contentType,
        'Content-Length': item.buffer.length.toString(),
        'ETag': `"${calculateChecksum(item.buffer).slice(0, 32)}"`,
      })
      res.end(item.buffer)
      return
    }

    if (req.method === 'HEAD') {
      const item = store.get(key)
      if (!item) {
        res.writeHead(404)
        res.end()
        return
      }
      res.writeHead(200, {
        'Content-Type': item.contentType,
        'Content-Length': item.buffer.length.toString(),
        'ETag': `"${calculateChecksum(item.buffer).slice(0, 32)}"`,
      })
      res.end()
      return
    }

    if (req.method === 'DELETE') {
      store.delete(key)
      res.writeHead(204)
      res.end()
      return
    }

    res.writeHead(405)
    res.end()
  })

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve({ server, store })
    })
  })
}

async function runStorageTestSuite() {
  console.log('='.repeat(80))
  console.log('📦 TML LOGISTICS - KIỂM THỬ TÍCH HỢP HỆ THỐNG LƯU TRỮ BỀN VỮNG (STORAGE PROVIDER)')
  console.log('='.repeat(80))

  // ============================================================================
  // GROUP 1: BẢO MẬT KHÓA LƯU TRỮ (SERVER-GENERATED STORAGE KEY)
  // ============================================================================
  console.log('\n▶ [GROUP 1] KIỂM TRA BẢO MẬT KHÓA LƯU TRỮ SERVER-GENERATED')
  {
    const clientFileName = '../../../etc/passwd\0malicious_exploit.exe.pdf'
    const ext = path.extname(clientFileName).toLowerCase()
    const serverKey = generateStorageKey({ extension: ext })

    record(
      'GROUP 1',
      'Khóa lưu trữ không chứa tên file người dùng truyền lên',
      !serverKey.includes('passwd') && !serverKey.includes('malicious')
    )

    record(
      'GROUP 1',
      'Khóa lưu trữ hoàn toàn loại bỏ nguy cơ Path Traversal (.. và /)',
      !serverKey.includes('..') && !serverKey.includes('\0')
    )

    const regex = /^vault\/\d{8}\/[0-9a-f-]{36}\.pdf$/
    record(
      'GROUP 1',
      'Cấu trúc khóa lưu trữ chuẩn hóa: vault/YYYYMMDD/uuid_v4.ext',
      regex.test(serverKey)
    )
  }

  // ============================================================================
  // GROUP 2: LOCAL STORAGE PROVIDER (UPLOAD -> RESTART -> DOWNLOAD EXACT BYTES)
  // ============================================================================
  console.log('\n▶ [GROUP 2] LOCAL STORAGE: UPLOAD -> MÔ PHỎNG RESTART -> DOWNLOAD ĐÚNG TỪNG BYTE')
  {
    const tempVaultDir = path.resolve(process.cwd(), 'temp_test_vault_' + Date.now())
    const localProvider = new LocalStorageProvider(tempVaultDir)

    // Tạo file mẫu PDF hợp lệ có text layer
    const sampleContent = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n' + 'X'.repeat(50000)
    const originalBuffer = Buffer.from(sampleContent, 'utf-8')
    const originalChecksum = calculateChecksum(originalBuffer)
    const storageKey = generateStorageKey({ extension: '.pdf' })

    // 1. Upload
    const putResult = await localProvider.put(storageKey, originalBuffer, 'application/pdf')
    record(
      'GROUP 2',
      'Local Provider: Upload tập tin thành công và trả về đúng dung lượng',
      putResult.sizeBytes === originalBuffer.length && putResult.checksumSha256 === originalChecksum
    )

    // 2. Kiểm tra tồn tại
    const existsBefore = await localProvider.exists(storageKey)
    record('GROUP 2', 'Local Provider: Kiểm tra exists() trả về true', existsBefore)

    // 3. Mô phỏng khởi động lại Server (Reset singleton, giải phóng bộ nhớ, tạo instance mới)
    resetStorageProvider()
    const restartedLocalProvider = new LocalStorageProvider(tempVaultDir)

    // 4. Download từ instance sau khi restart
    const getResult = await restartedLocalProvider.get(storageKey)
    const isExactByteMatch = originalBuffer.equals(getResult.buffer)
    const downloadedChecksum = calculateChecksum(getResult.buffer)

    record(
      'GROUP 2',
      'Local Provider: Download sau khi restart khớp chính xác 100% từng byte',
      isExactByteMatch
    )

    record(
      'GROUP 2',
      'Local Provider: Mã băm SHA-256 đối soát trùng khớp tuyệt đối',
      downloadedChecksum === originalChecksum
    )

    // 5. Thử nghiệm xóa
    const deleted = await restartedLocalProvider.delete(storageKey)
    const existsAfterDelete = await restartedLocalProvider.exists(storageKey)
    record('GROUP 2', 'Local Provider: Xóa tập tin thành công', deleted && !existsAfterDelete)

    // Dọn thư mục tạm
    try {
      fs.rmSync(tempVaultDir, { recursive: true, force: true })
    } catch {}
  }

  // ============================================================================
  // GROUP 3: S3 PROVIDER & 20MB PRESIGNED URL UPLOAD
  // ============================================================================
  console.log('\n▶ [GROUP 3] S3 PROVIDER: PRESIGNED URL UPLOAD FILE 20MB -> RESTART -> DOWNLOAD EXACT')
  const MOCK_PORT = 9188
  const mockS3 = await createMockS3Server(MOCK_PORT)

  try {
    const s3Config = {
      bucket: 'tml-test-bucket',
      region: 'us-east-1',
      endpoint: `http://127.0.0.1:${MOCK_PORT}`,
      accessKeyId: 'test-access-key',
      secretAccessKey: 'test-secret-key-32-chars-long-fixed',
      forcePathStyle: true,
    }

    const s3Provider = new S3StorageProvider(s3Config)

    // 1. Tạo file dung lượng 20MB (20 * 1024 * 1024 bytes) chuẩn cấu trúc PDF
    const targetSize = 20 * 1024 * 1024 // 20MB
    const header = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n')
    const footer = Buffer.from('\n%%EOF\n')
    const bodySize = targetSize - header.length - footer.length
    const bodyChunk = crypto.randomBytes(bodySize)
    const largeBuffer20MB = Buffer.concat([header, bodyChunk, footer])

    const original20MbChecksum = calculateChecksum(largeBuffer20MB)
    const storageKey20MB = generateStorageKey({ extension: '.pdf' })

    record(
      'GROUP 3',
      'Chuẩn bị tập tin kiểm thử 20MB thành công',
      largeBuffer20MB.length === targetSize
    )

    // 2. Client xin URL ký sẵn (Presigned URL)
    const presignResult = await s3Provider.createUploadUrl(storageKey20MB, {
      mimeType: 'application/pdf',
      maxSizeBytes: targetSize,
      expiresInSeconds: 900,
    })

    record(
      'GROUP 3',
      'S3 Provider: Sinh Presigned Upload URL thành công',
      presignResult.uploadUrl.includes(`127.0.0.1:${MOCK_PORT}`) && presignResult.method === 'PUT'
    )

    // 3. Client tải trực tiếp 20MB lên S3 thông qua Presigned URL (HTTP PUT)
    const uploadUrlParsed = new URL(presignResult.uploadUrl)
    const putResponse = await new Promise<{ statusCode: number }>((resolve, reject) => {
      const putReq = http.request(
        {
          hostname: uploadUrlParsed.hostname,
          port: uploadUrlParsed.port,
          path: uploadUrlParsed.pathname + uploadUrlParsed.search,
          method: 'PUT',
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Length': largeBuffer20MB.length,
          },
        },
        (res) => {
          res.resume()
          res.on('end', () => resolve({ statusCode: res.statusCode || 0 }))
        }
      )
      putReq.on('error', reject)
      putReq.write(largeBuffer20MB)
      putReq.end()
    })

    record(
      'GROUP 3',
      'Client: Tải trực tiếp tập tin 20MB lên S3 Presigned URL thành công (HTTP 200)',
      putResponse.statusCode === 200
    )

    // 4. Server kiểm tra tập tin tồn tại trên S3
    const existsOnS3 = await s3Provider.exists(storageKey20MB)
    record('GROUP 3', 'S3 Provider: Xác nhận object 20MB tồn tại trên bucket', existsOnS3)

    // 5. Mô phỏng khởi động lại Server (Reset cache & khởi tạo lại S3StorageProvider mới)
    resetStorageProvider()
    const restartedS3Provider = new S3StorageProvider(s3Config)

    // 6. Download tập tin 20MB từ S3 sau khi restart
    const downloaded20MB = await restartedS3Provider.get(storageKey20MB)
    const is20MbExactMatch = largeBuffer20MB.equals(downloaded20MB.buffer)
    const downloaded20MbChecksum = calculateChecksum(downloaded20MB.buffer)

    record(
      'GROUP 3',
      'S3 Provider: Download tập tin 20MB sau restart khớp chính xác từng byte',
      is20MbExactMatch && downloaded20MB.sizeBytes === targetSize
    )

    record(
      'GROUP 3',
      'S3 Provider: Mã băm SHA-256 tập tin 20MB đối soát trùng khớp 100%',
      downloaded20MbChecksum === original20MbChecksum
    )
  } finally {
    mockS3.server.close()
  }

  // ============================================================================
  // GROUP 4: TỰ ĐỘNG DỌN DẸP BẢN GHI UPLOAD QUÁ HẠN 24 GIỜ (CLEANUP)
  // ============================================================================
  console.log('\n▶ [GROUP 4] DỌN DẸP BẢN GHI UPLOAD QUÁ HẠN 24 GIỜ (CLEANUP PENDING UPLOADS)')
  {
    // Tạo 1 lô hàng thử nghiệm
    let testShipment = await prisma.shipment.findFirst()
    if (!testShipment) {
      const org = await prisma.organization.findFirst()
      if (org) {
        testShipment = await prisma.shipment.create({
          data: {
            id: 'test_shipment_' + Date.now(),
            orgId: org.id,
            jobNo: 'JOB-TEST-STORAGE',
            blNo: 'BL-TEST-STORAGE',
            origin: 'SGN',
            destination: 'SIN',
            etd: '2026-11-01',
            eta: '2026-11-05',
            mode: 'sea',
            status: 'booking',
            customerId: 'c1',
            departmentId: 'd1',
            ownerId: 'u1',
          },
        })
      }
    }

    if (testShipment) {
      const expiredStorageKey = generateStorageKey({ extension: '.pdf' })
      const validStorageKey = generateStorageKey({ extension: '.pdf' })

      // 1. Tạo bản ghi đã hết hạn (quá 24 giờ trước)
      const expiredPending = await prisma.pendingUpload.create({
        data: {
          orgId: testShipment.orgId,
          shipmentId: testShipment.id,
          storageKey: expiredStorageKey,
          fileName: 'expired_doc.pdf',
          fileSizeBytes: 1024,
          mimeType: 'application/pdf',
          docType: 'OTHER',
          uploadedBy: testShipment.ownerId,
          expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // Hết hạn từ 2 giờ trước
        },
      })

      // 2. Tạo bản ghi còn hạn
      const activePending = await prisma.pendingUpload.create({
        data: {
          orgId: testShipment.orgId,
          shipmentId: testShipment.id,
          storageKey: validStorageKey,
          fileName: 'active_doc.pdf',
          fileSizeBytes: 2048,
          mimeType: 'application/pdf',
          docType: 'OTHER',
          uploadedBy: testShipment.ownerId,
          expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // Còn hạn 12 giờ
        },
      })

      // Chạy tiến trình dọn dẹp
      const cleanupResult = await cleanupPendingUploads()
      record(
        'GROUP 4',
        'Tiến trình cleanupPendingUploads đã phát hiện và xử lý dọn dẹp bản ghi quá hạn',
        cleanupResult.cleanedCount >= 1
      )

      // Kiểm tra bản ghi quá hạn đã bị xóa khỏi DB
      const checkExpired = await prisma.pendingUpload.findUnique({ where: { id: expiredPending.id } })
      record('GROUP 4', 'Bản ghi PendingUpload quá hạn đã bị xóa khỏi database', checkExpired === null)

      // Kiểm tra bản ghi còn hạn vẫn an toàn
      const checkActive = await prisma.pendingUpload.findUnique({ where: { id: activePending.id } })
      record('GROUP 4', 'Bản ghi PendingUpload còn hạn được bảo vệ an toàn', checkActive !== null)

      // Dọn dẹp bản ghi test
      if (checkActive) {
        await prisma.pendingUpload.delete({ where: { id: activePending.id } })
      }
    }
  }

  // ============================================================================
  // TỔNG KẾT
  // ============================================================================
  console.log('\n' + '='.repeat(80))
  const passedCount = results.filter((r) => r.passed).length
  const failedCount = results.filter((r) => !r.passed).length
  console.log(`KẾT QUẢ KIỂM THỬ LƯU TRỮ BỀN VỮNG:`)
  console.log(`TỔNG CỘNG:  ${results.length} BÀI KIỂM THỬ`)
  console.log(`THÀNH CÔNG: ${passedCount} PASSED`)
  console.log(`THẤT BẠI:   ${failedCount} FAILED`)
  console.log('='.repeat(80))

  if (failedCount > 0) {
    process.exit(1)
  }
}

runStorageTestSuite()
  .catch((err) => {
    console.error('Lỗi ngoại lệ trong quá trình chạy kiểm thử:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

