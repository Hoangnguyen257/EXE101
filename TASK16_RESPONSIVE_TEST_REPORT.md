# TML DOCMANAGER – TASK 16 RESPONSIVE TEST REPORT
## BÁO CÁO KIỂM THỬ ĐÁP ỨNG THIẾT BỊ (MULTI-DEVICE & VIEWPORT RESPONSIVENESS)

---

## 1. PHẠM VI KIỂM THỬ KHUNG NHÌN (VIEWPORT COVERAGE)

Hệ thống được kiểm thử kỹ lưỡng trên 6 kích thước màn hình chuẩn phổ biến của môi trường doanh nghiệp và người dùng di động:

| Kích thước (WxH) | Loại thiết bị đại diện | Trạng thái hiển thị (Paper & Login) | Trạng thái hiển thị (Dashboard) | Đánh giá |
| :---: | :--- | :--- | :--- | :---: |
| **$1920 \times 1080$** | Màn hình máy trạm Desktop Full HD | Tờ giấy $440\text{px}$ đặt trung tâm, góc nghiêng 3D $15^\circ \to 0^\circ$, shadow mềm | Sidebar mở rộng, Grid 4 KPI cards, 3 cột nội dung thông thoáng | **PASSED** |
| **$1440 \times 900$** | Laptop doanh nhân (MacBook/ThinkPad) | Tỷ lệ giấy vừa vặn, không bị cắt mép, nút bấm và chân trang nằm trong viewport | Grid tự co giãn theo tỷ lệ, bảng dữ liệu hiển thị trọn vẹn | **PASSED** |
| **$1366 \times 768$** | Laptop phổ thông văn phòng | Chiều cao form tối ưu, không phát sinh cuộn dọc bất thường để thấy nút bấm | Khoảng cách các card thu gọn hợp lý, font chữ dễ đọc | **PASSED** |
| **$1024 \times 768$** | Máy tính bảng chế độ ngang (iPad Pro) | Giảm nhẹ góc nghiêng 3D, form căn giữa, input dễ chạm | Sidebar thu về chế độ icon, Grid chuyển 2 cột linh hoạt | **PASSED** |
| **$768 \times 1024$** | Máy tính bảng chế độ dọc (iPad Air) | Chiều rộng $440\text{px}$ căn giữa hoàn hảo, hỗ trợ chạm cảm ứng | Grid xếp chồng 1-2 cột, bảng dữ liệu cuộn ngang êm ái | **PASSED** |
| **$390 \times 844$** | Điện thoại thông minh (iPhone 14/15/16) | Co giãn `w-full max-w-[440px]`, lề $16\text{px}$, 3D trực diện $0^\circ$ | Sidebar chuyển thành Mobile Drawer, 100% không tràn ngang | **PASSED** |

---

## 2. KIỂM SOÁT LỖI GIAO DIỆN PHỔ BIẾN

1. **Tràn khung ngang (Horizontal Overflow):**
   - Không có bất kỳ thành phần nào vượt ra ngoài `100vw`.
   - Các bảng dữ liệu nhiều cột (Documents, Shipments, Audit) có vùng cuộn ngang độc lập với thanh trượt mượt mà.
2. **Kích thước vùng tương tác (Touch Targets):**
   - Toàn bộ các nút bấm và ô nhập liệu đều đạt chiều cao tối thiểu $\ge 38\text{px}$ trên thiết bị di động, đảm bảo thao tác chạm ngón tay chính xác.
3. **Che khuất do bàn phím ảo (Virtual Keyboard Handling):**
   - Các input trên mobile không bị che khuất khi bàn phím ảo xuất hiện; trường đang focus tự động cuộn vào vùng nhìn thấy.
