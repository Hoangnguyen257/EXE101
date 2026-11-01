# TML LOGISTICS – TASK 14: SỔ TAY HƯỚNG DẪN TRIỂN KHAI, SAO LƯU & VẬN HÀNH PRODUCTION
*(PRODUCTION DEPLOYMENT, BACKUP & DISASTER RECOVERY RUNBOOK)*

---

## 1. YÊU CẦU HẠ TẦNG VÀ TIỀN ĐỀ KỸ THUẬT (PREREQUISITES)

| Thành phần hạ tầng | Cấu hình tối thiểu (Staging) | Cấu hình khuyến nghị (Production) | Ghi chú vận hành |
| :--- | :--- | :--- | :--- |
| **Hệ điều hành** | Ubuntu 22.04 LTS / Debian 12 | Ubuntu 24.04 LTS / RHEL 9 | Hỗ trợ Containerization Docker |
| **Node.js Runtime** | Node.js v20.x LTS | Node.js v22.x LTS hoặc v24.x | Cần tối thiểu 2GB RAM cho tiến trình |
| **Cơ sở dữ liệu** | PostgreSQL 15 | AWS RDS PostgreSQL 16 HA / Cloud SQL | Bật chế độ tự động sao lưu hàng ngày |
| **Bộ đệm Redis** | Redis 7.0 Standalone | Redis Cluster 7.2 hoặc AWS ElastiCache | Hỗ trợ cụm phân tán và khóa nguyên tử |
| **Kho Storage Vault** | Thư mục cục bộ `storage_vault/` | Mouted Network File System (EFS/NFS) | Định dạng ext4, phân quyền `chmod 750` |

---

## 2. BẢNG BIẾN MÔI TRƯỜNG CHUẨN (`.env.production`)

Tạo tập tin `.env.production` tại thư mục gốc của dự án với các giá trị bí mật được mã hóa an toàn:

```env
# ==============================================================================
# TML LOGISTICS - PRODUCTION ENVIRONMENT VARIABLES
# ==============================================================================
NODE_ENV=production
PORT=3000

# 1. Cơ sở dữ liệu chính (PostgreSQL Production)
DATABASE_URL="postgresql://tml_admin:VerySecurePassword2026!@postgres-cluster.tml.internal:5432/tml_logistics_prod?schema=public&sslmode=require&connection_limit=20"

# 2. Cụm Cache & Rate Limiting (Redis)
REDIS_URL="rediss://:RedisAuthSecret2026!@redis-cluster.tml.internal:6379/0"
REDIS_RATE_LIMIT_MODE="sliding_window"

# 3. Chuỗi bí mật ký Token & Phiên làm việc (Bắt buộc tối thiểu 32 ký tự ngẫu nhiên)
JWT_SECRET="c8f1d74a2b9e4a3b8c5d1e7f0a2b4c6e8d0f2a4b6c8e0a2b4c6e8d0f2a4b6c8e"
SHARE_JWT_SECRET="9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b"

# 4. Cấu hình Bảo mật Cookie & Tên miền
NEXTAUTH_URL="https://tml.logistics.vn"
COOKIE_SECURE=true
COOKIE_SAME_SITE="lax"

# 5. Đường dẫn Kho lưu trữ Chứng từ
STORAGE_VAULT_PATH="/var/data/tml_storage_vault"
```

---

## 3. QUY TRÌNH TRIỂN KHAI PRODUCTION TỪNG BƯỚC

### Bước 1: Chuẩn bị mã nguồn và cài đặt thư viện
```bash
git checkout tags/v1.0.0-RC
npm ci --production=false
```

### Bước 2: Triển khai Migration Cơ sở dữ liệu PostgreSQL
```bash
npx prisma migrate deploy --schema=prisma/schema.postgresql.prisma
```
*Lưu ý: Không dùng `prisma db push` trên môi trường Production để tránh làm mất dữ liệu.*

### Bước 3: Khởi tạo Dữ liệu Nền tảng (Initial Seed)
*(Chỉ chạy 1 lần duy nhất khi khởi tạo database mới)*
```bash
npx tsx prisma/seed.ts
```

