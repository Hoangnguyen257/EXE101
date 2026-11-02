# TML DOCMANAGER – TASK 16 DESIGN SYSTEM SPECIFICATION
## GLOBAL DESIGN SYSTEM: PREMIUM ENTERPRISE SAAS × INTELLIGENT DOCUMENT VAULT

---

## 1. TRIẾT LÝ THIẾT KẾ (DESIGN PHILOSOPHY)

Hệ thống thiết kế của **TML DocManager** được xây dựng dựa trên giao điểm giữa:
1. **Intelligent Document Vault:** Lấy chứng từ Logistics làm đối tượng trung tâm; mọi tài liệu số hóa đều mang tính bảo chứng pháp lý, độ tin cậy cao và an ninh ISO 27001.
2. **Premium Enterprise SaaS:** Tối giản, tập trung vào hiệu suất công việc, phân cấp thông tin rõ ràng, không sử dụng hiệu ứng màu mè làm giảm năng suất xử lý dữ liệu của người dùng.

---

## 2. BẢNG MÀU CHUẨN THƯƠNG HIỆU (GLOBAL COLOR TOKENS)

Hệ màu được tích hợp trực tiếp vào CSS Variables tại `app/globals.css`:

| Token Name | Hex Code | HSL / OKLCH tương đương | Mục đích sử dụng |
| :--- | :---: | :--- | :--- |
| `--tml-primary` | `#0875E8` | `oklch(0.53 0.2 260)` | Màu xanh nhận diện thương hiệu TML, nút hành động chính, liên kết, focus ring |
| `--tml-navy` | `#07182F` | `oklch(0.18 0.04 255)` | Tiêu đề chính, văn bản cấp cao, không gian Intro điện ảnh |
| `--tml-dark-blue` | `#0B2D59` | `oklch(0.25 0.08 255)` | Đường viền tối, thanh bên (Sidebar), điểm nhấn chiều sâu |
| `--tml-orange` | `#F59E0B` | `oklch(0.75 0.18 65)` | Dải cung vòng tròn logo TML, cảnh báo, nhãn ghi chú đặc biệt |
| `--tml-bg` | `#F5F8FC` | `oklch(0.985 0.005 255)` | Nền toàn bộ ứng dụng Light Premium, nền Form đăng nhập |
| `--tml-surface` | `#FFFFFF` | `oklch(1 0 0)` | Mặt thẻ (Card), bảng dữ liệu (Table), hộp thoại (Modal) |
| `--tml-border` | `#E2E8F0` | `oklch(0.92 0.01 255)` | Đường phân cách, viền input, viền bảng |
| `--tml-text-primary` | `#1E293B` | `oklch(0.25 0.03 260)` | Văn bản nội dung chính, dữ liệu bảng |
| `--tml-text-secondary` | `#64748B` | `oklch(0.52 0.03 260)` | Văn bản phụ, chú thích, nhãn mô tả |

---

## 3. HỆ THỐNG TYPOGRAPHY

Dự án sử dụng bộ font chuẩn hỗ trợ tiếng Việt hoàn hảo:
- **Font gia đình:** `Be Vietnam Pro` (Sans-serif) kết hợp `Geist Mono` cho các mã số chuyên ngành (Job No, B/L No, HS Code, Container No, Tax ID, Checksum SHA-256).
- **Phân cấp kiểu chữ:**
  - **Display Title (Login/Welcome):** `text-2xl font-bold tracking-tight text-slate-900`
  - **Page Title:** `text-xl font-bold text-slate-900 dark:text-white`
  - **Section Title / Card Title:** `text-base font-bold text-slate-900`
  - **Body Text:** `text-xs md:text-sm text-slate-700 leading-normal`
  - **Metadata & Labels:** `text-[11px] font-semibold text-slate-500 uppercase tracking-wider`
  - **Code & Identifier:** `font-mono text-xs font-bold text-[#0875E8]`

---

## 4. QUY TẮC HÌNH HỌC & BO GÓC (RADIUS & ELEVATION)

- **Bo góc thẻ chính (Cards & Panels):** `rounded-2xl` ($16\text{px}$) tạo cảm giác tờ giấy hồ sơ cao cấp, mềm mại và hiện đại.
- **Bo góc nút bấm & Input:** `rounded-lg` ($8\text{px}$) hoặc `rounded-xl` ($12\text{px}$) cho nút hành động chính.
- **Bóng đổ (Shadows):**
  - Card tiêu chuẩn: `shadow-xs` hoặc `shadow-[0_4px_16px_rgba(0,0,0,0.04)]`.
  - Tờ chứng từ 3D nổi: `shadow-[0_20px_50px_-12px_rgba(10,30,60,0.15)]`.
  - Focus Ring: `ring-2 ring-[#0875E8]/40 ring-offset-1`.

---

## 5. THIẾT KẾ GIAO DIỆN TƯƠNG TÁC (MICRO-INTERACTIONS)

1. **Input Fields:**
   - Bình thường: Viền `#E2E8F0`, nền `#F8FAFC`.
   - Hover: Viền `#CBD5E1`.
   - Focus: Viền `#0875E8`, vòng phát sáng xanh dịu `ring-2 ring-blue-500/20`.
   - Lỗi: Viền đỏ `#EF4444`, nền hồng nhạt `#FEF2F2`.
2. **Nút bấm Primary (Sign In / Tải lên / Xác nhận):**
   - Màu nền gradient nhẹ từ `#0875E8` sang `#0661c4`.
   - Khi rê chuột (Hover): Độ sáng tăng nhẹ, bóng đổ xanh mềm.
   - Khi bấm (Active): Thu nhỏ tỉ lệ tinh tế `scale-[0.99]`.
   - Khi hoàn tất (Success): Chuyển sắc thái xanh lá ngọc lục bảo `bg-emerald-600` với nhãn `ACCESS GRANTED`.

---

## 6. QUY TẮC RESPONSIVE TOÀN HỆ THỐNG

- **Desktop ($\ge 1280\text{px}$):**
  - Form chứng từ hiển thị ở vị trí trung tâm chuẩn $440\text{px}$ với chiều sâu 3D đầy đủ.
  - Dashboard chia grid 3 cột (2 cột danh sách lô hàng & hoạt động, 1 cột cảnh báo ưu tiên).
- **Laptop / Tablet ($768\text{px} - 1024\text{px}$):**
  - Giảm góc nghiêng 3D của chứng từ về góc nhìn trực diện ($0^\circ - 4^\circ$).
  - Sidebar có thể thu gọn (collapsible icon mode), Dashboard chuyển grid 2 cột tự co giãn.
- **Mobile ($< 768\text{px}$):**
  - Form chứng từ mở rộng chiếm `w-full max-w-[440px]`, lề $16\text{px}$.
  - Chuyển động 3D giảm nhẹ góc xoay để tối ưu hóa góc nhìn và hiệu năng vi xử lý di động.
  - Sidebar chuyển thành ngăn kéo trượt (Mobile Drawer), đảm bảo $100\%$ không phát sinh cuộn ngang (horizontal overflow).

