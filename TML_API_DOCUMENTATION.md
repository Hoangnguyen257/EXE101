# TML – TEXT MINING LIBRARY
## TÀI LIỆU API HỆ THỐNG (API SPECIFICATION & ENDPOINT DOCUMENTATION)

---

### 1. TIÊU CHUẨN KỸ THUẬT VÀ QUY TẮC BẢO MẬT CHUNG

Mọi API của hệ thống TML tuân thủ nghiêm ngặt các nguyên tắc sau:
1. **Xác thực (Authentication):**
   - Qua `HttpOnly` cookie `tml_session_token` (đối với giao diện Web Browser).
   - Hoặc qua tiêu đề `Authorization: Bearer <token>` (đối với REST API client, mobile app, kiểm thử tự động).
2. **Bảo vệ CSRF (CSRF Protection - SEC-11):**
   - Với các phương thức thay đổi dữ liệu (`POST`, `PUT`, `PATCH`, `DELETE`), client bắt buộc phải gửi tiêu đề `x-csrf-protection: 1` HOẶC tiêu đề `Origin` khớp chính xác với `Host`.
3. **Phân quyền ngữ cảnh (Resource Context Authorization - SEC-06):**
   - Thao tác trên tài nguyên cụ thể (xem, tải về, chỉnh sửa, xóa) bắt buộc phải kiểm tra quyền kèm theo ID và Department của tài nguyên đó.
4. **Định dạng dữ liệu:** JSON cho yêu cầu và phản hồi; `multipart/form-data` cho luồng upload file. Mã hóa ký tự: UTF-8.

---

### 2. DANH MỤC CÁC ENDPOINT THEO PHÂN HỆ

#### 2.1. Phân hệ Xác thực & Phiên (Authentication & Sessions)

##### `POST /api/auth/login`
Đăng nhập người dùng, cấp phát phiên và token bảo mật.
- **Headers:** `Content-Type: application/json`, `x-csrf-protection: 1`
- **Request Body:**
  ```json
  {
    "email": "ha.tran@tml.vn",
    "password": "Tml@2026!"
  }
  ```
- **Responses:**
  - `200 OK`: Đăng nhập thành công. Thiết lập Cookie `tml_session_token` (HttpOnly, Secure, SameSite=Lax).
    ```json
    {
      "success": true,
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "u2",
        "email": "ha.tran@tml.vn",
        "name": "Trần Thu Hà",
        "role": "MANAGER",
        "departments": [{ "id": "dept_doc", "code": "DOC", "name": "Phòng Chứng từ" }]
      }
    }
    ```
  - `401 Unauthorized`: Sai mật khẩu hoặc tài khoản không tồn tại (thông báo lỗi chung, chống rò rỉ user).
  - `403 Forbidden`: Tài khoản bị tạm khóa 15 phút do nhập sai quá 5 lần liên tiếp.

##### `POST /api/auth/logout`
Hủy bỏ phiên làm việc hiện tại và thu hồi token trong DB.
- **Responses:** `200 OK` (Xóa cookie và cập nhật `Session.revokedAt = now()`).

##### `GET /api/auth/me`
Lấy thông tin người dùng đang đăng nhập cùng danh sách quyền hạn hiệu dụng.
- **Responses:** `200 OK` (Thông tin `AuthUser`) hoặc `401 Unauthorized`.

---

#### 2.2. Phân hệ Chứng từ (Document Management & Storage Vault)

##### `POST /api/documents/upload`
Tải lên chứng từ mới, kiểm tra Magic Bytes, chống trùng lặp và kích hoạt OCR tự động.
- **Headers:** `Content-Type: multipart/form-data`, `x-csrf-protection: 1`
- **Form Data:**
  - `file`: File nhị phân (PDF, PNG, JPG, tối đa 25MB).
  - `shipmentId`: ID lô hàng liên kết.
  - `docType`: Loại chứng từ (`BL`, `INVOICE`, `PACKING_LIST`, `CUSTOMS`, `CO`, `DO`, `AN`, `OTHER`).
  - `title`: Tiêu đề chứng từ (tùy chọn, mặc định lấy tên file).
  - `docDate`: Ngày chứng từ (ISO string).
