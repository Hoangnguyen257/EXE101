# BÁO CÁO TOÀN DIỆN KHẮC PHỤC RỦI RO VÀ TỐI ƯU HỆ THỐNG SẢN XUẤT (TASK 13)
**Hệ thống:** TML – Text Mining Library (Logistics Document Management System)  
**Ngày thực hiện:** 01/11/2026  
**Chuyên gia thẩm định:** Senior Software Architect, Security Engineer & QA Lead  
**Trạng thái Kết luận:** `CONDITIONAL PRODUCTION READY` (Sẵn sàng Staging; Sẵn sàng Production có điều kiện hạ tầng)

---

## 1. TỔNG QUAN VÀ BẢNG PHÂN LOẠI NGHIỆM THU TASK 13

| Hạng mục Nhiệm vụ | Trạng thái | Tóm tắt Giải pháp và Bằng chứng Kiểm thử Thực tế |
| :--- | :---: | :--- |
| **13.1: User Enumeration & Lockout DoS** | `VERIFIED PASS` | Đồng nhất phản hồi lỗi (`UNIFIED_AUTH_ERROR_MESSAGE`), chống timing attack bằng dummy bcrypt, chặn IP xấu (429), hỗ trợ mở khóa `unlockUserAccount` |
| **13.2: Redis-backed Rate Limiter** | `PARTIALLY VERIFIED` | Kiến trúc Sliding Window ZSET Lua script + Fixed Window counter; Safe Fallback sang In-Memory hoạt động 100%; `NOT VERIFIED` cho cụm Redis vật lý (chưa có server) |
| **13.3: PostgreSQL Validation** | `PARTIALLY VERIFIED` | Rà soát 31 models; tạo `schema.postgresql.prisma` và `migration.sql` DDL hoàn chỉnh; `NOT VERIFIED` cho runtime PostgreSQL (chưa có server psql trên host) |
| **13.4: Server-side OCR & Worker** | `VERIFIED PASS` | Hàm `detectPdfType` phân định chính xác PDF text layer vs scan ảnh; `OCRWorkerService` quản lý trạng thái PENDING -> COMPLETED, retry exponential backoff |
| **13.5: Search Scalability** | `VERIFIED PASS` | `IndexedSearchEngine` Inverted Index giảm P50 từ 470ms xuống 73ms (10k docs) và từ 4,455ms xuống 940ms (100k docs); Data Isolation đạt 100% |
| **13.6: Share Link Lifecycle & Concurrency** | `VERIFIED PASS` | Atomic `updateMany` loại bỏ hoàn toàn race condition vượt `maxViews`; `cleanupExpiredShareLinks` tự động thu hồi link quá hạn và bảo toàn 100% Audit Trail |
| **13.7: File Upload Hardening** | `VERIFIED PASS` | `validateComprehensiveUpload` kết hợp 3 lớp: Magic Bytes nhị phân + MIME + Extension; chặn PDF thiếu `%%EOF`, chặn PDF chứa `/Launch` hoặc `/JavaScript` |
| **Toàn bộ Test Suite Tự động** | `VERIFIED PASS` | 209 / 209 automated tests vượt qua 100% (0 failed) |
| **TypeScript Typecheck** | `VERIFIED PASS` | `npx tsc --noEmit` hoàn thành với 0 lỗi |
| **Next.js Production Build** | `VERIFIED PASS` | `next build` hoàn tất tối ưu trong 5.4s trên toàn bộ 39 routes |

---

## 2. CHI TIẾT CÁC HẠNG MỤC ĐÃ XỬ LÝ (TASK 13.1 - 13.7)

### 2.1. TASK 13.1 – Khắc phục User Enumeration & Account Lockout DoS
* **Vấn đề cũ (Task 12):** Thông báo lỗi lần thứ 5 tiết lộ tài khoản có thật (`bị tạm khóa 15 phút`) so với tài khoản không tồn tại (`Email hoặc mật khẩu không chính xác`). Sự chênh lệch thời gian xử lý bcrypt (~80ms vs ~1ms) tạo timing side-channel.
* **Giải pháp khắc phục:**
  1. **Đồng nhất thông báo:** Tất cả lỗi xác thực tại API trả về chuỗi duy nhất:
     `"Email hoặc mật khẩu không chính xác, hoặc tài khoản đang tạm thời bị hạn chế truy cập."` (HTTP 401).
  2. **Triệt tiêu Timing Side-Channel:** Nếu email không tồn tại trong CSDL, hệ thống tự động so khớp mật khẩu gửi lên với mã băm giả lập `DUMMY_BCRYPT_HASH` để đảm bảo thời gian phản hồi đồng nhất ~80ms.
  3. **Giới hạn tần suất IP nguồn:** IP gửi sai quá 10 lần liên tiếp bị chặn tức thời với mã HTTP 429 (`isIpBlocked: true`).
  4. **Phục hồi tài khoản:** Bổ sung hàm quản trị `unlockUserAccount(userId)` cho phép mở khóa ngay lập tức mà không cần chờ hết 15 phút.

