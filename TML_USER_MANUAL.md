# TML – TEXT MINING LIBRARY
## SỔ TAY HƯỚNG DẪN SỬ DỤNG (USER & ADMINISTRATOR MANUAL)

---

### 1. ĐĂNG NHẬP VÀ BẢO MẬT TÀI KHOẢN

#### 1.1. Đăng nhập hệ thống
1. Truy cập đường dẫn: `https://tml.yourcompany.com/login` (hoặc `http://localhost:3000/login`).
2. Nhập **Email doanh nghiệp** và **Mật khẩu**.
3. Bấm nút **"Đăng nhập"**.
> [!NOTE]
> Hệ thống áp dụng cơ chế tự động khóa tài khoản tạm thời 15 phút nếu nhập sai mật khẩu quá 5 lần liên tiếp để bảo vệ tài khoản khỏi các cuộc tấn công dò tìm.

#### 1.2. Đăng xuất an toàn
- Bấm vào biểu tượng ảnh đại diện ở góc trên bên phải thanh điều hướng.
- Chọn **"Đăng xuất"**. Phiên làm việc sẽ bị thu hồi ngay lập tức trên máy chủ.

---

### 2. QUẢN TRỊ CHỨNG TỪ (DOCUMENTS)

#### 2.1. Xem danh sách chứng từ
- Điều hướng tới mục **"Chứng từ"** (`/documents`) trên thanh menu chính.
- Hệ thống hiển thị bảng chứng từ bao gồm: Mã chứng từ, Tiêu đề, Mã Job lô hàng, Loại chứng từ (B/L, Invoice, Packing List...), Ngày chứng từ, Trạng thái và Người tải lên.
- Sử dụng bộ lọc nhanh theo **Loại chứng từ** hoặc **Phòng ban** để tra cứu dữ liệu.

#### 2.2. Tải lên và Quét OCR tự động
1. Bấm nút **"Tải lên chứng từ"** hoặc truy cập mục **"Scan & OCR"** (`/scan`).
2. Chọn tập tin từ máy tính (hỗ trợ PDF, PNG, JPG tối đa 25MB).
3. Chọn **Lô hàng (Shipment)** tương ứng và **Loại chứng từ**.
4. Bấm **"Bắt đầu tải lên & Xử lý OCR"**.
5. Hệ thống sẽ:
   - Kiểm tra định dạng chữ ký số nhị phân (Magic Bytes).
   - Kiểm tra trùng lặp tập tin (SHA-256 Deduplication).
   - Tự động bóc tách số Container, số vận đơn B/L, số Hóa đơn, Cảng POL và Cảng POD.
   - Hiển thị kết quả trích xuất và điểm tin cậy (Confidence Score).

#### 2.3. Chỉnh sửa văn bản và Xem lịch sử phiên bản
- Bấm vào tên chứng từ để mở trang chi tiết (`/documents/[id]`).
- Chọn **"Chỉnh sửa nội dung"** để sửa lại các từ OCR bị mờ trong khung soạn thảo văn bản Tiptap.
- Bấm **"Lưu thay đổi"** để tạo một phiên bản snapshot mới trong lịch sử tài liệu.

#### 2.4. Chia sẻ chứng từ an toàn (Secure Sharing)
1. Tại trang chi tiết chứng từ, bấm nút **"Chia sẻ"**.
2. Thiết lập các thông số bảo vệ:
   - **Mật khẩu bảo vệ (PIN Code):** Bắt buộc người nhận phải nhập mật khẩu để xem/tải.
   - **Thời hạn hiệu lực:** Chọn số ngày liên kết có giá trị (ví dụ: 1 ngày, 7 ngày).
   - **Giới hạn số lần tải:** Tối đa số lượt tải cho phép.
3. Bấm **"Tạo liên kết chia sẻ"** và sao chép đường dẫn gửi cho đối tác/khách hàng.
4. Bất kỳ lúc nào, bạn có thể bấm **"Thu hồi liên kết"** để ngắt quyền truy cập ngay lập tức.

---

### 3. QUẢN LÝ LÔ HÀNG VÀ CHECKLIST (SHIPMENTS)

