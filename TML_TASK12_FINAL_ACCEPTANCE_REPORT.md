# BÁO CÁO NGHIỆM THU ĐỘC LẬP CUỐI CÙNG & ĐÁNH GIÁ MỨC ĐỘ SẴN SÀNG PRODUCTION (TASK 12)
**Hệ thống:** TML – Text Mining Library (Logistics Document Management System)  
**Ngày thực hiện:** 01/11/2026  
**Chuyên gia thẩm định:** Senior Software Architect, Security Auditor & QA Lead  
**Phương pháp:** Kiểm toán độc lập trực tiếp trên mã nguồn, cơ sở dữ liệu và môi trường runtime thực tế.

---

## 1. TỔNG QUAN VÀ KẾT LUẬN NGHIỆM THU (EXECUTIVE SUMMARY)

Sau quá trình rà soát, đo kiểm thực tế trên mã nguồn, thực thi 181 bài automated tests, đo benchmark thuật toán tìm kiếm trên 100,000 văn bản và kiểm tra chi tiết các lớp phòng thủ an ninh thông tin, Hội đồng Kiểm toán Kỹ thuật đưa ra kết luận nghiệm thu chính thức:

### 🎯 TRẠNG THÁI NGHIỆM THU HỆ THỐNG:
- **MÔI TRƯỜNG HIỆN TẠI (LOCAL / STAGING):** `STAGING READY`
- **MÔI TRƯỜNG SẢN XUẤT (PRODUCTION READINESS):** `CONDITIONAL - PENDING INFRASTRUCTURE PREREQUISITES`
  - Cơ sở dữ liệu: `NOT VERIFIED (NO POSTGRESQL SERVER AVAILABLE IN ENVIRONMENT)`
  - Tải cụm phân tán (Cluster): `REQUIRES REDIS FOR DISTRIBUTED RATE LIMITING`
  - Quy mô tìm kiếm > 10,000 văn bản: `REQUIRES DATABASE FULL-TEXT SEARCH (GIN/TSVECTOR)`

---

## 2. MA TRẬN PHÂN LOẠI TRẠNG THÁI HỆ THỐNG THEO TIÊU CHUẨN TASK 12

| Phân hệ / Tiêu chí | Trạng thái Nghiệm thu | Bằng chứng kiểm tra thực tế |
| :--- | :---: | :--- |
| **SEC-01: Thu hồi phiên & JWT Exp** | `VERIFIED PASS` | DB session check lập tức vô hiệu hóa token; JWT exp từ chối token quá hạn |
| **SEC-02: Public Share Links Security** | `VERIFIED PASS` | Chữ ký HMAC-SHA256 phát hiện sửa đổi payload; từ chối token hết hạn |
| **SEC-03: Storage Vault & Magic Bytes** | `VERIFIED PASS` | Nhận diện chữ ký nhị phân PDF, PNG, JPG; chặn file .exe giả mạo; triệt tiêu Path Traversal |
| **SEC-04 + SEC-05: Brute Force & Enumeration** | `PARTIALLY VERIFIED` | Khóa tài khoản sau 5 lần nhập sai hoạt động 100%. Tuy nhiên, thông báo lỗi thứ 5 tạo side-channel tiết lộ tài khoản tồn tại |
| **SEC-06: Production Cookie Security** | `VERIFIED PASS` | Cờ `HttpOnly: true`, `SameSite: 'lax'`, `Path: '/'`, `Secure` tự động kích hoạt khi `NODE_ENV=production` |
| **SEC-07: CSRF Defense on APIs** | `VERIFIED PASS` | Chặn triệt để mutating requests có Origin/Referer giả mạo hoặc từ domain bên ngoài |
| **SEC-08: Rate Limiting Architecture** | `PARTIALLY VERIFIED` | In-memory sliding window hoạt động chuẩn trên single-instance; cụm load balancing cần Redis |
| **SEC-09: Document RBAC & Cross-Tenant** | `VERIFIED PASS` | 100% cách ly tổ chức và phòng ban; Staff bị từ chối duyệt/xóa/chia sẻ |
| **Kiểm thử PostgreSQL thực tế** | `NOT VERIFIED` | Không có PostgreSQL daemon/server hay Docker trên máy chủ kiểm thử (`Test-NetConnection 5432` thất bại) |
| **OCR Logistics Trích xuất B/L, Cont, Job** | `VERIFIED PASS` | Trích xuất thành công 8/8 nhóm chứng từ logistics chuẩn (Regex + PDF Layer) |
| **Server OCR cho Scanned PDF thuần ảnh** | `PARTIALLY VERIFIED` | Tesseract.js v7.0.0 chạy tốt trên Client; Server thiếu headless rasterizer cho PDF thuần ảnh upload thẳng API |
| **Hiệu năng Tìm kiếm (1k - 100k docs)** | `VERIFIED PASS` | 1k docs: 36.4ms; 10k docs: 487.9ms; 100k docs: 4,524.9ms; Data Isolation đạt 100% |
| **Toàn bộ Test Suite tự động (181 tests)** | `VERIFIED PASS` | 181/181 automated tests vượt qua 100% (0 failed) |
| **TypeScript Typecheck** | `VERIFIED PASS` | `npx tsc --noEmit` hoàn thành với 0 lỗi |
| **Next.js Production Build** | `VERIFIED PASS` | `next build` hoàn tất tối ưu trong 3.6s trên toàn bộ 39 routes |

