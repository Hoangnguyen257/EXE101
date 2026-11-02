# HƯỚNG DẪN TRIỂN KHAI VẬN HÀNH HỆ THỐNG TML LOGISTICS
*(TML Logistics Document Management - Production Deployment Guide)*

Tài liệu này cung cấp hướng dẫn chi tiết, chính xác và bám sát thực tế kiến trúc hệ thống để triển khai giải pháp Quản lý Chứng từ Vận tải TML Logistics trên môi trường máy chủ vận hành (Staging & Production).

---

## 1. YÊU CẦU PHẦN CỨNG VÀ PHẦN MỀM HỆ THỐNG

### 1.1. Cấu hình Máy chủ Khuyến nghị (VPS / Cloud Server)
- **Hệ điều hành:** Ubuntu 22.04 LTS / 24.04 LTS, Debian 12, hoặc Windows Server 2022.
- **CPU:** Tối thiểu 2 vCPU (khuyến nghị 4 vCPU nếu thực hiện bóc tách OCR số lượng lớn chứng từ đồng thời).
- **RAM:** Tối thiểu 4 GB (khuyến nghị 8 GB để đảm bảo hiệu năng xử lý văn bản và cache).
- **Ổ cứng (Storage):** Tối thiểu 50 GB SSD/NVMe SSD (dành cho hệ điều hành, CSDL và kho lưu trữ tệp tin).
- **Môi trường thực thi:** Node.js LTS (v20.x hoặc v22.x) kèm `npm` v10+.

### 1.2. Kiến trúc Hạ tầng Vận hành Thực tế
- **Cơ sở dữ liệu:** PostgreSQL 14+ cho môi trường Production (hoặc SQLite cho môi trường Staging/Dev nội bộ).
- **Tầng Lưu trữ Tệp tin (Storage Provider):** Hỗ trợ linh hoạt 2 tùy chọn:
  1. *Local Disk Storage:* Lưu trữ trên phân vùng ổ đĩa cục bộ của VPS (`storage_vault/`).
  2. *Cloud Object Storage:* AWS S3, Cloudflare R2, hoặc MinIO (kèm Presigned URL).
- **Cơ chế Giới hạn Tần suất (Rate Limiting) & Quản lý Phiên (Session):**
  - Hệ thống sử dụng kiến trúc **In-Memory Sliding Window Rate Limiting** kết hợp quản lý phiên đăng nhập trực tiếp qua bảng **Session trong Cơ sở dữ liệu**.
  - **Lưu ý quan trọng:** Hệ thống **KHÔNG bắt buộc cụm Redis Cluster** để vận hành. Kiến trúc hiện tại hoàn toàn đáp ứng tối đa độ tin cậy và hiệu năng cao cho các mô hình máy chủ đơn (Single-Instance / VPS tiêu chuẩn).

---

## 2. CẤU HÌNH BIẾN MÔI TRƯỜNG (.ENV)

Tạo tập tin `.env` tại thư mục gốc của dự án với các giá trị phù hợp với môi trường vận hành:

```ini
# ==============================================================================
# CẤU HÌNH MÔI TRƯỜNG VẬN HÀNH CHUẨN - TML LOGISTICS
# ==============================================================================

# 1. Môi trường Thực thi & Địa chỉ Web
NODE_ENV="production"
PORT=3000
NEXT_PUBLIC_APP_URL="https://tml.yourdomain.vn"

# 2. Cơ sở Dữ liệu (PostgreSQL Production)
# Cấu trúc: postgresql://<user>:<password>@<host>:<port>/<dbname>?schema=public
DATABASE_URL="postgresql://tml_admin:Secur3P@ssw0rd2026!@localhost:5432/tml_logistics?schema=public"

# 3. Khóa Bảo mật JWT & Session (BẮT BUỘC: Chuỗi ngẫu nhiên tối thiểu 32 ký tự)
# Lệnh tạo chuỗi an toàn trên terminal: openssl rand -hex 32
JWT_SECRET="a7d9e4c1f5b82039e8d7124a90c345ef67890123456789abcdef0123456789ab"
NEXTAUTH_SECRET="f1e2d3c4b5a697887766554433221100aabbccddeeff00112233445566778899"

# 4. Tùy chọn Tầng Lưu trữ Tập tin Chứng từ (Storage Provider)
# Lựa chọn 1: Lưu trữ Cục bộ (Local Storage)
STORAGE_DRIVER="local"
STORAGE_LOCAL_PATH="./storage_vault"

# Lựa chọn 2: Lưu trữ Đám mây AWS S3 / Cloudflare R2 / MinIO (Bỏ comment nếu dùng)
# STORAGE_DRIVER="s3"
# S3_BUCKET="tml-doc-vault"
# S3_REGION="ap-southeast-1"
# S3_ACCESS_KEY_ID="AKIAXXXXXXXXXXXXXXXX"
# S3_SECRET_ACCESS_KEY="YYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY"
# S3_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"  # Nếu dùng Cloudflare R2 hoặc MinIO
# S3_FORCE_PATH_STYLE="false"                                # Đặt "true" nếu dùng MinIO
```

