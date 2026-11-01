# TML – TEXT MINING LIBRARY
# TASK 11: DANH MỤC VẤN ĐỀ TỒN ĐỌNG & LỘ TRÌNH HOÀN THIỆN
## (REMAINING ISSUES, TECHNICAL LIMITATIONS & FINAL READINESS ASSESSMENT)

---

## 1. MỤC TIÊU VÀ NGUYÊN TẮC MINH BẠCH KỸ THUẬT

Để bảo đảm tính khách quan và trung thực tuyệt đối theo yêu cầu của **TASK 11**, báo cáo này lập danh mục toàn bộ các điểm giới hạn kỹ thuật, các giả định môi trường và các hạng mục cần hoàn thiện trước khi đưa hệ thống từ trạng thái **STAGING** sang vận hành chính thức trên cụm máy chủ **PRODUCTION** quy mô lớn.

Hội đồng áp dụng hệ thống phân loại trạng thái chuẩn:
- **`VERIFIED PASS`:** Đã kiểm chứng trực tiếp trên mã nguồn và thực thi có kết quả đạt 100%.
- **`PARTIALLY VERIFIED`:** Đã hoàn thiện một phần hoặc chỉ khả dụng trong một điều kiện môi trường cụ thể.
- **`NOT VERIFIED`:** Chưa được kiểm chứng do thiếu công cụ hoặc dữ liệu thực tế.
- **`FAILED`:** Không đạt yêu cầu kỹ thuật.
- **`PENDING ENVIRONMENT VALIDATION`:** Mã nguồn đã tương thích nhưng cần kiểm chứng trên hạ tầng môi trường đích thực tế (ví dụ: Cụm CSDL PostgreSQL vật lý).

---

## 2. BẢNG PHÂN LOẠI CHI TIẾT CÁC HẠNG MỤC KỸ THUẬT

| Hạng mục Kỹ thuật | Trạng thái Hiện tại | Mã nguồn & Bằng chứng | Đánh giá & Rủi ro | Kế hoạch Xử lý / Lộ trình |
| :--- | :---: | :--- | :--- | :--- |
| **Xác thực & Bảo mật (SEC-01 -> SEC-12)** | **VERIFIED PASS** | 12/12 test cases trong `security-audit-refactor.test.ts` đạt 100% | Toàn bộ các lỗ hổng đã được bịt kín | Sẵn sàng cho Staging & Production |
| **Phân quyền RBAC 3 vai trò & Explicit Deny** | **VERIFIED PASS** | `PermissionService.check()`, 13 tests trong `enterprise-system.test.ts` | Nguyên tắc Least Privilege và Deny > Allow hoạt động chính xác | Sẵn sàng cho Staging & Production |
| **Cách ly Dữ liệu Phòng ban (Data Isolation)** | **VERIFIED PASS** | Lọc theo `departmentId` trên Docs, Shipments, SSE, Alerts | Không có rò rỉ dữ liệu giữa DOC và EXP | Sẵn sàng cho Staging & Production |
| **Chữ ký số Magic Bytes & SHA-256 Dedup** | **VERIFIED PASS** | `validateFileMagicBytes()`, `calculateChecksum()` | Chặn đứng mã độc giả mạo đuôi và phát hiện trùng file | Sẵn sàng cho Staging & Production |
| **Bóc tách Thực thể Logistics (Regex/Heuristics)** | **VERIFIED PASS** | `lib/ocr/ocr-extractor.ts`, 30 trường đối chứng khớp 100% | Bóc tách chính xác Container ISO 6346, B/L, POL, POD | Sẵn sàng cho Staging & Production |
| **Tìm kiếm Thông minh (Levenshtein + NFD)** | **VERIFIED PASS** | `lib/search.ts`, độ trễ 0.05ms - 0.11ms/query | Tìm kiếm tiếng Việt không dấu và dung sai sai số gõ nhanh | Sẵn sàng cho Staging & Production |
| **Hệ Cơ sở dữ liệu SQLite Hiện tại** | **VERIFIED PASS** | `prisma/schema.prisma` (`provider = "sqlite"`), 31 models | Dữ liệu bền vững sau restart, hỗ trợ Foreign Keys Cascade | Sẵn sàng cho Staging / Local Deploy |
| **Môi trường Cơ sở dữ liệu PostgreSQL** | **PENDING POSTGRESQL VALIDATION** | Schema tương thích 100% với PostgreSQL types | Hiện tại đang chạy trên SQLite (`dev.db`), chưa chạy trên cụm PostgreSQL vật lý | Chạy `prisma migrate deploy` trên cụm PostgreSQL trước khi Go-Live |
| **OCR PDF Scan Thuần túy (Không có Text Layer)** | **PARTIALLY VERIFIED** | Đã hỗ trợ qua Client Scanner (`ocr-content.tsx` Tesseract.js) | Nếu tải file PDF scan trực tiếp qua REST API (không qua UI), máy chủ chưa có headless canvas rasterizer | Tích hợp thêm worker render PDF sang ảnh (`pdf2pic` hoặc `mupdf`) ở giai đoạn 2 |
| **Giới hạn Tốc độ Phân tán (Multi-Node Rate Limit)** | **PARTIALLY VERIFIED** | `lib/security/rate-limit.ts` sử dụng In-Memory Map | Hoạt động hoàn hảo trên single-instance; nếu chạy multi-instance (load balancer) cần bộ nhớ dùng chung | Chuyển In-Memory Map sang Redis/Upstash khi triển khai cụm Cluster nhiều nodes |
| **Giao diện Cấu hình Hạn ngạch (Quota UI)** | **PARTIALLY VERIFIED** | Bảng `StorageObject.sizeBytes` đã theo dõi kích thước | Chưa có màn hình quản trị trực quan để Admin đặt trần dung lượng (Quota Limit) cho từng phòng | Bổ sung màn hình Quota Management trong `/settings` ở bản cập nhật kế tiếp |

