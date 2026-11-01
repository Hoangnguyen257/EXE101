# TML – TEXT MINING LIBRARY
# TASK 11: NHẬT KÝ THỰC THI KIỂM THỬ HỆ THỐNG
## (SYSTEM TEST EXECUTION LOG & EMPIRICAL EVIDENCE)

---

## 1. TỔNG QUAN THỰC THI (TEST SUMMARY)

Toàn bộ các bộ kiểm thử tự động của hệ thống TML đã được thực thi độc lập bằng Node.js v24.13.0 và TypeScript runtime (`tsx`) trên môi trường cục bộ.

| Bộ kiểm thử | File thực thi | Số Test Cases | Kết quả | Trạng thái |
| :--- | :--- | :---: | :---: | :---: |
| **Suite 1: Enterprise System & RBAC** | `tests/enterprise-system.test.ts` | 13 | 13 PASSED | **VERIFIED PASS** |
| **Suite 2: Security Audit & Refactor** | `tests/security-audit-refactor.test.ts` | 34 | 34 PASSED | **VERIFIED PASS** |
| **Suite 3: Business Integration & OCR** | `tests/business-integration.test.ts` | 33 | 33 PASSED | **VERIFIED PASS** |
| **Suite 4: Acceptance & E2E Validation** | `tests/task10-comprehensive-acceptance.test.ts` | 68 | 68 PASSED | **VERIFIED PASS** |
| **TỔNG HỢP KIỂM THỬ TỰ ĐỘNG (`npm test`)** | **Chạy liên hoàn 4 Suites** | **148** | **148 PASSED / 0 FAILED** | **VERIFIED PASS** |
| **Suite Phụ trợ: Source Verification** | `tests/comprehensive-verification.ts` | 17 | 17 PASSED | **VERIFIED PASS** |
| **Kiểm tra TypeScript (`tsc`)** | `npx tsc --noEmit` | - | 0 ERRORS | **VERIFIED PASS** |
| **Biên dịch Production (`build`)** | `npm run build` | 38 routes | SUCCESS (2.4s) | **VERIFIED PASS** |

---

## 2. NHẬT KÝ THỰC THI CHI TIẾT (RAW TERMINAL LOGS)

### 2.1. Lệnh Kiểm tra Kiểu Dữ liệu: `npx tsc --noEmit`
```text
Command: npx tsc --noEmit
Exit code: 0
Output: (Empty - Zero Type Errors)
```

---

### 2.2. Lệnh Thực thi Toàn bộ Test Suite: `npm test`
Lệnh định nghĩa trong `package.json`:
`tsx tests/enterprise-system.test.ts && tsx tests/security-audit-refactor.test.ts && tsx tests/business-integration.test.ts && tsx tests/task10-comprehensive-acceptance.test.ts`