---

## 3. CÁC BƯỚC TRIỂN KHAI TRÊN LINUX (UBUNTU / DEBIAN)

### Bước 1: Chuẩn bị Môi trường Máy chủ
Cập nhật hệ thống và cài đặt Node.js LTS, Git, Nginx:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx build-essential

# Cài đặt Node.js 20 LTS từ NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Cài đặt PM2 toàn cục để quản lý tiến trình
sudo npm install -g pm2
```

### Bước 2: Chuẩn bị Mã nguồn và Cài đặt Thư viện
```bash
# Tạo thư mục ứng dụng
sudo mkdir -p /var/www/tml-logistics
sudo chown -R $USER:$USER /var/www/tml-logistics

# Clone hoặc giải nén mã nguồn vào thư mục
cd /var/www/tml-logistics
git clone <git-repository-url> .

# Cài đặt toàn bộ dependencies sạch
npm ci --legacy-peer-deps
```

### Bước 3: Cấu hình Cơ sở Dữ liệu PostgreSQL
1. Cài đặt PostgreSQL:
```bash
sudo apt install -y postgresql postgresql-contrib
```

2. Tạo Database và User quản trị:
```bash
sudo -u postgres psql -c "CREATE USER tml_admin WITH PASSWORD 'Secur3P@ssw0rd2026!';"
sudo -u postgres psql -c "CREATE DATABASE tml_logistics OWNER tml_admin;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE tml_logistics TO tml_admin;"
```

3. Chuyển đổi Prisma Provider sang PostgreSQL và thực thi Migration:
```bash
# Chuyển đổi cấu hình Prisma sang postgresql
npm run db:provider:postgres

# Thực thi migration DDL lên CSDL PostgreSQL
npx prisma migrate deploy
```

### Bước 4: Khởi tạo Dữ liệu Quản trị viên Ban đầu (Production Seed)
Chạy lệnh seed dữ liệu sản xuất. Hệ thống sẽ tạo duy nhất tài khoản `admin@tml.vn` với mật khẩu ngẫu nhiên:
```bash
npm run db:seed
```
> [!IMPORTANT]
> Màn hình console sẽ hiển thị mật khẩu ngẫu nhiên duy nhất của tài khoản `admin@tml.vn`. Lưu lại mật khẩu này an toàn. Tài khoản được thiết lập cờ `mustChangePassword=true`, bắt buộc đổi mật khẩu ngay trong phiên đăng nhập đầu tiên.

### Bước 5: Cấu hình Kho Lưu trữ (Storage Vault)
Nếu sử dụng `STORAGE_DRIVER="local"`, tạo thư mục kho lưu trữ và phân quyền nghiêm ngặt:
```bash
mkdir -p /var/www/tml-logistics/storage_vault
chmod 750 /var/www/tml-logistics/storage_vault
```

### Bước 6: Biên dịch Bản Production (Production Build)
Biên dịch ứng dụng với Turbopack (đã tắt `ignoreBuildErrors` để đảm bảo an toàn tuyệt đối):
```bash
npm run build
```

### Bước 7: Quản lý Tiến trình với PM2
Khởi chạy ứng dụng và kích hoạt tính năng tự khởi động khi máy chủ reboot:
```bash
# Khởi chạy ứng dụng
pm2 start npm --name "tml-logistics" -- start