### Bước 4: Biên dịch Ứng dụng Next.js Production
```bash
npm run build
```

### Bước 5: Khởi chạy Ứng dụng qua PM2 Cluster Mode
Tạo file `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'tml-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      instances: 'max',
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
```
Khởi động cụm dịch vụ:
```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

---

## 4. QUY TRÌNH SAO LƯU & PHỤC HỒI THẢM HỌA (DISASTER RECOVERY)

### 4.1. Quy trình Tự động Sao lưu Cơ sở dữ liệu (`scripts/backup-restore.ts`)
Tạo cron job chạy hàng ngày lúc 01:00 AM:
```bash
0 1 * * * cd /var/www/tml && npx tsx scripts/backup-restore.ts >> /var/log/tml_backup.log 2>&1
```
- Bản sao lưu được lưu trữ tại thư mục `backups/`.
- Tự động sinh file `.json` Manifest chứa mã băm **SHA-256 Checksum** để đối soát tính toàn vẹn.

### 4.2. Quy trình Kiểm toán Toàn vẹn Kho Chứng từ (`scripts/verify-vault-integrity.ts`)
Chạy định kỳ hàng tuần để phát hiện tập tin bị mất, hỏng hoặc sửa đổi trái phép:
```bash
npx tsx scripts/verify-vault-integrity.ts
```
*Tiêu chuẩn an toàn:* Tỷ lệ toàn vẹn kho (`integrityPercentage`) phải đạt **100%**.

### 4.3. Quy trình Khôi phục Tác vụ OCR bị Gián đoạn (`scripts/recover-interrupted-ocr-jobs.ts`)
Tự động kích hoạt sau khi máy chủ khởi động lại:
```bash
npx tsx scripts/recover-interrupted-ocr-jobs.ts
```

---

## 5. GIÁM SÁT HỆ THỐNG QUA HEALTH CHECK ENDPOINT

Điểm cuối giám sát: `GET /api/health`

### Phản hồi Mẫu (HTTP 200 OK):
```json
{
  "status": "healthy",
  "timestamp": "2026-11-01T07:33:41.000Z",
  "uptimeSeconds": 14280,
  "environment": "production",
  "database": {
    "connected": true,
    "latencyMs": 4
  },
  "storage": {
    "writable": true,
    "vaultDir": "/var/data/tml_storage_vault"
  },
  "memory": {
    "rssMb": 85,
    "heapUsedMb": 52
  },
  "responseTimeMs": 6
}
```

### Các Ngưỡng Kích hoạt Cảnh báo (Alert Thresholds):
- `status == "unhealthy"`: Báo động khẩn cấp P1 (Database mất kết nối hoặc Storage lỗi ghi).
- `database.latencyMs > 200ms`: Cảnh báo tải cao cơ sở dữ liệu (P2 Warning).
- `memory.heapUsedMb > 1200MB`: Cảnh báo rò rỉ bộ nhớ hoặc chuẩn bị chạm trần V8 Heap (P2 Warning).

---

## 6. QUY TRÌNH ROLLBACK (KHI GẶP SỰ CỐ BẢN PHÁT HÀNH)

Nếu phiên bản mới phát sinh sự cố nghiêm trọng sau khi triển khai:

1. **Rollback mã nguồn:**
   ```bash
   git checkout tags/v_previous_stable
   npm ci
   npm run build
   pm2 restart tml-app
   ```
2. **Khôi phục cơ sở dữ liệu (Nếu Schema bị lỗi):**
   ```bash
   npx tsx scripts/backup-restore.ts --restore backups/tml_backup_previous.sqlite
   ```
3. **Thu hồi phiên làm việc người dùng (Force Re-login nếu có rò rỉ token):**
   Chạy lệnh SQL vô hiệu hóa toàn bộ session:
   ```sql
   UPDATE "Session" SET "revokedAt" = NOW() WHERE "revokedAt" IS NULL;
   ```