---

## 3. ĐỐI SOÁT VÀ TÁI THẨM ĐỊNH CHI TIẾT SEC-01 ĐẾN SEC-12

### SEC-01: Session Lifecycle & Thu hồi phiên tức thời
- **Cơ chế triển khai:** Kết hợp JWT Stateless với Stateful Database Session (`Session` model trong Prisma).
- **Hành vi thực tế:** Khi người dùng logout hoặc Admin gọi `revokeUserSessions(userId)`, cờ `isRevoked: true` và `revokedAt` được cập nhật trong DB. Mọi request tiếp theo mang token cũ đều bị `getSessionUser()` từ chối ngay lập tức mà không cần đợi JWT hết hạn tự nhiên.
- **Kết quả kiểm thử:** `VERIFIED PASS` (3/3 test assertions pass).

### SEC-02: Bảo mật Public Share Links & Toàn vẹn Payload
- **Cơ chế triển khai:** Link chia sẻ sử dụng HMAC-SHA256 token độc lập (`signShareAccessToken`), khóa cứng với `shareId` và thời gian hiệu lực ngắn hạn.
- **Hành vi thực tế:** Kiểm thử can thiệp trực tiếp vào payload (thay đổi `shareId` hoặc giả lập quyền cao hơn) khiến chữ ký mật mã không khớp, hệ thống từ chối xác thực. Token hết hạn bị loại bỏ tự động.
- **Kết quả kiểm thử:** `VERIFIED PASS` (3/3 test assertions pass).