- **Responses:**
  - `201 Created`: Tải lên và trích xuất OCR thành công.
    ```json
    {
      "success": true,
      "document": {
        "id": "doc_cmvx...",
        "title": "Vận đơn đường biển BL-SGN-2026-8899",
        "fileName": "original-bl.pdf",
        "type": "BL",
        "ocrStatus": "COMPLETED",
        "extractedData": {
          "blNo": "BL-SGN-2026-8899",
          "containers": ["TMLU4589213"],
          "portOfLoading": "CAT LAI PORT, HO CHI MINH",
          "portOfDischarge": "PORT OF ROTTERDAM",
          "confidenceScore": 98
        }
      }
    }
    ```
  - `400 Bad Request`: File không có chữ ký số Magic Bytes hợp lệ (ngụy trang extension).
  - `409 Conflict`: File có cùng mã băm SHA-256 đã được tải lên cho lô hàng này trước đó.
  - `403 Forbidden`: Không có quyền `DOCUMENTS:UPLOAD` trên phòng ban của lô hàng.

##### `GET /api/documents`
Truy vấn danh sách chứng từ có phân trang, lọc theo phòng ban, loại chứng từ, lô hàng.
- **Query Params:** `page`, `limit`, `shipmentId`, `type`, `departmentId`, `status`.
- **Bảo mật:** Dữ liệu tự động lọc theo vai trò và phòng ban của người dùng (Data Isolation).
- **Responses:** `200 OK`: Danh sách chứng từ kèm tổng số bản ghi và thông tin phân trang.

##### `GET /api/documents/[id]`
Lấy chi tiết chứng từ, danh sách các phiên bản và kết quả trích xuất OCR.
- **Responses:** `200 OK` hoặc `403 Forbidden` (nếu không có quyền xem chứng từ phòng ban này).

##### `PATCH /api/documents/[id]`
Cập nhật siêu dữ liệu chứng từ hoặc điều chỉnh nội dung văn bản sau OCR.
- **Headers:** `Content-Type: application/json`, `x-csrf-protection: 1`
- **Request Body:** `{ "title"?: string, "type"?: string, "docDate"?: string, "editedHtml"?: string }`
- **Responses:** `200 OK` (kèm ghi nhận Audit Log `action: 'edit'`).

##### `DELETE /api/documents/[id]/delete`
Xóa mềm chứng từ khỏi hệ thống.
- **Bảo mật:** Yêu cầu quyền `DOCUMENTS:DELETE` và chỉ cho phép xóa chứng từ thuộc quyền quản lý của người dùng.

---

#### 2.3. Phân hệ Lô hàng (Shipments & Checklist)

##### `GET /api/shipments`
Lấy danh sách các lô hàng đang quản lý.
- **Query Params:** `status`, `q`, `page`, `limit`.
- **Responses:** `200 OK` kèm tỷ lệ hoàn thiện checklist chứng từ (`progress`: 0 - 100%).

##### `POST /api/shipments`
Tạo mới một lô hàng logistics và tự động tạo danh mục chứng từ bắt buộc (Checklist Requirements).
- **Headers:** `Content-Type: application/json`, `x-csrf-protection: 1`
- **Request Body:**
  ```json
  {
    "jobNo": "JOB-2026-904",
    "blNo": "BL-SGN-2026-8899",
    "customerId": "cust_123",
    "departmentId": "dept_doc",
    "mode": "sea",
    "origin": "CAT LAI, VIETNAM",
    "destination": "ROTTERDAM, NETHERLANDS",
    "etd": "2026-11-15",
    "eta": "2026-12-02",
    "goodsDesc": "Hàng dệt may xuất khẩu"
  }
  ```
- **Responses:**
  - `201 Created`: Tạo lô hàng thành công và sinh 4 yêu cầu chứng từ bắt buộc.
  - `409 Conflict`: Mã `jobNo` đã tồn tại trong tổ chức.

##### `PATCH /api/shipments/[id]`
Cập nhật trạng thái lô hàng, lịch trình hoặc thông tin vận tải.
- **Ghi vết:** Tự động tạo bản ghi trong `ShipmentStatusHistory` nếu trạng thái thay đổi.

