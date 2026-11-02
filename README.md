# TML LOGISTICS - HỆ THỐNG QUẢN LÝ CHỨNG TỪ VẬN TẢI & TEXT MINING
*(Text Mining Library & Logistics Document Management System)*

Hệ thống quản lý vòng đời chứng từ vận tải quốc tế, bóc tách OCR thông minh, phân quyền doanh nghiệp đa tầng và chia sẻ tài liệu an toàn tuyệt đối. Được xây dựng trên nền tảng **Next.js 16 (App Router, Turbopack)**, **React 19**, **Prisma 6**, và giao diện chuẩn doanh nghiệp **Tailwind CSS / shadcn/ui**. Giao diện và thông báo lỗi 100% bằng tiếng Việt, thiết kế sẵn sàng đưa vào vận hành thực tế (Production-Ready).

---

## 1. TÍNH NĂNG CỐT LÕI HỆ THỐNG

### 1.1. Quản lý Hồ sơ Lô hàng & Wizard Tạo Lô hàng 3 Bước
- **Bước 1: Thông tin Vận tải:** Khởi tạo Job No, Master B/L (MBL), House B/L (HBL), loại hình vận tải, hãng tàu/hãng bay, cảng đi/cảng đến (POL/POD), ngày ETD/ETA và phân công nhân sự tham gia.
- **Bước 2: Danh mục Hàng hóa & HS Code:** 
  - Tra cứu và kiểm tra mã số thuế doanh nghiệp (MST) chuẩn checksum.
  - Quản lý danh sách chi tiết hàng hóa, số lượng, trọng lượng.
  - Tự động chuẩn hóa HS Code (bỏ dấu chấm, kiểm tra độ dài 6-8 chữ số).
  - Tự động khởi tạo Checklist chứng từ bắt buộc theo tính chất mặt hàng và loại hình xuất/nhập.
- **Bước 3: Tải lên Chứng từ & Kiểm soát Lưu trữ:**
  - Nhận diện định dạng thực tế qua Magic Bytes nhị phân (chống giả mạo phần mở rộng file).
  - Tự động băm SHA-256 đối soát tính toàn vẹn và chống trùng lặp.
  - Cập nhật tức thì trạng thái Checklist chứng từ khi upload thành công.

### 1.2. Trình Soạn thảo Chứng từ Trực quan (WYSIWYG Editor) & Quản lý Phiên bản
- Trình biên tập văn bản tích hợp Tiptap hỗ trợ định dạng bảng, chữ ký, căn chỉnh.
- Chức năng lưu phiên bản (`DocumentVersion`): Mỗi lần lưu tạo một bản ghi phiên bản mới, tự động lưu snapshot file HTML lên Storage Provider bền vững.
- Đối soát lịch sử thay đổi qua ghi chú (`changeNote`) và danh sách phiên bản chi tiết.

### 1.3. Bóc tách Văn bản OCR Tự động (PDF & Hình ảnh)
- Tích hợp công cụ OCR trích xuất nội dung văn bản từ tập tin PDF (hỗ trợ `pdf-parse` v2) và các định dạng hình ảnh (PNG, JPEG).
- Nhận diện và tự động phân loại thực thể vận tải: Số vận đơn (B/L Number), Số container, Cảng bốc/dỡ hàng (POL/POD), Tên tàu/Số chuyến.
- Cơ chế hàng đợi Worker (`ocr-worker`) hỗ trợ tự động phục hồi các tác vụ bị gián đoạn.

### 1.4. Phân quyền Doanh nghiệp 3 Lớp (Enterprise RBAC + ABAC)
- **Role-Based Access Control (RBAC):** 3 vai trò chuẩn:
  - `ADMIN`: Toàn quyền hệ thống, quản lý tài khoản, phòng ban, cấu hình và nhật ký kiểm toán.
  - `MANAGER`: Quản lý nghiệp vụ trong phạm vi phòng ban được phân công.
  - `STAFF`: Tác nghiệp trên các lô hàng và chứng từ do mình tạo hoặc được phân công tham gia.
- **Department-Based Access Control (DBAC):** Cách ly dữ liệu giữa các phòng ban (Phòng Chứng từ, Giao nhận, Kinh doanh, Kế toán).
- **Resource Context Scoping:** Kiểm tra quyền sở hữu (`ownerId`) và danh sách nhân sự tham gia (`assignedUserIds` / `participants`).
- **Explicit Deny Ưu tiên Cao nhất:** Bất kỳ quy tắc Deny trực tiếp nào ở cấp tài khoản đều ghi đè toàn bộ quyền hạn vai trò.