### SEC-03: Storage Vault Isolation, Path Traversal & Magic Bytes
- **Cơ chế triển khai:** File được lưu trữ tại `storage_vault/` độc lập với thư mục web public. Tên file được sanitize thông qua `sanitizeFileName()` loại bỏ toàn bộ `..`, `/`, `\`, null bytes `\x00` và ký tự điều khiển.
- **Magic Bytes Validation:** Hàm `validateFileMagicBytes()` đọc trực tiếp các byte đầu của nhị phân:
  - PDF: Kiểm tra chữ ký `%PDF-` (`0x25 0x50 0x44 0x46`).
  - PNG: Kiểm tra chữ ký `\x89PNG\r\n\x1a\n` (`0x89 0x50 0x4E 0x47`).
  - JPEG: Kiểm tra chữ ký `0xFF 0xD8 0xFF`.
  - File giả mạo: File thực thi Windows PE (Header `MZ` / `0x4D 0x5A`) đổi đuôi thành `.pdf` bị phát hiện và từ chối 100%. File PNG đổi đuôi thành `.pdf` bị chặn vì MIME type không khớp chữ ký nhị phân.
- **Kết quả kiểm thử:** `VERIFIED PASS` (6/6 test assertions pass).

### SEC-04 + SEC-05: Account Lockout & Lỗ hổng User Enumeration qua Phản hồi Khóa tài khoản
- **Cơ chế triển khai:** Ghi nhận `failedAttempts` và `lockedUntil` trên database. Sau 5 lần nhập sai, tài khoản bị tạm khóa 15 phút.
- **Phân tích Thực tế & Lỗ hổng Side-Channel:**
  - Khi thử đăng nhập 5 lần bằng **email không tồn tại** (`ghost@tml.vn`): Lần 1 đến lần 5 đều trả về:  
    `401 Unauthorized` - `"Email hoặc mật khẩu không chính xác."`
  - Khi thử đăng nhập 5 lần bằng **email có tồn tại** (`lan.pham@tml.vn`): Lần 1 đến 4 trả về `"Email hoặc mật khẩu không chính xác."`, nhưng đến lần 5 trả về:  
    `423 Locked` - `"Bạn đã nhập sai quá 5 lần. Tài khoản bị tạm khóa 15 phút."`
  - **Hệ quả An ninh:** Kẻ tấn công có thể lợi dụng sự khác biệt phản hồi ở lần thứ 5 để **dò quét danh sách email nhân viên hợp lệ (User Enumeration)** và thực hiện **Denial of Service (Account Lockout DoS)** đối với tài khoản nhân viên thật mà không cần biết mật khẩu.
- **Khuyến nghị khắc phục:**
  1. Đồng nhất thông báo lỗi: Trả về thông điệp chung ở mọi trường hợp: `"Thông tin đăng nhập không hợp lệ hoặc tài khoản đang tạm thời bị hạn chế truy cập."`
  2. Bổ sung Rate Limiting theo địa chỉ IP nguồn: Chặn IP sau 10 lần request thất bại bất kể email có tồn tại hay không.
- **Kết quả kiểm thử:** `PARTIALLY VERIFIED` (Cơ chế khóa hoạt động chính xác; tồn tại rủi ro User Enumeration Side-Channel).

### SEC-06: Thuộc tính Bảo mật của Session Cookie
- **Cấu hình kiểm tra:** `app/api/auth/login/route.ts` và `lib/auth/auth-service.ts`.
- **Thông số kỹ thuật:**
  - `httpOnly: true` (Ngăn chặn JavaScript/XSS đọc cookie).
  - `sameSite: 'lax'` (Ngăn chặn CSRF truyền chéo tên miền khi duyệt web).
  - `path: '/'` (Phạm vi cookie toàn hệ thống).
  - `maxAge: 8 * 60 * 60` (8 giờ làm việc).
  - `secure: process.env.NODE_ENV === 'production'` (Bắt buộc HTTPS trên môi trường sản xuất).
- **Kết quả kiểm thử:** `VERIFIED PASS` (5/5 test assertions pass).

### SEC-07: Chống tấn công CSRF trên các API Đột biến (Mutating APIs)
- **Cơ chế triển khai:** Hàm `validateCsrf()` kiểm tra các yêu cầu `POST`, `PUT`, `DELETE`, `PATCH`.
- **Hành vi thực tế:** Các request an toàn (`GET`, `HEAD`, `OPTIONS`) được phép đi qua. Các request mang header `Origin` hoặc `Referer` không thuộc host cấu hình (hoặc từ domain độc hại `https://attacker-phishing-site.com`) bị lập tức chặn với mã `403 Forbidden`.
- **Kết quả kiểm thử:** `VERIFIED PASS` (4/4 test assertions pass).

### SEC-08: Giới hạn Tần suất (Rate Limiting) & Khả năng Chịu tải Phân tán
- **Cơ chế triển khai:** Sliding window in-memory limiter tại `lib/security/rate-limit.ts`.
- **Hành vi thực tế:** Chặn chính xác các request vượt quá ngưỡng cấu hình (ví dụ 60 request/phút hoặc 5 lần đăng nhập sai/15 phút).
- **Rủi ro Kiến trúc Cụm (Multi-Instance Cluster):** Bộ nhớ in-memory Map độc lập trên từng container/process Node.js. Khi chạy sau Load Balancer gồm N containers, kẻ tấn công có thể gửi gấp N lần số request trước khi bị khóa. Môi trường Production cụm bắt buộc phải tích hợp **Redis-backed Rate Limiter**.
- **Kết quả kiểm thử:** `PARTIALLY VERIFIED` (Hoạt động tốt trên Single-Instance; Chưa hỗ trợ Multi-Instance Cluster).

### SEC-09: Ma trận Phân quyền & Cách ly Dữ liệu (Negative Testing)
- **Kiểm tra Phân quyền Chặt chẽ:**
  - Staff cố gắng phê duyệt chứng từ (`APPROVE`) ➔ `BỊ TỪ CHỐI (allowed: false)`
  - Staff cố gắng xóa chứng từ (`DELETE`) ➔ `BỊ TỪ CHỐI (allowed: false)`
  - Staff cố gắng chia sẻ tài liệu ra ngoài (`SHARE`) ➔ `BỊ TỪ CHỐI (allowed: false)`
  - Admin thực hiện phê duyệt và xóa ➔ `THÀNH CÔNG (allowed: true)`
  - Tài khoản thuộc tổ chức đối thủ (Cross-Tenant) truy cập ➔ `BỊ TỪ CHỐI 100% (allowed: false)`