---

#### 2.4. Phân hệ Tìm kiếm Thông minh (Intelligent Search)

##### `GET /api/search`
Tìm kiếm thông minh đa trường (Mã Job, Số B/L, Tên khách hàng, Nội dung bóc tách OCR).
- **Query Params:**
  - `q`: Từ khóa tìm kiếm (hỗ trợ tiếng Việt không dấu và gõ sai chính tả mờ Levenshtein).
  - `scope`: Phạm vi tìm kiếm (`all`, `job`, `bill`, `customer`, `content`).
  - `type`: Lọc theo loại chứng từ.
  - `page`, `limit`: Phân trang.
- **Bảo mật Bắt buộc:** Chỉ tìm kiếm trên dữ liệu mà người dùng được phép xem theo vai trò và phòng ban.
- **Responses:**
  ```json
  {
    "query": "van don cat lai",
    "total": 1,
    "page": 1,
    "limit": 20,
    "hits": [
      {
        "id": "doc_123",
        "kind": "document",
        "href": "/documents/doc_123",
        "title": "Vận đơn đường biển Maersk Line Cát Lái",
        "subtitle": "JOB-2026-904 · Samsung",
        "snippet": { "before": "Tàu cập cảng ", "match": "Cát Lái", "after": " ngày 20/10..." },
        "matchedIn": "content",
        "score": 8
      }
    ]
  }
  ```

---

#### 2.5. Phân hệ Chia sẻ An toàn (Secure Document Sharing)

##### `POST /api/documents/[id]/share`
Tạo liên kết chia sẻ tài liệu ra ngoài hoặc nội bộ có mật khẩu và hạn sử dụng.
- **Request Body:** `{ "password"?: string, "expiresInDays"?: number, "maxDownloads"?: number }`
- **Responses:** `200 OK` (trả về share token và URL chia sẻ `/s/[token]`).

##### `POST /api/s/[token]/verify`
Xác thực mật khẩu liên kết chia sẻ (có Rate Limiter 5 lần thử chống brute-force).
- **Responses:** `200 OK` kèm `shareAccessToken` ngắn hạn (15 phút) gắn chặt với `shareId`.

##### `GET /api/s/[token]/content` & `GET /api/s/[token]/download`
Xem và tải tài liệu chia sẻ bằng `shareAccessToken`. Tuyệt đối không cho phép dùng chéo sang tài liệu khác (SEC-01).

---

#### 2.6. Phân hệ Đồng bộ Thời gian thực & Cảnh báo (Realtime Sync & Alerts)

##### `GET /api/sync/events` (Server-Sent Events - SSE)
Kết nối luồng sự kiện thời gian thực thông báo thay đổi chứng từ, lô hàng và quyền hạn.
- **Headers:** `Accept: text/event-stream`, `Last-Event-ID` (hỗ trợ phát lại sự kiện bị lỡ).
- **Cách ly dữ liệu:** Nhân viên chỉ nhận sự kiện thuộc phòng ban của mình (SEC-08).

##### `GET /api/alerts`
Truy vấn các cảnh báo thiếu chứng từ và cảnh báo tài liệu sắp hết hạn lưu trữ.
- **Cách ly dữ liệu:** Nhân viên chỉ thấy cảnh báo chứng từ thuộc phòng ban mình phụ trách.

---

#### 2.7. Phân hệ Giám sát Sức khỏe Hệ thống (Health Check)

##### `GET /api/health`
Kiểm tra tính sẵn sàng của hệ thống (Readiness & Liveness Probe).
- **Phản hồi:**
  ```json
  {
    "status": "healthy",
    "timestamp": "2026-11-01T12:48:14.000Z",
    "uptimeSeconds": 3450,
    "environment": "production",
    "database": { "connected": true, "latencyMs": 4 },
    "storage": { "writable": true, "vaultDir": "C:\\...\\storage_vault" },
    "memory": { "rssMb": 85, "heapUsedMb": 52 },
    "responseTimeMs": 6
  }
  ```