```text
> my-project@0.1.0 test
> tsx tests/enterprise-system.test.ts && tsx tests/security-audit-refactor.test.ts && tsx tests/business-integration.test.ts && tsx tests/task10-comprehensive-acceptance.test.ts

🧪 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TỰ ĐỘNG CHO HỆ THỐNG TML LOGISTICS...

▶ [TEST GROUP 1] XÁC THỰC MẬT KHẨU & BẢO MẬT BCRYPT
  ✅ PASS: Tìm thấy tài khoản Quản trị viên (admin@tml.vn)
  ✅ PASS: Mật khẩu quản trị viên được mã hóa bcrypt và xác thực chính xác
  ✅ PASS: Đăng nhập sai mật khẩu bị từ chối chính xác

▶ [TEST GROUP 2] PHÂN QUYỀN VAI TRÒ ADMIN (TỐI CAO)
  ✅ PASS: Admin có quyền DELETE trên phân hệ DOCUMENTS
  ✅ PASS: Admin có quyền CREATE trên phân hệ USERS
  ✅ PASS: Admin có quyền VIEW toàn bộ nhật ký AUDIT

▶ [TEST GROUP 3] NGUYÊN TẮC LEAST PRIVILEGE CHO VAI TRÒ STAFF
  ✅ PASS: Staff bị CHẶN không được tạo tài khoản người dùng (USERS:CREATE)
  ✅ PASS: Staff bị CHẶN không được xem nhật ký kiểm toán hệ thống (AUDIT:VIEW)
  ✅ PASS: Staff bị CHẶN không được cấu hình hệ thống (SETTINGS:MANAGE)

▶ [TEST GROUP 4] QUY TẮC BẢO MẬT EXPLICIT DENY > ALLOW
  ✅ PASS: Khi có Explicit Deny, thao tác bị từ chối ngay lập tức

▶ [TEST GROUP 5] PHẠM VI QUYỀN QUẢN LÝ PHÒNG BAN (MANAGER)
  ✅ PASS: Manager được xem chứng từ thuộc phòng ban của mình (DOC)
  ✅ PASS: Manager bị CHẶN không được truy cập chứng từ của phòng ban khác (EXP)

▶ [TEST GROUP 6] CƠ CHẾ CHIA SẺ LIÊN PHÒNG BAN (CROSS-DEPARTMENT SHARING)
  ✅ PASS: Tài liệu chia sẻ hợp lệ được truy cập xuyên phòng ban

======================================================
TỔNG KẾT KIỂM THỬ: 13 PASSED / 0 FAILED
======================================================

================================================================================
🔒 KHỞI ĐỘNG BỘ KIỂM THỬ AN NINH BẢO MẬT & PHÂN QUYỀN TML LOGISTICS
================================================================================

▶ [GROUP 1] AUTHENTICATION & SESSION TESTS
  ✅ [PASS] Đăng nhập thành công với thông tin xác thực chính xác
  ✅ [PASS] Token session được băm SHA-256 an toàn trong database
  ✅ [PASS] Đăng nhập sai mật khẩu trả về thông báo lỗi chung
  ✅ [PASS] Email không tồn tại trả về cùng thông báo lỗi chung (chống rò rỉ tài khoản)
  ✅ [PASS] Khóa tài khoản 15 phút sau 5 lần đăng nhập thất bại
  ✅ [PASS] Tài khoản đang bị khóa không thể đăng nhập dù nhập đúng mật khẩu
  ✅ [PASS] Session mới tạo ở trạng thái hoạt động
  ✅ [PASS] revokeUserSessions thu hồi thành công phiên đăng nhập trong DB

▶ [GROUP 2] AUTHORIZATION & SCOPE TESTS
  ✅ [PASS] Admin có quyền GLOBAL tối cao trên mọi hành động
  ✅ [PASS] Manager được truy cập tài liệu thuộc phòng ban của mình (DOC)
  ✅ [PASS] Manager bị chặn không được xem tài liệu phòng ban khác (EXP)
  ✅ [PASS] Staff bị chặn không được tạo người dùng (USERS:CREATE)
  ✅ [PASS] Explicit Deny ở cấp User ghi đè quyền Role và từ chối truy cập
  ✅ [PASS] SEC-06: Thao tác DELETE không truyền Resource Context bị từ chối rõ ràng
  ✅ [PASS] SEC-06: Thao tác DOWNLOAD không truyền Resource Context bị từ chối rõ ràng
  ✅ [PASS] Tài nguyên thuộc tổ chức khác bị chặn tuyệt đối
  ✅ [PASS] getEffectivePermissions() nhất quán hoàn toàn với PermissionService.check()

▶ [GROUP 3] DOCUMENT SHARING SECURITY TESTS
  ✅ [PASS] SEC-01: Truy cập download mà không có Share Access Token hợp lệ bị từ chối
  ✅ [PASS] Mật khẩu sai không được mở khóa tài liệu
  ✅ [PASS] SEC-12: Rate limiter khóa sau 5 lần nhập sai mật khẩu liên tiếp
  ✅ [PASS] Xác thực mật khẩu chính xác bằng bcrypt
  ✅ [PASS] Share Access Token được xác minh thành công và gắn chặt với shareId
  ✅ [PASS] Share Access Token không thể sử dụng chéo cho tài liệu khác
  ✅ [PASS] Người nhận chia sẻ nội bộ có quyền VIEW tài liệu
  ✅ [PASS] SEC-07: Người nhận chia sẻ quyền VIEW bị CHẶN không được EDIT tài liệu
  ✅ [PASS] SEC-07: Người nhận chia sẻ quyền VIEW bị CHẶN không được DELETE tài liệu
  ✅ [PASS] Thu hồi liên kết chia sẻ đánh dấu isRevoked = true

▶ [GROUP 4] SYNCHRONIZATION & SSE DATA ISOLATION TESTS
  ✅ [PASS] Sự kiện chứng từ cùng phòng ban được gửi đến người dùng
  ✅ [PASS] SEC-08: Data Isolation lọc bỏ sự kiện phòng ban khác (EXP) đối với nhân viên phòng DOC
  ✅ [PASS] Admin có quyền nhận toàn bộ sự kiện đồng bộ trong tổ chức

▶ [GROUP 5] API & CSRF PROTECTION TESTS
  ✅ [PASS] Phương thức an toàn GET tự động vượt qua kiểm tra CSRF
  ✅ [PASS] SEC-11: Mutating request mang tiêu đề x-csrf-protection được xác thực hợp lệ
  ✅ [PASS] SEC-11: Mutating request có Origin khớp Host được chấp nhận
  ✅ [PASS] SEC-11: CSRF Protection từ chối Origin giả mạo

================================================================================
KẾT QUẢ KIỂM THỬ AN NINH BẢO MẬT & PHÂN QUYỀN:
TỔNG CỘNG: 34 BÀI KIỂM THỬ
THÀNH CÔNG: 34 PASSED
THẤT BẠI:   0 FAILED
================================================================================

================================================================================
📦 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TÍCH HỢP NGHIỆP VỤ & HỆ THỐNG TML LOGISTICS
================================================================================
  ✅ [PASS] Admin đăng nhập thành công
  ✅ [PASS] Manager (DOC) đăng nhập thành công
  ✅ [PASS] Staff (DOC) đăng nhập thành công

▶ [GROUP 1] BINARY MAGIC BYTES & FILE VALIDATION
  ✅ [PASS] Tập tin PDF chuẩn (%PDF-) được chấp nhận
  ✅ [PASS] Tập tin EXE/Script giả mạo đuôi .pdf bị từ chối phát hiện qua Magic Bytes
  ✅ [PASS] Tập tin PNG chuẩn (89 50 4E 47) được chấp nhận
  ✅ [PASS] Tập tin JPG chuẩn (FF D8 FF) được chấp nhận
  ✅ [PASS] Văn bản thuần mạo danh image/png bị từ chối

▶ [GROUP 2] STORAGE VAULT & CHECKSUM DEDUPLICATION
  ✅ [PASS] StorageObject lưu trữ mã băm SHA-256 chính xác
  ✅ [PASS] Hệ thống phát hiện tài liệu có trùng checksum SHA-256 trong kho

▶ [GROUP 3] OCR & LOGISTICS FIELD EXTRACTION ENGINE
  ✅ [PASS] Trích xuất chính xác Bill of Lading (B/L) Number
  ✅ [PASS] Trích xuất và chuẩn hóa số Container ISO 6346
  ✅ [PASS] Trích xuất mã Job lô hàng
  ✅ [PASS] Trích xuất số hóa đơn thương mại (Invoice No)
  ✅ [PASS] Nhận diện Cảng xếp hàng (POL: Cat Lai)
  ✅ [PASS] Nhận diện Cảng dỡ hàng (POD: Rotterdam)
  ✅ [PASS] Độ tin cậy trích xuất đạt mức cao (98%)

▶ [GROUP 4] SHIPMENTS & DOCUMENT CHECKLIST AUTOMATION
  ✅ [PASS] Tạo mới lô hàng thành công với mã Job duy nhất
  ✅ [PASS] Tự động khởi tạo đầy đủ 4 hạng mục chứng từ bắt buộc cho SEA_IMPORT
  ✅ [PASS] Các chứng từ bắt buộc ban đầu ở trạng thái MISSING
  ✅ [PASS] Lịch sử thay đổi trạng thái lô hàng được lưu vết đầy đủ trong ShipmentStatusHistory

▶ [GROUP 5] INTELLIGENT SEARCH & ACCENT TOLERANCE
  ✅ [PASS] Chuẩn hóa tiếng Việt NFD loại bỏ dấu chính xác
  ✅ [PASS] Tìm kiếm không dấu "van don duong bien" khớp tài liệu "Vận đơn đường biển"
  ✅ [PASS] Levenshtein Fuzzy: Gõ sai "Maerskk" vẫn tìm thấy "Maersk Line"
  ✅ [PASS] Tìm kiếm chính xác B/L Number trả về lô hàng phù hợp

▶ [GROUP 6] RETENTION ALERTS & DEPARTMENT ISOLATION
  ✅ [PASS] Nhân viên DOC thấy cảnh báo hết hạn của phòng ban mình
  ✅ [PASS] SEC-08: Nhân viên DOC bị CÁCH LY không thấy cảnh báo hết hạn của phòng EXP
  ✅ [PASS] Admin xem được toàn bộ cảnh báo hết hạn xuyên phòng ban trong tổ chức

▶ [GROUP 7] SYSTEM HEALTH CHECK ENDPOINT
  ✅ [PASS] Endpoint /api/health trả về HTTP 200 OK
  ✅ [PASS] Trạng thái hệ thống tổng thể: healthy
  ✅ [PASS] Database connection ping kiểm tra hoạt động tốt
  ✅ [PASS] Kho lưu trữ storage_vault có quyền đọc/ghi hợp lệ
  ✅ [PASS] Uptime và Memory metrics được báo cáo đầy đủ

▶ DỌN DẸP DỮ LIỆU KIỂM THỬ...

================================================================================
KẾT QUẢ KIỂM THỬ NGHIỆP VỤ & TÍCH HỢP TML LOGISTICS:
TỔNG CỘNG:  33 BÀI KIỂM THỬ
THÀNH CÔNG: 33 PASSED
THẤT BẠI:   0 FAILED
================================================================================

================================================================================
🛡️  TASK 10: TML INDEPENDENT ACCEPTANCE & REAL-WORLD VALIDATION SUITE
================================================================================
  ✅ [PASS] Admin đăng nhập thành công
  ✅ [PASS] Manager (DOC) đăng nhập thành công
  ✅ [PASS] Staff (DOC) đăng nhập thành công
  ✅ [PASS] Admin Auth User có role ADMIN
  ✅ [PASS] Manager Auth User có role MANAGER
  ✅ [PASS] Staff Auth User có role STAFF

▶ [PHASE 2] SECURITY RE-VALIDATION & ATTACK SIMULATIONS
  ✅ [PASS] SEC-01: Chống Token Swap - Token của Doc 1 không thể dùng cho Doc 2
  ✅ [PASS] Tạo phiên đăng nhập tạm thời
  ✅ [PASS] Phiên hoạt động bình thường trước khi thu hồi
  ✅ [PASS] SEC-03: Thu hồi phiên lập tức vô hiệu hóa token trong database
  ✅ [PASS] SEC-05: Tài khoản bị khóa 15 phút sau 5 lần nhập sai liên tiếp, từ chối cả khi đúng mật khẩu
  ✅ [PASS] SEC-08: Nhân viên phòng DOC bị CHẶN không được xem tài liệu phòng EXP
  ✅ [PASS] SEC-08: Nhân viên phòng DOC bị CHẶN không được tải tài liệu phòng EXP
  ✅ [PASS] SEC-11: Mutating request có x-csrf-protection header hợp lệ
  ✅ [PASS] SEC-11: Mutating request với Origin giả mạo bị từ chối CSRF
  ✅ [PASS] SEC-12: Rate limiter khóa client sau 5 lần nhập sai mã PIN
  ✅ [PASS] SEC-12: Client bị từ chối truy cập khi đang bị khóa rate limit

▶ [PHASE 3] OCR REAL-WORLD VALIDATION & ACCURACY BENCHMARK
  ✅ [PASS] [pdf_text_layer] Trích xuất B/L: MAEU902481920
  ✅ [PASS] [pdf_text_layer] Trích xuất Container: MSKU9081234
  ✅ [PASS] [pdf_text_layer] Trích xuất Job No: JOB-2026-101
  ✅ [PASS] [pdf_text_layer] Trích xuất Invoice No: INV-2026-081
  ✅ [PASS] [pdf_text_layer] Trích xuất POL: CAT LAI PORT, HO CHI MINH
  ✅ [PASS] [pdf_text_layer] Trích xuất POD: PORT OF ROTTERDAM, NETHERLANDS
  ✅ [PASS] [pdf_multipage_composite] Trích xuất B/L: ONEY-SGN-4412
  ✅ [PASS] [pdf_multipage_composite] Trích xuất Container: ONEU1234567
  ✅ [PASS] [pdf_multipage_composite] Trích xuất Job No: TML-SE-2026-0044
  ✅ [PASS] [pdf_multipage_composite] Trích xuất Invoice No: INV-VN-9921
  ✅ [PASS] [pdf_multipage_composite] Trích xuất POL: HAI PHONG PORT
  ✅ [PASS] [pdf_multipage_composite] Trích xuất POD: SINGAPORE PORT
  ✅ [PASS] [pdf_vietnamese] Trích xuất B/L: SGN-2026-VN88
  ✅ [PASS] [pdf_vietnamese] Trích xuất Container: TMLU7891230
  ✅ [PASS] [pdf_vietnamese] Trích xuất Job No: REF-VN-771
  ✅ [PASS] [pdf_vietnamese] Trích xuất Invoice No: INV-8822-VN
  ✅ [PASS] [pdf_vietnamese] Trích xuất POL: SHANGHAI PORT, CHINA
  ✅ [PASS] [pdf_vietnamese] Trích xuất POD: CẢNG CÁT LÁI, TP HỒ CHÍ MINH
  ✅ [PASS] [pdf_english] Trích xuất B/L: EMCU901827361
  ✅ [PASS] [pdf_english] Trích xuất Container: EMCU5544332
  ✅ [PASS] [pdf_english] Trích xuất Job No: JOB-2026-999
  ✅ [PASS] [pdf_english] Trích xuất POL: KAOHSIUNG, TAIWAN
  ✅ [PASS] [pdf_english] Trích xuất POD: LOS ANGELES, USA
  ✅ [PASS] [pdf_tabular_data] Trích xuất B/L: MSC-SGN-2026-01
  ✅ [PASS] [pdf_tabular_data] Trích xuất Container: MSCU1122334
  ✅ [PASS] [pdf_tabular_data] Trích xuất Job No: JOB-2026-TAB1
  ✅ [PASS] [noisy_ocr] Trích xuất B/L: bl-sgn-2026-noisy
  ✅ [PASS] [noisy_ocr] Trích xuất Job No: job-2026-noisy
  ✅ [PASS] [corrupted_garbage] Điểm tin cậy thấp đúng dự kiến (20%)
  ✅ [PASS] [non_logistics] Điểm tin cậy thấp đúng dự kiến (20%)

  📊 TỔNG KẾT ĐỘ CHÍNH XÁC TRÍCH XUẤT OCR LOGISTICS:
     - Số trường đánh giá đối chứng: 30
     - Số trường trích xuất chính xác: 30
     - Tỷ lệ chính xác thực tế (Accuracy): 100%

▶ [PHASE 4] INTELLIGENT SEARCH ENGINE VALIDATION & BENCHMARK
  ✅ [PASS] Tìm kiếm tiếng Việt có dấu "Vận đơn đường biển"
  ✅ [PASS] Tìm kiếm tiếng Việt không dấu "van don duong bien"
  ✅ [PASS] Fuzzy Levenshtein (D=1): "Maerskk" khớp "Maersk"
  ✅ [PASS] Tìm kiếm chính xác Job Number trả về lô hàng
  ✅ [PASS] Tìm kiếm từ khóa trong nội dung văn bản OCR ("OLED")
  ✅ [PASS] Hiệu năng tìm kiếm: 100 truy vấn trong 11ms (Trung bình: 0.11ms/query)

▶ [PHASE 5] DATABASE INTEGRITY & STORAGE VAULT VALIDATION
  ✅ [PASS] Xác thực chuẩn chữ ký PDF (%PDF-)
  ✅ [PASS] Xác thực chuẩn chữ ký PNG (89 50 4E 47)
  ✅ [PASS] Xác thực chuẩn chữ ký JPG (FF D8 FF)
  ✅ [PASS] Từ chối tập tin EXE/Script giả mạo đuôi PDF
  ✅ [PASS] Mã băm SHA-256 có độ dài chuẩn 64 ký tự hex
  ✅ [PASS] Lưu trữ vật lý thành công trong storage_vault cục bộ
  ✅ [PASS] Xóa tập tin vật lý an toàn sau khi sử dụng
  ✅ [PASS] Ràng buộc Foreign Key CASCADE: Xóa shipment tự động xóa requirement liên kết

▶ [PHASE 7] CLEAN END-TO-END USER JOURNEY VALIDATION
  ✅ [PASS] [Bước 1] Manager tạo lô hàng mới thành công
  ✅ [PASS] [Bước 2] Checklist bắt đầu ở trạng thái MISSING
  ✅ [PASS] [Bước 3] Staff tải lên chứng từ B/L thành công
  ✅ [PASS] [Bước 4] Máy chủ hoàn tất trích xuất OCR và lưu kết quả
  ✅ [PASS] [Bước 5] Checklist tự động cập nhật sang UPLOADED
  ✅ [PASS] [Bước 6] Manager phê duyệt chứng từ thành công
  ✅ [PASS] [Bước 7] Dọn dẹp dữ liệu kiểm thử E2E hoàn tất

================================================================================
TỔNG KẾT KIỂM THỬ NGHIỆM THU ĐỘC LẬP TASK 10:
TỔNG CỘNG:  68 BÀI KIỂM THỬ
THÀNH CÔNG: 68 PASSED
THẤT BẠI:   0 FAILED
================================================================================
```