- **Kết quả kiểm thử:** `VERIFIED PASS` (5/5 test assertions pass).

---

## 4. BÁO CÁO KIỂM TOÁN CƠ SỞ DỮ LIỆU & POSTGRESQL STATUS

### Tình trạng Môi trường Thực tế:
- **Provider Đang Hoạt động:** SQLite (`file:./dev.db`).
- **Prisma Schema:** `prisma/schema.prisma` định nghĩa **31 Models** đầy đủ quan hệ, khóa ngoại, chỉ mục index và cascade rule.
- **Rà soát PostgreSQL trên Máy chủ:**
  - Lệnh `Get-Command psql`: Không tìm thấy binary psql.
  - Lệnh `Get-Service *postgres*`: Không có PostgreSQL Windows Service nào được cài đặt.
  - Lệnh `docker`, `podman`: Không tìm thấy Docker daemon.
  - Kiểm tra cổng mạng: `Test-NetConnection -Port 5432 -ComputerName 127.0.0.1` ➔ `TcpTestSucceeded: False`.
- **KẾT LUẬN CHÍNH THỨC:**
  `NOT VERIFIED (NO POSTGRESQL SERVER AVAILABLE IN ENVIRONMENT)`  
  *Tuyệt đối không công bố tương thích 100% khi chưa thực thi migration và kiểm thử transaction/foreign key trên instance PostgreSQL vật lý.*

---

## 5. BÁO CÁO THỰC THI OCR VÀ TRÍCH XUẤT CHỨNG TỪ LOGISTICS

### Phân định Rõ ràng giữa 2 Cơ chế OCR trong Hệ thống:
1. **Client-side OCR (`components/scan/ocr-content.tsx`):**
   - Sử dụng thư viện **Tesseract.js v7.0.0** chạy WebAssembly trong trình duyệt.
   - Chuyên trách nhận diện ký tự từ ảnh raster (JPG, PNG, WebP) hoặc trang PDF được vẽ ra HTML5 `<canvas>`.
   - Hỗ trợ ngôn ngữ tiếng Anh và tiếng Việt (`vie+eng`).
2. **Server-side Extraction (`lib/ocr/ocr-extractor.ts`):**
   - Đọc trực tiếp PDF Text Layer từ nhị phân file được upload lên máy chủ.
   - Sử dụng Regular Expressions và Heuristics để bóc tách các trường nghiệp vụ logistics: Số B/L, Số Container, Số Invoice, Cảng xếp/dỡ (POL/POD), Tên tàu, Số chuyến, Số Job.
3. **Giới hạn Kỹ thuật Cần Ghi nhận:**
   - Nếu người dùng upload một file PDF dạng ảnh scan thuần túy (không có text layer nhị phân) trực tiếp qua REST API (không thông qua giao diện quét Client), máy chủ hiện tại **chưa có headless rasterizer** (như `pdf2pic` hoặc `pdftoppm`) để biến PDF thành ảnh trước khi OCR.
   - Đây là điểm cần bổ sung Worker Service xử lý OCR nền trong lộ trình nâng cấp Production.

---

## 6. KẾT QUẢ BENCHMARK HIỆU NĂNG TÌM KIẾM (1,000 - 100,000 DOCUMENTS)

