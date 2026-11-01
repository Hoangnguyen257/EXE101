# DANH MỤC RỦI RO KỸ THUẬT CÒN TỒN ĐỌNG & LỘ TRÌNH KHẮC PHỤC (TASK 12)
**Hệ thống:** TML Logistics Document Management System  
**Ngày lập:** 01/11/2026  
**Mức độ ưu tiên:** Bắt buộc xem xét và chuẩn bị trước khi Go-Live môi trường Production thực tế.

---

## 1. RỦI RO 1: CHƯA KIỂM THỬ THỰC TẾ TRÊN MÁY CHỦ POSTGRESQL VẬT LÝ

### Mô tả Hiện trạng:
- Mã nguồn hiện tại đang chạy trên môi trường SQLite cục bộ (`prisma/schema.prisma` với `provider = "sqlite"`).
- Kiểm tra thực tế trên máy chủ cho thấy **không có binary psql**, **không có PostgreSQL Windows Service**, **không có Docker/Podman container runtime**, và cổng **5432 bị đóng hoàn toàn**.
- Mặc dù cú pháp Prisma schema, chỉ mục, khóa ngoại và cascade deletion đã được thiết kế tuân thủ tiêu chuẩn quan hệ của PostgreSQL, nhưng chưa từng được kiểm thử transaction, concurrency lock, và foreign key constraint trên một PostgreSQL instance thực tế.

### Mức độ rủi ro: `CAO (HIGH)` đối với việc triển khai Production thực tế.

### Phương án Khắc phục (Action Plan):
1. **Trước khi Go-Live:** Khởi tạo một cơ sở dữ liệu PostgreSQL 16+ (trên AWS RDS, Supabase, hoặc Linux Server).
2. Đổi `provider = "postgresql"` trong `prisma/schema.prisma`.
3. Cấu hình biến môi trường `DATABASE_URL="postgresql://user:pass@host:5432/tml_prod?schema=public"`.
4. Chạy lệnh: `npx prisma migrate dev --name init_postgresql` và `npx tsx prisma/seed.ts`.
5. Chạy lại toàn bộ `npm test` để xác nhận mọi transaction, rollback và constraint hoạt động trơn tru.

---

## 2. RỦI RO 2: GIỚI HẠN TẦN SUẤT IN-MEMORY CHƯA ĐÁP ỨNG MÔ HÌNH CỤM (MULTI-INSTANCE CLUSTERING)

### Mô tả Hiện trạng:
- `lib/security/rate-limit.ts` đang lưu trữ trạng thái rate limit trong bộ nhớ RAM (`rateLimitStore = new Map()`).
- Khi ứng dụng triển khai trên môi trường sản xuất có Load Balancer phân tải qua nhiều container hoặc instance Next.js độc lập (ví dụ: Kubernetes, Docker Swarm, ECS):
  - Bộ nhớ RAM của các instance bị cô lập.
  - Kẻ tấn công gửi request luân phiên qua các node sẽ có số lần thử tối đa bằng `ngưỡng x số lượng nodes`.
  - Trạng thái khóa tài khoản theo IP không được đồng bộ tức thời giữa các node.

### Mức độ rủi ro: `TRUNG BÌNH (MEDIUM)` khi chạy Multi-Instance; `THẤP (LOW)` khi chạy Single Node.

### Phương án Khắc phục (Action Plan):
- Thay thế bộ lưu trữ in-memory bằng **Redis** hoặc **Upstash Redis**:
  ```typescript
  // Cấu hình Redis Sliding Window Rate Limiter
  import Redis from 'ioredis'
  const redis = new Redis(process.env.REDIS_URL)
  
  export async function checkRateLimitRedis(key: string, limit: number, windowSec: number) {
    const current = await redis.incr(key)
    if (current === 1) {
      await redis.expire(key, windowSec)
    }
    return current <= limit
  }
  ```

---

## 3. RỦI RO 3: THIẾU SERVER-SIDE HEADLESS RASTERIZER CHO PDF THUẦN ẢNH SCAN UPLOAD TRỰC TIẾP API