---

### 2.3. Lệnh Biên dịch Next.js Production Build: `npm run build`
```text
> my-project@0.1.0 build
> next build

▲ Next.js 16.4.3 (Turbopack)
- Environments: .env

✓ Running next.config.mjs took 29ms

  Creating an optimized production build ...
✓ Compiled successfully in 2.4s
  Skipping validation of types
  Finished TypeScript config validation in 11ms ...
  Collecting page data using 11 workers ...
  Generating static pages using 11 workers (0/16) ...
✓ Generating static pages using 11 workers (16/16) in 358ms
  Finalizing page optimization ...

Route (app)
┌ ƒ /
├ ○ /_not-found
├ ƒ /alerts
├ ƒ /api/alerts
├ ƒ /api/auth/change-password
├ ƒ /api/auth/login
├ ƒ /api/auth/logout
├ ƒ /api/auth/me
├ ƒ /api/documents
├ ƒ /api/documents/[id]
├ ƒ /api/documents/[id]/delete
├ ƒ /api/documents/[id]/download
├ ƒ /api/documents/[id]/share
├ ƒ /api/documents/upload
├ ƒ /api/health
├ ƒ /api/permissions
├ ƒ /api/permissions/effective
├ ƒ /api/s/[token]/content
├ ƒ /api/s/[token]/download
├ ƒ /api/s/[token]/verify
├ ƒ /api/search
├ ƒ /api/shipments
├ ƒ /api/shipments/[id]
├ ƒ /api/sync/events
├ ƒ /api/sync/poll
├ ƒ /archive
├ ƒ /audit
├ ƒ /dashboard
├ ƒ /documents
├ ƒ /documents/[id]
├ ƒ /documents/[id]/edit
├ ○ /login
├ ƒ /s/[token]
├ ƒ /scan
├ ƒ /scan/ocr
├ ƒ /settings
├ ƒ /settings/permissions
├ ƒ /shipments
└ ƒ /shipments/[id]

○ (Static)   prerendered as static content
ƒ (Dynamic)  server-rendered on demand
```

