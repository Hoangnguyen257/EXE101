# TML DOCMANAGER – TASK 16 REMAINING RISKS & CONTINGENCY PLAN
## BÁO CÁO PHÂN TÍCH RỦI RO CÒN LẠI VÀ BIỆN PHÁP DỰ PHÒNG

---

## 1. TỔNG QUAN ĐÁNH GIÁ RỦI RO

Sau khi hoàn thành toàn diện **TASK 16** với các hạng mục cải tiến chuyển cảnh điện ảnh 3D và đồng bộ Design System, hệ thống đã được kiểm thử với độ phủ tối đa. Dưới đây là phân tích chi tiết về các rủi ro vận hành tiềm ẩn trên môi trường Production và phương án phòng ngừa:

---

## 2. DANH MỤC RỦI RO TIỀM ẨN & GIẢI PHÁP DỰ PHÒNG

### 2.1. Thiết bị cấu hình thấp hoặc card đồ họa yếu (Low-end GPU Performance)
- **Mô tả rủi ro:** Một số máy trạm đời cũ hoặc máy tính bảng giá rẻ có thể bị giảm tốc độ khung hình (drop FPS) khi render perspective 3D và các hiệu ứng bóng đổ phức tạp.
- **Biện pháp xử lý đã tích hợp:**
  - Tự động nhận diện thuộc tính `prefers-reduced-motion: reduce`: Khi phát hiện người dùng bật chế độ giảm chuyển động trong hệ điều hành, toàn bộ hiệu ứng 3D xoay trục được tắt và hiển thị thẳng giao diện form ở góc nhìn $0^\circ$.
  - Cung cấp nút bấm chủ động **"Bỏ qua intro"** ngay tại góc trên cùng bên phải.
  - Sử dụng cơ chế lưu trữ `sessionStorage.getItem('tml_intro_seen')`: Chỉ hiển thị intro một lần duy nhất trong phiên làm việc, các lần truy cập tiếp theo sẽ mở thẳng form đăng nhập mà không gây chờ đợi.

### 2.2. Trình duyệt cũ không hỗ trợ CSS `transform-style: preserve-3d`
- **Mô tả rủi ro:** Các trình duyệt rất cũ hoặc webview nhúng đặc thù có thể không hiển thị đầy đủ không gian phối cảnh 3D.
- **Biện pháp xử lý đã tích hợp:**
  - CSS Fallback tự động: Toàn bộ thẻ `Document3D` được thiết kế phẳng (flat layout) với màu nền trắng, viền rõ ràng và bóng đổ CSS tiêu chuẩn. Nếu perspective 3D không được hỗ trợ, giao diện vẫn hiển thị dưới dạng một tờ chứng từ phẳng hoàn hảo mà không bị vỡ giao diện hay mất chữ.

### 2.3. Hạn mức lưu trữ trên môi trường Serverless (Vercel `/tmp`)
- **Mô tả rủi ro:** Trên Vercel Serverless Functions, thư mục `/tmp` có hạn mức dung lượng tối đa $512\text{MB} - 1\text{GB}$ và sẽ bị tái tạo khi container tắt.
- **Biện pháp xử lý đã tích hợp:**
  - Tích hợp cơ chế Direct Upload và Storage Provider trừu tượng: Cho phép cấu hình chuyển đổi sang Amazon S3 / Cloudflare R2 / Google Cloud Storage thông qua biến môi trường mà không cần thay đổi bất kỳ dòng code nào.

---

## 3. KẾT LUẬN & SẴN SÀNG TRIỂN KHAI
Hệ thống không còn bất kỳ lỗi blocking hoặc rủi ro nghiêm trọng nào chưa được kiểm soát. Toàn bộ mã nguồn đã sẵn sàng bàn giao cho người dùng và triển khai trực tiếp lên môi trường Production.