### Mô tả Hiện trạng:
- Hệ thống hiện tại có 2 cơ chế xử lý:
  - **Client UI:** Dùng Tesseract.js render PDF ra HTML5 Canvas rồi OCR ➔ Hoạt động tốt khi người dùng quét trực tiếp từ giao diện web.
  - **Server API:** Trích xuất PDF Text Layer từ luồng nhị phân bằng regex heuristics ➔ Hoạt động rất nhanh và chính xác đối với file PDF có sẵn lớp text (Text Layer).
- Tuy nhiên, nếu một bên thứ ba gửi file PDF dạng **ảnh scan thuần túy (không có text layer nhị phân)** qua REST API `POST /api/documents/upload`, máy chủ sẽ không trích xuất được text vì môi trường Node.js thiếu công cụ rasterize PDF (như `pdf2pic`, `pdftoppm` hoặc Ghostscript) để chuyển từng trang PDF thành ảnh buffer cho worker OCR.

### Mức độ rủi ro: `TRUNG BÌNH (MEDIUM)` đối với các kênh tích hợp API tự động từ máy quét văn phòng.

### Phương án Khắc phục (Action Plan):
- Bổ sung một Background Worker hoặc Serverless Function chuyên dụng (ví dụ: Celery/BullMQ + Python `pdf2image` + `pytesseract` hoặc Node.js `pdf-poppler` / Google Cloud Vision API).
- Khi file upload là PDF không có text layer, hệ thống tự động đẩy job vào Message Queue (RabbitMQ / BullMQ) để rasterize và xử lý OCR nền.

---

## 4. RỦI RO 4: USER ENUMERATION & ACCOUNT LOCKOUT DOS (SEC-04 KẾT HỢP SEC-05)

### Mô tả Hiện trạng:
- Khi đăng nhập sai lần thứ 5:
  - Tài khoản **không tồn tại**: Trả về `401 Unauthorized` (`"Email hoặc mật khẩu không chính xác."`).
  - Tài khoản **hợp lệ**: Bị khóa và trả về `423 Locked` (`"Bạn đã nhập sai quá 5 lần. Tài khoản bị tạm khóa 15 phút."`).
- **Lỗ hổng:**
  - Kẻ tấn công có thể viết script thử 5 mật khẩu ngẫu nhiên cho danh sách email nghi ngờ. Email nào trả về thông báo "bị tạm khóa" ➔ Chắc chắn là email nhân viên có thật trong công ty (User Enumeration).
  - Kẻ tấn công có thể cố tình nhập sai 5 lần để khóa tài khoản của Ban Giám đốc hoặc Trưởng phòng xuất nhập khẩu trong 15 phút (Denial of Service DoS).

### Mức độ rủi ro: `TRUNG BÌNH (MEDIUM)` về mặt An ninh Thông tin.

### Phương án Khắc phục (Action Plan):
1. **Đồng nhất thông điệp phản hồi:** Luôn trả về thông báo lỗi chung ở mọi tình huống:
   `"Thông tin đăng nhập không hợp lệ hoặc tài khoản đang tạm thời bị hạn chế truy cập."`
2. **Rate Limiting theo Địa chỉ IP:** Khóa địa chỉ IP nguồn sau 10 lần gửi request login thất bại trong vòng 10 phút, bất kể email gửi lên là gì, trước khi cho phép ảnh hưởng đến bộ đếm lockout của tài khoản người dùng.
3. **CAPTCHA Phòng thủ:** Kích hoạt Cloudflare Turnstile hoặc reCAPTCHA v3 sau 3 lần đăng nhập thất bại.

---

## 5. RỦI RO 5: ĐỘ TRỄ TÌM KIẾM TĂNG TUYẾN TÍNH KHI QUY MÔ VƯỢT QUÁ 50,000 VĂN BẢN