### 1.5. Chia sẻ Tài liệu Bảo mật Tuyệt đối
- **Chia sẻ Nội bộ:** Cấp quyền riêng biệt Xem (`VIEW`), Tải xuống (`DOWNLOAD`), Chỉnh sửa (`EDIT`) cho từng cá nhân hoặc toàn phòng ban.
- **Liên kết Công khai Ngoài:**
  - Chuỗi Token ngẫu nhiên 192-bit cryptographic entropy, chống đoán mò.
  - Bảo vệ tùy chọn bằng mật khẩu băm mã hóa bcrypt.
  - Thiết lập thời gian hết hạn (`expiresAt`) và giới hạn số lượt truy cập tối đa (`maxUses`).
  - Tích hợp Rate Limiter ngăn chặn tấn công brute-force mật khẩu.
  - **Bảo vệ Tài liệu Xóa mềm:** Khi chứng từ bị xóa mềm (`isDeleted: true`), tất cả các liên kết chia sẻ cũ lập tức bị vô hiệu hóa và trả về mã lỗi `404 Not Found`.
  - **Xem Tập tin Nhị phân Thật:** Trang chia sẻ công khai hỗ trợ xem trực tiếp file nhị phân (PDF và hình ảnh) qua stream bảo mật với header `inline`, song song với nội dung văn bản OCR.

### 1.6. Tìm kiếm CSDL Tối ưu hóa & Phân trang (Database Search)
- Truy vấn trực tiếp trên CSDL (`prisma.shipment` & `prisma.document`) có hỗ trợ phân trang (`page`, `limit`), **tuyệt đối không nạp toàn bộ dữ liệu vào RAM**.
- Tìm kiếm đồng thời qua Mã lô hàng (Job No), Vận đơn (B/L No), Tên file, Tiêu đề, và Snippet nội dung văn bản OCR.
- Tự động tích hợp bộ lọc phân quyền `PermissionService.buildShipmentWhereInput` và `buildDocumentWhereInput`, đảm bảo người dùng chỉ tìm thấy dữ liệu họ được phép xem.

### 1.7. Tầng Lưu trữ Trừu tượng (Storage Provider)
- Hỗ trợ 2 Driver lưu trữ độc lập:
  - `local`: Lưu trữ trên ổ cứng máy chủ VPS (thư mục `./storage_vault` an toàn).
  - `s3`: Lưu trữ đám mây đối tượng (AWS S3, Cloudflare R2, MinIO) hỗ trợ Presigned Upload URL.
- Khóa lưu trữ do server sinh ngẫu nhiên an toàn (`vault/YYYYMMDD/uuid.ext`), ngăn chặn triệt để lỗ hổng Path Traversal (`../`) và Null Byte Injection (`%00`).

### 1.8. An ninh Xác thực, Quản lý Phiên & Nhật ký Kiểm toán
- `JWT_SECRET` bắt buộc có độ dài tối thiểu 32 ký tự, loại bỏ hoàn toàn fallback bí mật mặc định.
- Quản lý phiên làm việc tập trung qua bảng `Session` trong CSDL, băm token SHA-256 an toàn.
- Cơ chế khóa tài khoản tạm thời (15 phút) sau 5 lần đăng nhập thất bại.
- Thông báo lỗi đăng nhập trung tính chống vét cạn danh sách tài khoản (User Enumeration).
- Thu hồi phiên tức thì (Revocation) khi đăng xuất hoặc đổi mật khẩu.
- Cookie phiên bảo mật HttpOnly, SameSite Strict, tự động bật cờ `secure: true` trên môi trường HTTPS.
- Ghi vết 100% nhật ký kiểm toán (`AuditLog`) cho mọi thao tác thêm, sửa, xóa, tải xuống và chia sẻ.

---

## 2. CÔNG NGHỆ SỬ DỤNG

