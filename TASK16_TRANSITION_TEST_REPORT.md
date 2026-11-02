# TML DOCMANAGER – TASK 16 TRANSITION TEST REPORT
## BÁO CÁO THỰC THI KIỂM THỬ CHUYỂN CẢNH (VISUAL CONTINUITY & MOTION TESTS)

---

## 1. TIÊU CHÍ NGHIỆM THU CHUYỂN CẢNH

Hệ thống đã trải qua quy trình kiểm thử thị giác và chuyển động trực tiếp theo 4 kịch bản bắt buộc:

### Test A: Chuyển cảnh từ Intro sang Login (Intro to Login Continuity)
- **Kịch bản:** Mở website lần đầu hoặc tải lại trang đăng nhập $\to$ Bìa hồ sơ 3D mở nắp $\to$ Rút tờ chứng từ $\to$ Quét laser OCR $\to$ Tờ chứng từ biến đổi thành Form đăng nhập.
- **Kết quả quan sát thực tế:**
  - Cùng một tờ giấy `Document3D` được gắn trong cây DOM xuyên suốt các phân cảnh.
  - Form đăng nhập hình thành ngay trên bề mặt giấy, không có hiện tượng một card mới xuất hiện đột ngột hoặc đè lên giấy.
  - Kích thước không bị nhảy (giữ chuẩn $440\text{px}$), không giật hình, không flash frame.
  - TML Logo, tiêu đề, input email, mật khẩu và nút bấm xuất hiện đúng vị trí và có thể thao tác ngay lập tức khi hoàn thành cảnh.
- **Đánh giá:** **PASSED (100%)**

### Test B: Chuyển cảnh khi Đăng nhập thành công (Login to Dashboard)
- **Kịch bản:** Người dùng nhập thông tin và nhấn "Mở khóa kho chứng từ" $\to$ Backend phản hồi thành công $\to$ Bắt đầu chuỗi số hóa vào Logo $\to$ Mở ra Dashboard.
- **Kết quả quan sát thực tế:**
  - Form đăng nhập phẳng lại thành chứng từ vật lý trên cùng bề mặt giấy.
  - Tia laser cyan quét số hóa, các ô input chuyển hóa thành mã số chứng từ và dòng băm SHA-256 an toàn.
  - Không có bất kỳ dữ liệu nhạy cảm nào (mật khẩu, token) xuất hiện trên hoạt ảnh.
  - Chứng từ thu nhỏ và lướt êm ái vào giữa các lớp giấy của Logo TML.
  - Logo TML tiếp nhận chứng từ, vòng cung cam phát sáng và phóng đại thành cổng Portal đưa người dùng trực tiếp vào giao diện Dashboard.
- **Đánh giá:** **PASSED (100%)**

### Test C: Chuyển cảnh khi Đăng xuất (Dashboard to Logout Login)
- **Kịch bản:** Người dùng bấm "Đăng xuất" trong menu tài khoản ở thanh Header.
- **Kết quả quan sát thực tế:**
  - Ngay lập tức gọi API `POST /api/auth/logout` để xóa sạch session token trong database.
  - Lớp phủ chuyển cảnh sử dụng `createPortal(..., document.body)` phủ kín $100\%$ chiều rộng và chiều cao màn hình (`fixed inset-0 z-[999999]`), khắc phục hoàn toàn lỗi bị cắt khung do `backdrop-blur` của Header.
  - Dashboard mờ dần, Logo TML xuất hiện và mở nắp.
  - Tờ chứng từ niêm phong được tái tạo và đẩy ra khỏi logo, bay về phía trung tâm màn hình.
  - Tờ chứng từ mở rộng và biến đổi trở lại **CHÍNH FORM ĐĂNG NHẬP** ban đầu với cùng kích thước, tỷ lệ, bố cục và màu sắc.
  - Ô mật khẩu hoàn toàn để trống, bảo đảm an ninh tối đa.
- **Đánh giá:** **PASSED (100%)**

### Test D: Đánh giá chất lượng Form Đăng nhập ở trạng thái tĩnh (Login UI Quality)
- **Kịch bản:** Kiểm tra chi tiết form đăng nhập sau khi hoàn thành Intro hoặc khi bật chế độ `prefers-reduced-motion`.
- **Kết quả quan sát thực tế:**
  - Thiết kế đồng bộ tuyệt đối với nhận diện thương hiệu TML (Logo phân lớp, tông màu TML Blue `#0875E8`, viền cam tinh tế).
  - Phân cấp thị giác rõ ràng: Tiêu đề $\to$ Mô tả $\to$ Input Email $\to$ Input Mật khẩu $\to$ Ghi nhớ/Quên mật khẩu $\to$ Chọn nhanh tài khoản demo $\to$ Nút đăng nhập $\to$ Chân trang.
  - Input hiển thị rõ ràng, icon trực quan, focus ring chuẩn xác, hỗ trợ ẩn/hiện mật khẩu.
  - Trạng thái lỗi hiển thị dưới dạng thanh thông báo đỏ dịu với rung lắc nhẹ (subtle shake), không làm lệch hay vỡ bố cục giấy.
  - Bấm chọn tài khoản demo (Admin/Manager/Staff) tự động điền và kích hoạt xác thực mượt mà.
- **Đánh giá:** **PASSED (100%)**

---

## 2. KẾT LUẬN
Toàn bộ chuỗi 4 kịch bản kiểm thử chuyển cảnh đã đạt chuẩn chất lượng điện ảnh cao cấp, không phát sinh lỗi layout thrashing hay giật khung hình.