# Lưu cấu hình và tạo tiến trình khởi động cùng hệ thống
pm2 save
pm2 startup
```

### Bước 8: Cấu hình Nginx Reverse Proxy & Chứng chỉ SSL (HTTPS)
1. Tạo file cấu hình `/etc/nginx/sites-available/tml-logistics`:
```nginx
server {
    listen 80;
    server_name tml.yourdomain.vn;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tml.yourdomain.vn;

    # Cấu hình SSL (Certbot sẽ tự động điền phần này)
    ssl_certificate /etc/letsencrypt/live/tml.yourdomain.vn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tml.yourdomain.vn/privkey.pem;

    # Cho phép tải lên chứng từ kích thước tối đa 30MB
    client_max_body_size 30M;

    # Định tuyến ứng dụng chính
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

    # Hỗ trợ Server-Sent Events (SSE) đồng bộ thời gian thực không bị đệm (no-buffer)
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

2. Kích hoạt Virtual Host và cài đặt chứng chỉ SSL miễn phí qua Let's Encrypt:
```bash
sudo ln -s /etc/nginx/sites-available/tml-logistics /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Cài đặt Certbot và lấy chứng chỉ SSL tự động
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d tml.yourdomain.vn
```

---

## 4. HƯỚNG DẪN CẤU HÌNH CLOUD STORAGE (KHI DÙNG S3 / R2)

Nếu doanh nghiệp sử dụng AWS S3 hoặc Cloudflare R2 thay vì lưu trữ cục bộ:

### 4.1. Tạo S3 Bucket
1. Đăng nhập vào AWS Console, truy cập dịch vụ S3 và tạo Bucket mới (ví dụ: `tml-doc-vault`).
2. Bật tùy chọn **Block Public Access** (Chặn hoàn toàn truy cập công cộng trực tiếp, toàn bộ luồng tải lên và xem tệp đều qua xác thực phân quyền của ứng dụng).
3. Cấu hình CORS trên S3 Bucket để hỗ trợ Presigned Upload URL:
```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "POST", "GET"],
    "AllowedOrigins": ["https://tml.yourdomain.vn"],
    "ExposeHeaders": ["ETag"]
  }
]
```

### 4.2. Cấp quyền IAM User
Tạo IAM Policy giới hạn quyền thao tác chỉ trên Bucket chỉ định:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:HeadObject"
      ],
      "Resource": "arn:aws:s3:::tml-doc-vault/*"
    }
  ]
}
```

---

## 5. BẢO TRÌ, SAO LƯU DỰ PHÒNG & KHÔI PHỤC THẢM HỌA

### 5.1. Tự động Sao lưu Cơ sở Dữ liệu Định kỳ
Thiết lập cron job sao lưu CSDL PostgreSQL hàng ngày lúc 02:00 sáng:
```bash
crontab -e
```
Thêm dòng sau vào crontab:
```bash
0 2 * * * pg_dump -U tml_admin -h localhost tml_logistics | gzip > /var/backups/tml_db_$(date +\%Y\%m\%d).sql.gz
```

### 5.2. Đồng bộ Kho Tệp tin Cục bộ Ra Ổ đĩa Dự phòng / S3
Nếu dùng Local Storage, đồng bộ định kỳ thư mục `storage_vault/`:
```bash
# Đồng bộ sang máy chủ lưu trữ dự phòng:
rsync -avz /var/www/tml-logistics/storage_vault/ backup-server:/data/tml_vault_backups/
```

### 5.3. Kiểm tra Tính Toàn vẹn Kho Lưu trữ (Vault Integrity Check)
Dự án cung cấp kịch bản kiểm toán đối soát băm SHA-256 giữa CSDL và các tập tin vật lý thực tế:
```bash
npx tsx scripts/verify-vault-integrity.ts
```

---

## 6. KIỂM TRA HỆ THỐNG SAU TRIỂN KHAI (POST-DEPLOYMENT SMOKE TEST)

Sau khi hoàn tất toàn bộ các bước, thực hiện các thao tác nghiệm thu sau:

1. **Kiểm tra API Sức khỏe:**
```bash
curl -I https://tml.yourdomain.vn/api/health
```
Kỳ vọng trả về mã HTTP `200 OK`.

2. **Đăng nhập Lần đầu & Đổi Mật khẩu:**
   - Truy cập `https://tml.yourdomain.vn/login`.
   - Đăng nhập với tài khoản `admin@tml.vn` và mật khẩu ngẫu nhiên được sinh ra trong bước seed.
   - Hệ thống tự động chuyển hướng người dùng sang trang đổi mật khẩu bắt buộc (`/change-password`).
   - Đặt mật khẩu mới đáp ứng tiêu chuẩn an toàn (tối thiểu 8 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt).

3. **Kiểm tra Quy trình Nghiệp vụ:**
   - Tạo mới 1 lô hàng qua Shipment Wizard 3 bước.
   - Tải lên 1 tập tin chứng từ PDF/hình ảnh mẫu.
   - Thử nghiệm tính năng xem trực tiếp tập tin thật (PDF/ảnh) và nội dung văn bản bóc tách OCR.
   - Thử nghiệm tính năng tạo liên kết chia sẻ công khai và kiểm tra phản hồi 404 sau khi xóa mềm chứng từ.