| Thành phần | Công nghệ / Thư viện | Vai trò |
|---|---|---|
| **Framework** | Next.js 16.4.3 (App Router, Turbopack) | Kiến trúc ứng dụng Fullstack hiện đại |
| **Giao diện & UI** | React 19, Tailwind CSS, shadcn/ui, Lucide Icons | Giao diện quản trị logistics tiếng Việt chuẩn chỉ |
| **Soạn thảo** | Tiptap Starter Kit, Table, Underline, TextAlign | Trình soạn thảo văn bản HTML phong phú |
| **Cơ sở dữ liệu** | Prisma ORM 6.4.1 (SQLite cho Dev / PostgreSQL cho Production) | Tầng truy cập dữ liệu kiểu an toàn (Type-safe) |
| **Bảo mật & Mã hóa** | `jose`, `bcryptjs`, Node.js Crypto | JWT ES/HS256, mã hóa mật khẩu, SHA-256 |
| **Lưu trữ** | Local Storage Vault, AWS SDK for S3 (`@aws-sdk/client-s3`) | Quản lý lưu trữ file nhị phân đa nền tảng |
| **OCR Engine** | `pdf-parse` v2, Tesseract OCR | Trích xuất văn bản từ chứng từ scan |

---

## 3. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY HỆ THỐNG

### Bước 1: Cài đặt Dependencies
```bash
npm install
```

### Bước 2: Thiết lập Biến Môi trường (.env)
Sao chép file cấu hình mẫu `.env.example` thành `.env`:
```bash
# Trên Windows PowerShell:
Copy-Item .env.example .env

# Trên Linux/macOS:
cp .env.example .env
```

Mở file `.env` và kiểm tra các cấu hình:
```ini
# Cơ sở dữ liệu:
DATABASE_URL="file:./dev.db"

# Khóa bí mật JWT (BẮT BUỘC: Chuỗi ngẫu nhiên tối thiểu 32 ký tự)
JWT_SECRET="replace-with-a-secure-random-32-char-secret-key-for-jwt"
NEXTAUTH_SECRET="replace-with-a-secure-random-32-char-secret-key-for-session"

# Địa chỉ Web:
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Cấu hình Lưu trữ:
STORAGE_DRIVER="local"
STORAGE_LOCAL_PATH="./storage_vault"
```

> [!IMPORTANT]
> Biến `JWT_SECRET` bắt buộc phải có độ dài từ 32 ký tự trở lên. Nếu để trống hoặc ngắn hơn 32 ký tự, hệ thống sẽ từ chối khởi động để bảo vệ an toàn.

---

## 4. QUẢN LÝ CƠ SỞ DỮ LIỆU & NẠP DỮ LIỆU BAN ĐẦU

Hệ thống được trang bị công cụ tự động chuyển đổi cấu hình cơ sở dữ liệu (`scripts/ensure-db-provider.ts`):

### 4.1. Môi trường Development (SQLite)
```bash
# 1. Chuyển đổi Prisma Provider sang SQLite
npm run db:provider:sqlite

# 2. Cập nhật cấu trúc bảng
npx prisma db push
```

### 4.2. Môi trường Production (PostgreSQL)
```bash
# 1. Chuyển đổi Prisma Provider sang PostgreSQL
npm run db:provider:postgres

# 2. Thực thi Migration cho PostgreSQL
npx prisma migrate deploy
```

### 4.3. Nạp Dữ liệu Mẫu (Database Seeding)

Hệ thống phân định rạch ròi giữa 2 chế độ nạp dữ liệu:

#### 1. Chế độ Production (`npm run db:seed`)
- Chỉ tạo **duy nhất 1 tài khoản Quản trị viên tối cao** (`admin@tml.vn`).
- Tự động sinh mật khẩu ngẫu nhiên bảo mật cao (20 ký tự), in ra màn hình console **đúng 1 lần duy nhất** để quản trị viên lưu trữ.
- Đặt cờ `mustChangePassword: true`, bắt buộc quản trị viên đổi mật khẩu ngay lần đầu tiên đăng nhập.
- Không nạp bất kỳ tài khoản hoặc dữ liệu mẫu nhạy cảm nào vào CSDL vận hành thật.

```bash
npm run db:seed
```

#### 2. Chế độ Kiểm thử Tự động (`npm run db:seed:test`)
- Nạp đầy đủ cơ cấu tổ chức: Phòng ban (DOC, LOG, CUS, ACC, BOD), Vai trò, Chức vụ.
- Tạo bộ tài khoản kiểm thử tiêu chuẩn phục vụ các bài test tự động với mật khẩu `Tml@2026!`:
  - Quản trị viên: `admin@tml.vn`
  - Quản lý phòng ban: `ha.tran@tml.vn`
  - Nhân viên tác nghiệp: `lan.pham@tml.vn`

```bash
npm run db:seed:test
```

---

## 5. BỘ KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST SUITE)