#### 3.1. Tạo mới lô hàng (Create Shipment)
1. Điều hướng tới mục **"Lô hàng"** (`/shipments`).
2. Bấm nút **"Tạo lô hàng mới"**.
3. Điền các trường thông tin bắt buộc:
   - **Mã Job:** Mã định danh duy nhất (ví dụ: `JOB-2026-001`).
   - **Số B/L:** Số vận đơn hàng hải hoặc vận đơn hàng không.
   - **Khách hàng:** Chọn khách hàng từ danh mục đối tác.
   - **Phương thức vận tải:** Đường biển (Sea), Hàng không (Air), hoặc Đường bộ (Road).
   - **Nơi đi (POL) & Nơi đến (POD).**
   - **Lịch trình:** Ngày khởi hành (ETD) và Ngày cập cảng (ETA).
4. Bấm **"Lưu lô hàng"**. Hệ thống sẽ tự động khởi tạo **Checklist danh mục chứng từ bắt buộc** (ví dụ: B/L, Commercial Invoice, Packing List, Tờ khai Hải quan).

#### 3.2. Theo dõi tiến độ chứng từ (Document Progress)
- Cột **"Tiến độ chứng từ"** hiển thị thanh phần trăm (ví dụ: `50%`, `75%`, `100%`).
- Nhấp vào lô hàng để xem chi tiết các chứng từ đã nộp (UPLOADED), được phê duyệt (APPROVED) hoặc còn thiếu (MISSING).

---

### 4. TÌM KIẾM THÔNG MINH (INTELLIGENT SEARCH)

- Sử dụng thanh tìm kiếm toàn cục ở đầu trang hoặc tổ hợp phím tắt `Ctrl + K`.
- Nhập từ khóa:
  - Có thể gõ **tiếng Việt không dấu** (ví dụ: `van don cat lai` tìm thấy `Vận đơn đường biển Cát Lái`).
  - Hệ thống tự động sửa lỗi chính tả mờ (ví dụ: `Maerskk` tìm thấy `Maersk Line`).
  - Tìm theo số Container (ví dụ: `TMLU4589213`), số B/L hoặc nội dung văn bản bên trong chứng từ.
- Kết quả tìm kiếm hiển thị đoạn trích dẫn (snippet) được bôi đậm vị trí khớp từ khóa.

---

### 5. THEO DÕI CẢNH BÁO HẾT HẠN (RETENTION ALERTS)

- Truy cập mục **"Cảnh báo"** (`/alerts`).
- Hệ thống phân loại 2 nhóm cảnh báo chính:
  1. **Cảnh báo thiếu chứng từ:** Lô hàng sắp đến ngày ETD/ETA nhưng chưa nộp đủ chứng từ bắt buộc.
  2. **Cảnh báo hạn lưu trữ:** Chứng từ sắp hết thời hạn bảo quản theo quy định hải quan/pháp luật cần đưa vào lưu trữ vĩnh viễn hoặc hủy an toàn.
> [!IMPORTANT]
> Dữ liệu cảnh báo được cách ly bảo mật theo phòng ban: Nhân viên chỉ thấy cảnh báo liên quan đến lô hàng và chứng từ thuộc phòng ban mình phụ trách.

---

### 6. QUẢN TRỊ HỆ THỐNG DÀNH CHO ADMIN

- **Quản lý người dùng (`/settings`):** Tạo mới tài khoản, phân quyền vai trò (Admin, Manager, Staff), phân bổ nhân sự vào các phòng ban và chức danh.
- **Phân quyền nâng cao (`/settings/permissions`):** Tùy chỉnh chi tiết quyền theo từng phân hệ. Có thể thiết lập **Explicit Deny** cho từng nhân sự cụ thể khi cần thu hồi tạm thời một hành động.
- **Nhật ký kiểm toán (`/audit`):** Tra cứu toàn bộ lịch sử đăng nhập, tải file, sửa đổi dữ liệu và chia sẻ tài liệu với đầy đủ thông tin thời gian, người thực hiện, địa chỉ IP và hành động.