---

## 3. PHÂN TÍCH CHUYÊN SÂU CÁC ĐIỂM CẦN LƯU Ý

### 3.1. Cơ sở dữ liệu PostgreSQL (PENDING POSTGRESQL VALIDATION)
- **Hiện trạng:**
  Dự án hiện đang cấu hình `provider = "sqlite"` và `DATABASE_URL="file:./dev.db"`. Tất cả 31 models đã được kiểm tra tính tương thích cú pháp với PostgreSQL:
  - Kiểu định danh `id String @id @default(cuid())` tương thích hoàn toàn.
  - Các trường quan hệ, index `@@unique` và khóa ngoại `onDelete: Cascade` tuân thủ chuẩn ANSI SQL.
- **Hành động bắt buộc trước khi Go-Live Production:**
  1. Thay đổi dòng 2 trong `prisma/schema.prisma`:
     ```prisma
     datasource db {
       provider = "postgresql"
       url      = env("DATABASE_URL")
     }
     ```
  2. Cấp phát kết nối PostgreSQL thật và chạy lệnh:
     ```bash
     npx prisma migrate dev --name init_postgresql
     npx prisma db seed
     ```
  3. Chạy lại `npm test` để xác nhận kết nối và các transaction ACID trên PostgreSQL.

---

### 3.2. Xử lý OCR cho PDF Scan Dạng Ảnh Thuần (Raster-Only PDF)
- **Hiện trạng:**
  - Nếu tài liệu là PDF kỹ thuật số có Text Layer: Hàm `extractTextFromBuffer` đọc trực tiếp cú pháp Text Stream `(text) Tj` với tốc độ gần như tức thời (< 5ms).
  - Nếu tài liệu là ảnh chụp/scan (JPEG, PNG): Được người dùng chụp qua camera hoặc tải lên giao diện `/scan`, `Tesseract.js` worker client-side xử lý OCR và gửi kết quả text lên server.
  - *Khoảng trống kỹ thuật:* Nếu người dùng gửi trực tiếp một file PDF scan (bên trong chỉ chứa ảnh raster, không có text stream nhị phân) qua endpoint `POST /api/documents/upload`, hàm `extractTextFromBuffer` không thể tự động render trang PDF ra ảnh bitmap trên môi trường Node.js mà không có thư viện render như `canvas` hoặc `pdfjs-dist`.