Dự án sở hữu bộ kiểm thử tự động toàn diện gồm **15 test suites độc lập** kiểm tra từ mức hạ tầng, bảo mật phân quyền đến quy trình nghiệp vụ:

### 5.1. Chạy Toàn bộ Bộ Kiểm thử
```bash
npm test
```

### 5.2. Danh mục 15 Bộ Kiểm thử Chi tiết
| STT | Lệnh kiểm thử | Nội dung kiểm tra |
|:---:|---|---|
| 1 | `npm run test:enterprise` | Xác thực mật khẩu bcrypt, phân quyền RBAC & Explicit Deny |
| 2 | `npm run test:security` | Chống vét cạn, khóa tài khoản, session hash SHA-256 |
| 3 | `npm run test:business` | Quy trình liên kết lô hàng, chứng từ và bóc tách dữ liệu |
| 4 | `npm run test:acceptance` | Nghiệm thu tổng thể 10 tiêu chí an ninh & vận hành |
| 5 | `npm run test:task12` | Thẩm định kiểm toán an ninh bảo mật chuyên sâu |
| 6 | `npm run test:task13` | Kiểm tra Magic Bytes, chống Path Traversal, Null Byte |
| 7 | `npm run test:task14` | Kiểm thử thâm nhập 15 vector tấn công an ninh mạng |
| 8 | `npm run test:remediation` | Đối soát khắc phục các lỗ hổng bảo mật |
| 9 | `npm run test:storage` | Khởi tạo Storage Provider (Local & S3), Presigned URL |
| 10 | `npm run test:reliability` | Băm SHA-256, tải lên/tải xuống tệp tin, mô phỏng khởi động lại |
| 11 | `npm run test:permission` | Ma trận quyền hạn, kế thừa phòng ban và ngữ cảnh tài nguyên |
| 12 | `npm run test:settings` | Quản lý người dùng, phòng ban, đổi mật khẩu và thu hồi phiên |
| 13 | `npm run test:wizard` | Wizard tạo lô hàng 3 bước, kiểm tra MST, HS Code, checklist |
| 14 | `tsx tests/login-redirect.test.ts` | Khử loop redirect đăng nhập, cờ cookie bảo mật |
| 15 | `tsx tests/share-softdelete-search.test.ts` | Chặn tài liệu xóa mềm (404), stream file thật, tìm kiếm CSDL |

---

## 6. BIÊN DỊCH VÀ KHỞI CHẠY ỨNG DỤNG

### 6.1. Kiểm tra Kiểu Dữ liệu (TypeScript Type Check)
Dự án đã cấu hình `typescript.ignoreBuildErrors: false`, đảm bảo mã nguồn đạt chuẩn 100% không có lỗi type ẩn giấu:
```bash
npx tsc --noEmit
```

### 6.2. Biên dịch Bản Production
```bash
npm run build
```

### 6.3. Khởi chạy Ứng dụng
```bash
npm run start
```
Ứng dụng sẽ sẵn sàng phục vụ tại: `http://localhost:3000`.

---

## 7. LƯU Ý VẬN HÀNH THỰC TẾ

1. **Kiến trúc Rate Limiting & Session:** Hệ thống được thiết kế tối ưu với In-Memory Sliding Window Rate Limiting và Database Sessions trên bảng `Session`. Đây là kiến trúc chuẩn mực, vận hành ổn định trên môi trường máy chủ đơn (Single-Instance / VPS tiêu chuẩn) mà **không bắt buộc phải duy trì cụm Redis Cluster**.
2. **Quy tắc Bảo mật Git:** Các tập tin nhạy cảm sau đã được cấu hình trong `.gitignore` và tuyệt đối không đưa vào Git:
   - Các file môi trường (`.env`, `.env.local`, `.env.production`)
   - Tập tin CSDL SQLite (`*.db`, `*.db-journal`)
   - Kho lưu trữ tập tin nhị phân (`storage_vault/`)
   - Bản lưu trữ nén và sao lưu (`backups/`, `*.zip`)
3. **Chi tiết Triển khai Server:** Vui lòng tham khảo tài liệu [TML_DEPLOYMENT_GUIDE.md](file:///c:/Users/ACER/Downloads/tml-doc-manager-development/TML_DEPLOYMENT_GUIDE.md) để biết hướng dẫn từng bước triển khai trên Linux (Ubuntu), Nginx Reverse Proxy, SSL, cấu hình S3 Object Storage và sao lưu dự phòng thảm họa.
