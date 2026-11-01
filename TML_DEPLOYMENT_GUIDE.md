# TML – TEXT MINING LIBRARY
## HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG (SYSTEM DEPLOYMENT GUIDE)

---

### 1. YÊU CẦU PHẦN CỨNG VÀ HỆ ĐIỀU HÀNH

#### 1.1. Cấu hình máy chủ đề xuất (Staging / Production)
- **Hệ điều hành:** Ubuntu 22.04 / 24.04 LTS hoặc Windows Server 2022.
- **CPU:** Tối thiểu 2 vCPU (khuyến nghị 4 vCPU nếu xử lý OCR song song nhiều tài liệu).
- **RAM:** Tối thiểu 4 GB (khuyến nghị 8 GB).
- **Ổ cứng (Storage):** Tối thiểu 50 GB SSD (ưu tiên NVMe SSD cho thư mục `storage_vault/`).
- **Node.js:** Phiên bản Node.js LTS (v20.x hoặc v24.x).
- **Package Manager:** `npm` v10+ hoặc `pnpm` v9+.

---

### 2. CẤU HÌNH BIẾN MÔI TRƯỜNG (.ENV)

Tạo file `.env` tại thư mục gốc của dự án dựa trên mẫu dưới đây:

```ini
# ==============================================================================
# TML LOGISTICS - PRODUCTION / STAGING ENVIRONMENT CONFIGURATION
# ==============================================================================

# 1. Môi trường chạy
NODE_ENV=production
PORT=3000

# 2. Cơ sở dữ liệu (PostgreSQL hoặc SQLite)
# Dành cho PostgreSQL Production:
# DATABASE_URL="postgresql://tml_user:StrongPassword2026!@localhost:5432/tml_logistics?schema=public"
# Dành cho SQLite Staging / Local:
DATABASE_URL="file:./dev.db"

# 3. Bảo mật JWT & Session (BẮT BUỘC: Tối thiểu 32 ký tự ngẫu nhiên bảo mật cao)
# Tuyệt đối không để trống hoặc dùng chuỗi mặc định 'fallback-secret-for-dev-only'
JWT_SECRET="b67e88c0a9e7f81d45bc901a2f43de9971bc32890a56e4312fa8901234567890"

# 4. Kho lưu trữ tập tin nhị phân (Storage Vault)
# Mặc định sử dụng thư mục cục bộ nằm ngoài web root
STORAGE_VAULT_PATH="./storage_vault"

# 5. Cấu hình Cookie & Tên miền
COOKIE_DOMAIN=""
NEXT_PUBLIC_APP_URL="https://tml.yourcompany.com"
```

---

### 3. CÁC BƯỚC TRIỂN KHAI TRÊN LINUX (UBUNTU / DEBIAN)

#### Bước 1: Chuẩn bị mã nguồn và cài đặt dependencies
```bash
# Clone hoặc giải nén mã nguồn vào thư mục ứng dụng
cd /opt/tml-doc-manager

# Cài đặt dependencies với cờ production-ready
npm ci --legacy-peer-deps
```

#### Bước 2: Khởi tạo Cơ sở dữ liệu & Migration
```bash
# Tạo cấu trúc bảng và thực thi migration
npx prisma generate
npx prisma migrate deploy

# (Tùy chọn) Nạp dữ liệu mẫu ban đầu nếu là môi trường Staging
npm run db:seed
```

#### Bước 3: Tạo thư mục Storage Vault và phân quyền
```bash
# Tạo thư mục kho lưu trữ nằm ngoài web root
mkdir -p /opt/tml-doc-manager/storage_vault
chmod 750 /opt/tml-doc-manager/storage_vault
```

#### Bước 4: Biên dịch ứng dụng cho Production
```bash
npm run build
```

#### Bước 5: Cấu hình PM2 Process Manager
Tạo file `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'tml-logistics',
      script: 'npm',
      args: 'start',
      cwd: '/opt/tml-doc-manager',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
```
Khởi chạy dịch vụ:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

#### Bước 6: Cấu hình Nginx Reverse Proxy & SSL (HTTPS)
Tạo file cấu hình `/etc/nginx/sites-available/tml.conf`:
```nginx
server {
    listen 80;
    server_name tml.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tml.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/tml.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tml.yourcompany.com/privkey.pem;

    client_max_body_size 30M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Hỗ trợ Server-Sent Events (SSE) không bị buffer
    location /api/sync/events {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 24h;
    }
}
```

---

### 4. CÁC BƯỚC TRIỂN KHAI TRÊN WINDOWS SERVER

1. Cài đặt **Node.js LTS (v20+)** và **Git for Windows**.
2. Giải nén mã nguồn vào thư mục (ví dụ: `C:\inetpub\tml-doc-manager`).
3. Mở PowerShell với quyền Administrator:
   ```powershell
   cd C:\inetpub\tml-doc-manager
   npm install
   npx prisma generate
   npx prisma migrate deploy
   npm run build
   ```
4. Cài đặt dịch vụ Windows Service tự khởi động bằng `nssm` (Non-Sucking Service Manager):
   ```powershell
   nssm install TmlLogistics "C:\Program Files\nodejs\npm.cmd" "start"
   nssm set TmlLogistics AppDirectory "C:\inetpub\tml-doc-manager"
   nssm start TmlLogistics
   ```

---

### 5. KIỂM TRA SAU TRIỂN KHAI (POST-DEPLOYMENT SMOKE TEST)

Thực hiện kiểm tra endpoint giám sát sức khỏe:
```bash
curl -X GET https://tml.yourcompany.com/api/health
```
Kết quả kỳ vọng trả về:
```json
{
  "status": "healthy",
  "database": { "connected": true },
  "storage": { "writable": true }
}
```
Nếu `status` trả về `healthy`, hệ thống đã sẵn sàng đưa vào vận hành.