Kiểm thử được thực hiện bằng script thực tế [`tests/benchmark-search.ts`](file:///c:/Users/ACER/Downloads/tml-doc-manager-development/tests/benchmark-search.ts) trên thuật toán tìm kiếm thông minh kết hợp **Vietnamese NFD Normalization** và **Levenshtein Distance** trên các trường dữ liệu logistics (B/L, Job No, Khách hàng, Tên file, Nội dung OCR):

```
================================================================================
TỔNG HỢP KẾT QUẢ BENCHMARK HIỆU NĂNG TÌM KIẾM THỰC TẾ:
================================================================================
| Quy mô Dữ liệu | Min (ms) | P50 (ms) | Average (ms) | P95 (ms) | P99 (ms) | Max (ms) | Data Isolation |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1,000 docs** | 9.206 ms | 32.478 ms | **36.454 ms** | 69.437 ms | 101.806 ms | 101.806 ms | **VERIFIED PASS** |
| **10,000 docs** | 229.074 ms | 470.311 ms | **487.954 ms** | 773.380 ms | 880.352 ms | 880.352 ms | **VERIFIED PASS** |
| **100,000 docs** | 2,552.567 ms | 4,455.409 ms | **4,524.915 ms** | 7,137.068 ms | 7,137.068 ms | 7,137.068 ms | **VERIFIED PASS** |
================================================================================
```

### Nhận xét & Đánh giá Kiến trúc:
- **Dưới 10,000 văn bản:** Hiệu năng đạt mức xuất sắc (< 500ms), đáp ứng tốt trải nghiệm người dùng tìm kiếm tương tác tức thời (Interactive Search).
- **Ở mức 100,000 văn bản:** Do thuật toán quét tuyến tính (Linear Scan) toàn bộ tập dữ liệu trong RAM và tính khoảng cách Levenshtein trên từng từ, thời gian phản hồi tăng lên trung bình **4.5 giây** (P95 đạt 7.1 giây).
- **Khuyến nghị Production:** Với kho dữ liệu doanh nghiệp vượt quá 50,000 chứng từ, kiến trúc tìm kiếm cần chuyển dịch sang **PostgreSQL Full-Text Search (với chỉ mục GIN và pg_trgm)** hoặc tích hợp **Elasticsearch / Meilisearch** để đảm bảo P99 luôn dưới 100ms.
- **Tính Cách ly Dữ liệu (Data Isolation):** Ở cả 3 mốc dữ liệu, chỉ mục tìm kiếm sau khi áp bộ lọc phòng ban hoàn toàn không để rò rỉ bất kỳ chứng từ nào của phòng ban khác (`VERIFIED PASS`).

---

## 7. BẢNG TỔNG KẾT BỘ KIỂM THỬ TỰ ĐỘNG (181 TESTS)

```
================================================================================
BỘ KIỂM THỬ TỰ ĐỘNG DỰ ÁN TML LOGISTICS (NPM TEST):
================================================================================
1. tests/enterprise-system.test.ts          : 13 / 13 PASSED (100%)
2. tests/security-audit-refactor.test.ts     : 34 / 34 PASSED (100%)
3. tests/business-integration.test.ts        : 33 / 33 PASSED (100%)
4. tests/task10-comprehensive-acceptance.test.ts : 68 / 68 PASSED (100%)
5. tests/task12-security-verification.test.ts: 33 / 33 PASSED (100%)
--------------------------------------------------------------------------------
TỔNG CỘNG:                                  181 / 181 TESTS PASSED (0 FAILED)
================================================================================
```

---

## 8. KẾT LUẬN VÀ BÀN GIAO MÃ NGUỒN

1. Mã nguồn dự án đạt chất lượng cao, cấu trúc thư mục rõ ràng theo chuẩn Next.js App Router, hệ thống phân quyền đa lớp vững chắc, toàn bộ 39 API routes và trang giao diện đều biên dịch thành công.
2. Hồ sơ nghiệm thu kỹ thuật bao gồm 3 tài liệu độc lập:
   - [`TML_TASK12_FINAL_ACCEPTANCE_REPORT.md`](file:///c:/Users/ACER/Downloads/tml-doc-manager-development/TML_TASK12_FINAL_ACCEPTANCE_REPORT.md): Báo cáo tổng thể và kết quả nghiệm thu.
   - [`TML_TASK12_TEST_EVIDENCE.md`](file:///c:/Users/ACER/Downloads/tml-doc-manager-development/TML_TASK12_TEST_EVIDENCE.md): Nhật ký bằng chứng thực thi chi tiết.
   - [`TML_TASK12_REMAINING_RISKS.md`](file:///c:/Users/ACER/Downloads/tml-doc-manager-development/TML_TASK12_REMAINING_RISKS.md): Danh mục rủi ro kỹ thuật còn tồn đọng và phương án khắc phục trước khi Go-Live.
3. Gói bàn giao mã nguồn hoàn chỉnh đã được cập nhật tại file:
   - [`tml-production-handover.zip`](file:///c:/Users/ACER/Downloads/tml-doc-manager-development/tml-production-handover.zip)

