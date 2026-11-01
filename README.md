# TML LOGISTICS - TEXT MINING & DOCUMENT MANAGEMENT SYSTEM

Hệ thống quản lý, phân loại, bóc tách OCR và chia sẻ chứng từ vận tải logistics thông minh (Text Mining Library / DocManager).

## 1. Tính năng cốt lõi

- **Quản lý chứng từ & Hồ sơ lô hàng:** Quản lý vòng đời chứng từ logistics (B/L, Invoice, Packing List, C/O, Booking, D/O, Tờ khai hải quan), theo dõi tiến độ đầy đủ theo từng lô hàng xuất/nhập khẩu.
- **Bóc tách văn bản OCR tự động:** Tích hợp nhận dạng ký tự quang học đa ngôn ngữ (Việt - Anh) và trích xuất cấu trúc dữ liệu tự động.
- **Phân quyền 3 lớp (Enterprise RBAC + ABAC):** Kết hợp chặt chẽ giữa Vai trò (Role), Phòng ban (Department-Based Access Control) và Ngữ cảnh tài nguyên (Resource-Level Scope) với cơ chế Explicit Deny ưu tiên.
- **Chia sẻ chứng từ bảo mật đa cấp:**
  - *Nội bộ:* Phân định quyền xem (VIEW), tải xuống (DOWNLOAD) và chỉnh sửa (EDIT).
  - *Bên ngoài:* Tạo liên kết mã hóa 192-bit cryptographic entropy, bảo vệ bằng mật khẩu bcrypt, cấp Share Access Token có thời hạn, chống vét cạn bằng Rate Limiter và kiểm soát số lượt mở tối đa.
- **Đồng bộ hóa thời gian thực (SSE):** Server-Sent Events tự động cập nhật trạng thái với tính năng cách ly dữ liệu phòng ban (Data Isolation) và con trỏ sự kiện chống trùng lặp.
- **Nhật ký kiểm toán toàn diện (Audit Log):** Ghi vết 100% các hành động tải lên, xem, tải xuống, chia sẻ, chỉnh sửa, xóa và thay đổi quyền hạn.

## 2. Công nghệ sử dụng

- **Frontend & Backend Framework:** Next.js 16.4.3 (App Router, Turbopack, React 19).
- **Styling & Giao diện:** Tailwind CSS, Lucide Icons, Shadcn/UI.
- **Cơ sở dữ liệu & ORM:** Prisma 6.4.1 (Hỗ trợ SQLite cho máy tính cá nhân và PostgreSQL cho hệ thống phân tán).
- **Bảo mật & Mã hóa:** `jose` (JWT ES/HS256), `bcryptjs`, Node.js Crypto (SHA-256 token hashing).

## 3. Hướng dẫn cài đặt & Khởi chạy

### Bước 1: Cài đặt thư viện phụ thuộc
```bash
npm install
```

### Bước 2: Cấu hình tệp môi trường
Sao chép tệp mẫu cấu hình và thiết lập khóa bí mật JWT:
```bash
copy .env.example .env
```
Thiết lập `JWT_SECRET` trong tệp `.env` có độ dài tối thiểu 32 ký tự.

### Bước 3: Đồng bộ cơ sở dữ liệu và nạp dữ liệu mẫu
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### Bước 4: Chạy kiểm thử tự động
```bash
# Kiểm thử an ninh bảo mật và phân quyền (34 bài kiểm thử)
npx tsx tests/security-audit-refactor.test.ts

# Kiểm thử hệ thống tổng quát (13 bài kiểm thử)
npx tsx tests/enterprise-system.test.ts
```

### Bước 5: Biên dịch và chạy ứng dụng
```bash
# Kiểm tra TypeScript
npx tsc --noEmit

# Biên dịch Production
npm run build

# Khởi chạy ứng dụng
npm run start
```
Ứng dụng sẽ hoạt động tại địa chỉ: `http://localhost:3000`.

## 4. Tài khoản kiểm thử mặc định

| Email | Mật khẩu | Vai trò | Phòng ban |
|---|---|---|---|
| `admin@tml.vn` | `Tml@2026!` | ADMIN (Quản trị viên) | Ban Giám Đốc |
| `ha.tran@tml.vn` | `Tml@2026!` | MANAGER (Trưởng phòng) | Phòng Chứng từ (DOC) |
| `lan.pham@tml.vn` | `Tml@2026!` | STAFF (Nhân viên) | Phòng Chứng từ (DOC) |

## 5. Tài liệu kỹ thuật chi tiết
Vui lòng tham khảo tệp `TML_SECURITY_AUDIT_AND_REFACTOR_REPORT.md` để xem chi tiết toàn bộ quá trình kiểm toán, phân tích 12 lỗ hổng bảo mật, ma trận phân quyền và bằng chứng thực thi kiểm thử.