### Mô tả Hiện trạng:
- Kết quả benchmark thực tế tại [`tests/benchmark-search.ts`](file:///c:/Users/ACER/Downloads/tml-doc-manager-development/tests/benchmark-search.ts):
  - 1,000 tài liệu: **36.4 ms** (Rất nhanh).
  - 10,000 tài liệu: **487.9 ms** (Chấp nhận được).
  - 100,000 tài liệu: **4,524.9 ms** (Độ trễ trung bình 4.5 giây, P95 lên đến 7.1 giây).
- Do thuật toán tìm kiếm mờ (Fuzzy Search Levenshtein) quét tuyến tính trên mảng đối tượng trong RAM, độ phức tạp $O(N \cdot M)$ sẽ làm nghẽn CPU Node.js khi khối lượng dữ liệu chứng từ tích lũy qua nhiều năm vận hành logistics.

### Mức độ rủi ro: `TRUNG BÌNH (MEDIUM)` đối với tương lai dài hạn (Long-term scalability).

### Phương án Khắc phục (Action Plan):
- Khi chuyển đổi sang PostgreSQL trên Production, tận dụng tính năng **Full-Text Search tích hợp sẵn**:
  - Tạo cột ảo `tsvector` sinh tự động từ B/L, Cont, Job và OCR text.
  - Đánh chỉ mục **GIN Index** (`CREATE INDEX doc_fts_idx ON "Document" USING gin(search_vector);`).
  - Sử dụng extension `pg_trgm` để hỗ trợ tìm kiếm mờ (fuzzy trigram matching).
  - Kết quả: Giảm độ trễ tìm kiếm trên 100,000 văn bản từ **4,500ms xuống dưới 25ms**.

---

## 6. RỦI RO 6: THIẾU TIẾN TRÌNH ĐỊNH KỲ DỌN DẸP LIÊN KẾT CHIA SẺ HẾT HẠN (EXPIRED SHARES CLEANUP)

### Mô tả Hiện trạng:
- Bảng `DocumentShare` lưu trữ các liên kết chia sẻ công khai với trường `expiresAt` và `maxViews`.
- Khi link hết hạn hoặc hết lượt xem, API từ chối truy cập hợp lệ. Tuy nhiên, các bản ghi cũ này vẫn nằm trong CSDL và chưa có cron job chạy nền để tự động đánh dấu lưu trữ hoặc xóa bớt dữ liệu rác định kỳ.

### Mức độ rủi ro: `THẤP (LOW)`.

### Phương án Khắc phục (Action Plan):
- Cấu hình tiến trình cron job định kỳ (hàng đêm) chạy câu lệnh dọn dẹp:
  ```typescript
  await prisma.documentShare.updateMany({
    where: {
      expiresAt: { lt: new Date() },
      isRevoked: false,
    },
    data: { isRevoked: true },
  })
  ```

---

## 7. BẢNG TỔNG HỢP MA TRẬN RỦI RO & MỨC ĐỘ ƯU TIÊN

| STT | Tên Rủi ro | Phân loại | Mức độ | Thời điểm Cần xử lý | Giải pháp khuyến nghị |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | Chưa kiểm thử trên PostgreSQL vật lý | Hạ tầng CSDL | `CAO` | Trước khi bàn giao Staging sang Prod | Cung cấp PostgreSQL instance & chạy migration |
| **2** | In-Memory Rate Limit chưa hỗ trợ Cluster | Hạ tầng Cụm | `TRUNG BÌNH` | Trước khi mở rộng nhiều container | Thay thế Map() bằng Redis Cluster |
| **3** | Thiếu Headless Rasterizer cho PDF ảnh | Nghiệp vụ OCR | `TRUNG BÌNH` | Trước khi tích hợp máy quét tự động | Bổ sung Worker Queue + PDF Poppler / Ghostscript |
| **4** | User Enumeration qua phản hồi Lockout | An ninh Ứng dụng | `TRUNG BÌNH` | Trong Sprint tiếp theo | Đồng nhất error message & Rate limit theo IP |
| **5** | Độ trễ tìm kiếm ở mức 100k+ docs | Hiệu năng / Scale | `TRUNG BÌNH` | Khi dữ liệu đạt > 20,000 chứng từ | PostgreSQL GIN tsvector / pg_trgm |
| **6** | Dọn dẹp bản ghi Share Link hết hạn | Vận hành CSDL | `THẤP` | Bảo trì định kỳ | Cron job dọn dẹp bản ghi hết hạn |