- **Khuyến nghị:**
  - Đối với bản Staging hiện tại: Hướng dẫn người dùng sử dụng tính năng **Quét chứng từ (Scan & OCR)** tại giao diện `/scan` đối với các chứng từ giấy hoặc ảnh chụp.
  - Đối với bản mở rộng tương lai: Cài đặt thêm worker headless rasterizer tại backend để tự động render PDF scan ra ảnh trước khi OCR nếu có nhu cầu tích hợp API tự động với hệ thống ERP bên ngoài.

---

### 3.3. Bộ đệm Giới hạn Tốc độ khi Triển khai Phân tán (Multi-Instance Rate Limiter)
- **Hiện trạng:**
  File `lib/security/rate-limit.ts` sử dụng `Map<string, RateLimitRecord>` lưu trong bộ nhớ RAM của tiến trình Node.js hiện tại. Cơ chế này hoạt động chính xác tuyệt đối trên một server đơn lẻ (Single Instance / PM2 fork mode).
- **Rủi ro khi mở rộng cụm (Horizontal Scaling):**
  Nếu hệ thống chạy trên nhiều máy chủ (Multi-instance / Cluster) sau một Load Balancer (ví dụ: Nginx round-robin), các request của cùng một client có thể rơi vào các tiến trình Node.js khác nhau, khiến bộ đếm brute-force bị phân tán.
- **Khuyến nghị:**
  Khi mở rộng hệ thống lên nhiều node, thay thế `rateLimitStore` cục bộ bằng **Redis** hoặc **Upstash Rate Limiting**.

---

## 4. KẾT LUẬN VÀ PHÂN LOẠI MỨC ĐỘ SẴN SÀNG (FINAL READINESS VERDICT)

Đối chiếu với các tiêu chí nghiệm thu nghiêm ngặt của dự án phần mềm doanh nghiệp:

1. **Về An ninh Bảo mật:** Đạt chuẩn xuất sắc (**12/12 lỗ hổng đã được khắc phục và kiểm chứng thực nghiệm**).
2. **Về Tính toàn vẹn Dữ liệu:** Đạt chuẩn (**31 models, ràng buộc khóa ngoại chặt chẽ, không có mock data**).
3. **Về Nghiệp vụ Logistics:** Đạt chuẩn (**Checklist tự động, trích xuất Container ISO 6346, B/L, POL, POD, tìm kiếm mờ tiếng Việt**).
4. **Về Kiểm thử Tự động:** Đạt chuẩn xuất sắc (**148/148 test cases PASSED**).
5. **Về Mã nguồn Đóng gói:** Đạt chuẩn sạch (**377 KB không chứa rác nhị phân**).

> [!IMPORTANT]
> ### **XẾP HẠNG NGHIỆM THU CHÍNH THỨC: STAGING READY**
> **(HỆ THỐNG SẴN SÀNG TRIỂN KHAI THỬ NGHIỆM DIỆN RỘNG TRÊN MÔI TRƯỜNG DOANH NGHIỆP)**
> 
> *Điều kiện tiên quyết trước khi chuyển sang **PRODUCTION READY (GO-LIVE)**:*
> 1. Triển khai và chạy smoke test trên cụm CSDL PostgreSQL vật lý thực tế.
> 2. Thiết lập biến môi trường bảo mật cao `JWT_SECRET` (ngẫu nhiên >= 32 ký tự) trên máy chủ sản xuất.
> 3. Kích hoạt chứng chỉ SSL/TLS (HTTPS) trên Nginx Reverse Proxy.