### 2.2. TASK 13.2 – Redis-backed Rate Limiter & Cơ chế Safe Fallback
* **Vấn đề cũ:** In-memory Map chỉ hiệu quả trên single-instance; cụm multi-instance cần bộ đếm phân tán.
* **Giải pháp khắc phục:**
  1. Triển khai `lib/security/redis-rate-limit.ts` với 2 thuật toán độc lập:
     * **Sliding Window:** Sử dụng Redis Sorted Set (ZSET) với microsecond score và atomic Lua Script (`SLIDING_WINDOW_LUA_SCRIPT`).
     * **Fixed Window:** Sử dụng atomic `INCR` và `EXPIRE` (`FIXED_WINDOW_LUA_SCRIPT`).
  2. **Safe Fallback Policy:** Khi Redis server không khả dụng, mất kết nối hoặc timeout, bộ điều phối tự động fallback sang In-Memory Limiter mà không làm gián đoạn hệ thống và không bao giờ fail-open.

### 2.3. TASK 13.3 – Thẩm tra Tương thích PostgreSQL
* **Hiện trạng môi trường:** Máy chủ host hiện tại chưa cài đặt PostgreSQL daemon hoặc Docker container.
* **Công việc đã hoàn thành:**
  1. Rà soát toàn bộ 31 Prisma models.
  2. Tạo file cấu hình `prisma/schema.postgresql.prisma` chuẩn hóa cho PostgreSQL.
  3. Xuất bản migration script DDL hoàn chỉnh: `prisma/migrations_postgresql/20261101_init/migration.sql` định nghĩa 31 bảng dữ liệu, khóa chính, chỉ mục Unique và khóa ngoại kèm `ON DELETE CASCADE`.
  4. Trạng thái phân loại: `PARTIALLY VERIFIED (ARCHITECTURAL & DDL VERIFIED; RUNTIME PENDING POSTGRESQL INSTANCE)`.

### 2.4. TASK 13.4 – Server-side OCR cho Scanned PDF & Background Worker
* **Giải pháp khắc phục:**
  1. Xây dựng hàm `detectPdfType(buffer)` trong `lib/ocr/ocr-extractor.ts`:
     * Phân định chính xác giữa PDF có text layer nhị phân (`hasTextLayer: true`) và PDF scan thuần ảnh (`isScannedImage: true`).
     * Quét và ngăn chặn các file PDF chứa payload độc hại (`/JavaScript`, `/Launch`, `/EmbeddedFiles`).
  2. Xây dựng `lib/ocr/ocr-worker.ts`:
     * Quản lý trạng thái công việc: `PENDING` -> `PROCESSING` -> `COMPLETED` / `FAILED`.
     * Cơ chế retry thông minh với **Exponential Backoff** (tối đa 3 lần).
     * Thiết lập rào chắn an toàn: Giới hạn tối đa 20 trang, 25MB và timeout 45 giây.
     * Chống xử lý trùng lặp (Deduplication Check) thông qua mã băm SHA-256.

### 2.5. TASK 13.5 – Tối ưu Khả năng Mở rộng Tìm kiếm (Search Scalability)
* **Kết quả đo đạc thực tế:**
  * **1,000 docs:** P50 giảm từ 32.5ms xuống **12.4ms** (Trung bình: **19.6ms**).
  * **10,000 docs:** P50 giảm từ 470.3ms xuống **73.0ms** (Nhanh hơn 6.4 lần).
  * **100,000 docs:** P50 giảm từ 4,455.4ms xuống **940.6ms** (Đưa thời gian median xuống dưới 1 giây).
  * **Data Isolation:** Duy trì độ cách ly 100% giữa các phòng ban.

### 2.6. TASK 13.6 – Vòng đời Link Chia sẻ & Xử lý Tranh chấp Đồng thời (Concurrency)
* **Khắc phục Race Condition:** Sử dụng atomic conditional update `updateMany` với điều kiện `viewCount: { lt: maxViews }`. Khi nhiều request đồng thời chạm ngưỡng, đúng số lượng `maxViews` được cấp quyền tải, các request vượt ngưỡng bị từ chối 403 ngay lập tức.
* **Tiến trình dọn dẹp định kỳ:** Xây dựng `cleanupExpiredShareLinks()` trong `lib/security/share-cleanup.ts` tự động đánh dấu `isRevoked: true` cho link hết hạn hoặc hết lượt xem, đồng thời ghi vết kiểm toán vào `AuditLog` mà không xóa dữ liệu lịch sử.

### 2.7. TASK 13.7 – Gia cố Toàn diện Đường ống Tải file (File Upload Hardening)
* **Giải pháp đa lớp (`validateComprehensiveUpload`):**
  1. Kiểm tra Magic Bytes nhị phân khớp với định dạng thực tế.
  2. Kiểm tra phần mở rộng (.pdf, .jpg, .png).
  3. Kiểm tra tính toàn vẹn cấu trúc PDF: Bắt buộc có dấu kết thúc `%%EOF` tiêu chuẩn trong 2048 bytes cuối.
  4. Triệt tiêu tập tin độc hại: Chặn đứng các file PDF chứa lệnh thực thi `/Launch` hoặc mã nhúng `/JavaScript`.
  5. Sanitize tên file chống Path Traversal (`../`, `..\`, null byte).

