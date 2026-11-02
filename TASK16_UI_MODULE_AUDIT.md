# TML DOCMANAGER – TASK 16 UI MODULE AUDIT & INVENTORY REPORT
## ĐỐI CHIẾU DANH MỤC TRANG, PHÂN HỆ NGHIỆP VỤ & HIỆN TRẠNG TRIỂN KHAI

---

## 1. BẢNG ĐỐI CHIẾU TOÀN DIỆN CÁC PHÂN HỆ HỆ THỐNG

| STT | Phân hệ (Module) | Đường dẫn Route | Trạng thái Nghiệp vụ Backend | Hiện trạng Giao diện (UI) | Đánh giá Rủi ro |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | **Xác thực Đăng nhập** | `/login` | `POST /api/auth/login` (bcrypt, SHA-256 session, lockout, brute-force defense) | Đã chuẩn hóa mô hình **The Login Form IS the Paper** với trải nghiệm 3D liên tục | Không có rủi ro |
| 2 | **Đăng xuất an toàn** | Header Logout Action | `POST /api/auth/logout` (thu hồi physical session trong DB) | Đã nâng cấp `createPortal` vào `document.body` phủ $100\%$ màn hình, chống lỗi cắt header | Không có rủi ro |
| 3 | **Tổng quan (Dashboard)** | `/dashboard` | `getDashboard()`, đếm KPI, lọc cảnh báo, lô hàng dở dang, hoạt động thực tế | Đã đồng bộ Design System, thẻ `rounded-2xl`, phân cấp màu `#0875E8` | Không có rủi ro |
| 4 | **Quản lý Chứng từ** | `/documents`, `/documents/[id]` | `getDocuments()`, Soft Delete, chia sẻ token, phân quyền tải file theo Role & Department | Đã đồng bộ giao diện bảng, thanh tìm kiếm thông minh, hỗ trợ lọc theo loại chứng từ | Không có rủi ro |
| 5 | **Tải lên & Lưu trữ** | Dialog Upload & `/api/documents/upload` | Presign, Direct Upload, SHA-256 hash, chống file trùng lặp (409), kiểm soát định dạng an toàn | Đã nâng cấp Dialog trực quan, hỗ trợ kéo thả file, tự động gán Job No và phân loại OCR | Không có rủi ro |
| 6 | **Quét & Nhận diện OCR** | `/scan`, `/scan/ocr` | Trích xuất OCR thực tế, nhận diện B/L, Shipper, Consignee, HS Code, Container | Giao diện mô phỏng tia quét laser cyan, khung bounding box số hóa | Không có rủi ro |
| 7 | **Quản lý Lô hàng** | `/shipments`, `/shipments/[id]`, `/shipments/new` | Wizard 3 bước tạo lô hàng, interactive transaction tối ưu hóa với `createMany`, idempotency | Đã xử lý triệt để các trường nullable (B/L, ETD, ETA, Customer), phân loại lô soạn dở | Không có rủi ro |
| 8 | **Lưu trữ Vật lý** | `/archive` | Quản lý thùng lưu trữ, hộp hồ sơ vật lý theo kho Tân Minh | Giao diện đồng bộ thẻ bảng dữ liệu, tìm kiếm vị trí lưu trữ nhanh | Không có rủi ro |
| 9 | **Trung tâm Cảnh báo** | `/alerts` | Phân loại khẩn cấp (high, medium, low), tính toán hạn lưu trữ, hạn bổ sung chứng từ | Đã loại bỏ hoàn toàn `ARRIVAL_NOTICE` khỏi danh mục bắt buộc theo yêu cầu nghiệp vụ | Không có rủi ro |
| 10 | **Nhật ký Kiểm toán** | `/audit` | Ghi nhận chi tiết mọi thao tác (AuditLog), thời gian thực, IP, thông số băm | Bảng hiển thị giao diện chuẩn Enterprise, lọc theo nhân sự và phân hệ | Không có rủi ro |
| 11 | **Phân quyền & Cài đặt** | `/settings`, `/settings/permissions` | Ma trận quyền Enterprise (RBAC, Explicit Deny, Department Scope, Role Admin/Manager/Staff) | Giao diện ma trận quyền trực quan, kiểm soát bảo mật đa tầng | Không có rủi ro |
| 12 | **Chia sẻ Chứng từ** | `/s/[token]` | Token bảo mật ngẫu nhiên, mật khẩu bảo vệ, giới hạn lượt xem, hết hạn tự động | Trang truy cập công khai tinh tế, bảo mật tuyệt đối không làm lộ API nội bộ | Không có rủi ro |

---

## 2. NGUYÊN TẮC BẢO TOÀN NGHIỆP VỤ ĐÃ THỰC THI

1. **Tuyệt đối không sử dụng Mock Data:** Mọi số liệu thống kê, danh sách chứng từ, lô hàng, hoạt động kiểm toán đều lấy trực tiếp từ Prisma Database và Session thật.
2. **Không thay đổi Schema ngoài phạm vi cho phép:** Các quan hệ giữa User, Role, Department, Shipment, Document được bảo lưu toàn vẹn.
3. **Bảo toàn 100% tài khoản demo:** Giữ nguyên các tài khoản thử nghiệm dành cho hội đồng đánh giá và kiểm thử viên (`admin@tml.vn`, `ha.tran@tml.vn`, `lan.pham@tml.vn` với mật khẩu `Tml@2026!`).

