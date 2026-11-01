# TML – TEXT MINING LIBRARY
## BÁO CÁO KẾT QUẢ KIỂM THỬ THỰC TẾ (SYSTEM TEST EXECUTION REPORT)

---

### 1. TỔNG KẾT KẾT QUẢ THỰC THI (EXECUTIVE SUMMARY)

Đợt kiểm thử độc lập toàn diện được thực thi trực tiếp trên mã nguồn hệ thống TML Logistics. Toàn bộ các bộ kiểm thử đã được chạy và hoàn thành với kết quả xuất sắc:

| Nhóm kiểm thử | File thực thi | Tổng số Test Cases | Số lượng PASSED | Số lượng FAILED | Tỷ lệ thành công |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Suite 1: Phân quyền & RBAC Doanh nghiệp** | `tests/enterprise-system.test.ts` | 13 | 13 | 0 | **100%** |
| **Suite 2: An ninh Bảo mật & Khắc phục Lỗ hổng** | `tests/security-audit-refactor.test.ts` | 34 | 34 | 0 | **100%** |
| **Suite 3: Tích hợp Nghiệp vụ, OCR & Storage** | `tests/business-integration.test.ts` | 33 | 33 | 0 | **100%** |
| **TỔNG CỘNG HỆ THỐNG** | `npm test` | **80** | **80** | **0** | **100%** |

---

### 2. KẾT QUẢ CHI TIẾT THEO TỪNG BỘ KIỂM THỬ

#### 2.1. Suite 1: Enterprise System & RBAC (`enterprise-system.test.ts` - 13/13 PASS)
- [x] **TEST 1.1:** Tìm thấy tài khoản Quản trị viên (`admin@tml.vn`) trong cơ sở dữ liệu.
- [x] **TEST 1.2:** Mật khẩu quản trị viên được mã hóa bcrypt và xác thực chính xác.
- [x] **TEST 1.3:** Đăng nhập sai mật khẩu bị từ chối chính xác.
- [x] **TEST 2.1:** Quản trị viên có quyền `DOCUMENTS:DELETE` trên toàn tổ chức.
- [x] **TEST 2.2:** Quản trị viên có quyền `USERS:CREATE` trên toàn tổ chức.
- [x] **TEST 2.3:** Quản trị viên có quyền xem toàn bộ nhật ký `AUDIT:VIEW`.
- [x] **TEST 3.1:** Nhân viên (Staff) bị CHẶN không được tạo tài khoản (`USERS:CREATE`).
- [x] **TEST 3.2:** Nhân viên bị CHẶN không được xem nhật ký kiểm toán hệ thống (`AUDIT:VIEW`).
- [x] **TEST 3.3:** Nhân viên bị CHẶN không được cấu hình hệ thống (`SETTINGS:MANAGE`).
- [x] **TEST 4.1:** Quy tắc bảo mật Explicit Deny ghi đè Allow: khi có Deny, thao tác bị chặn ngay.
- [x] **TEST 5.1:** Quản lý (Manager) được xem chứng từ thuộc phòng ban của mình (DOC).
- [x] **TEST 5.2:** Quản lý bị CHẶN không được truy cập chứng từ của phòng ban khác (EXP).
- [x] **TEST 6.1:** Cơ chế chia sẻ liên phòng ban (Cross-department Sharing) hoạt động chính xác khi có cấp quyền.

---

#### 2.2. Suite 2: Security Audit & Vulnerability Fixes (`security-audit-refactor.test.ts` - 34/34 PASS)
- [x] **SEC-AUTH 1:** Đăng nhập thành công với thông tin xác thực chính xác.
- [x] **SEC-AUTH 2:** Token session được băm SHA-256 an toàn trong bảng `Session`.
- [x] **SEC-AUTH 3:** Đăng nhập sai mật khẩu trả về thông báo lỗi chung chống dò tìm (User Enumeration).
- [x] **SEC-AUTH 4:** Email không tồn tại trả về cùng thông báo lỗi chung.
- [x] **SEC-AUTH 5 (SEC-05):** Khóa tài khoản 15 phút sau 5 lần đăng nhập thất bại liên tiếp.
- [x] **SEC-AUTH 6 (SEC-05):** Tài khoản đang bị khóa không thể đăng nhập dù nhập đúng mật khẩu.
- [x] **SEC-AUTH 7:** Session mới tạo ở trạng thái hoạt động (`revokedAt IS NULL`).
- [x] **SEC-AUTH 8 (SEC-03):** `revokeUserSessions` thu hồi thành công toàn bộ phiên làm việc trong database.
- [x] **SEC-SCOPE 1:** Admin có quyền GLOBAL tối cao trên mọi hành động.
- [x] **SEC-SCOPE 2:** Manager được truy cập tài liệu thuộc phòng ban của mình (DOC).
- [x] **SEC-SCOPE 3:** Manager bị chặn không được xem tài liệu phòng ban khác (EXP).
- [x] **SEC-SCOPE 4:** Staff bị chặn không được tạo người dùng (`USERS:CREATE`).
- [x] **SEC-SCOPE 5:** Explicit Deny ở cấp User ghi đè quyền Role và từ chối truy cập.
- [x] **SEC-SCOPE 6 (SEC-06):** Thao tác DELETE không truyền Resource Context bị từ chối rõ ràng.
- [x] **SEC-SCOPE 7 (SEC-06):** Thao tác DOWNLOAD không truyền Resource Context bị từ chối rõ ràng.
- [x] **SEC-SCOPE 8:** Tài nguyên thuộc tổ chức khác bị chặn tuyệt đối (Multi-tenancy isolation).
- [x] **SEC-SCOPE 9:** `getEffectivePermissions()` nhất quán hoàn toàn với `PermissionService.check()`.
- [x] **SEC-SHARE 1 (SEC-01):** Truy cập download không có Share Access Token hợp lệ bị từ chối.
- [x] **SEC-SHARE 2:** Mật khẩu liên kết chia sẻ sai không được mở khóa tài liệu.
- [x] **SEC-SHARE 3 (SEC-12):** Rate limiter khóa sau 5 lần nhập sai mã PIN chia sẻ.
- [x] **SEC-SHARE 4:** Xác thực mật khẩu chia sẻ chính xác bằng bcrypt.
- [x] **SEC-SHARE 5:** Share Access Token được xác minh thành công và gắn chặt với `shareId`.
- [x] **SEC-SHARE 6:** Share Access Token không thể sử dụng chéo cho tài liệu khác (Anti-token swap).
- [x] **SEC-SHARE 7:** Người nhận chia sẻ nội bộ có quyền VIEW tài liệu.
- [x] **SEC-SHARE 8 (SEC-07):** Người nhận chia sẻ quyền VIEW bị CHẶN không được EDIT tài liệu.
- [x] **SEC-SHARE 9 (SEC-07):** Người nhận chia sẻ quyền VIEW bị CHẶN không được DELETE tài liệu.
- [x] **SEC-SHARE 10:** Thu hồi liên kết chia sẻ đánh dấu `isRevoked = true` vô hiệu hóa ngay lập tức.
- [x] **SEC-SYNC 1:** Sự kiện chứng từ cùng phòng ban được gửi đến người dùng qua SSE.
- [x] **SEC-SYNC 2 (SEC-08):** Data Isolation lọc bỏ sự kiện phòng ban khác (EXP) đối với nhân viên phòng DOC.
- [x] **SEC-SYNC 3:** Admin có quyền nhận toàn bộ sự kiện đồng bộ trong tổ chức.
- [x] **SEC-CSRF 1:** Phương thức an toàn GET tự động vượt qua kiểm tra CSRF.
- [x] **SEC-CSRF 2 (SEC-11):** Mutating request mang tiêu đề `x-csrf-protection: 1` được chấp nhận.
- [x] **SEC-CSRF 3 (SEC-11):** Mutating request có Origin khớp Host được chấp nhận.
- [x] **SEC-CSRF 4 (SEC-11):** Mutating request có Origin giả mạo bị từ chối 403 Forbidden.

---

#### 2.3. Suite 3: Business Integration, OCR & Storage (`business-integration.test.ts` - 33/33 PASS)
- [x] **BUS-MAGIC 1:** Tập tin PDF chuẩn (`%PDF-`) được xác thực qua Magic Bytes.
- [x] **BUS-MAGIC 2:** Tập tin EXE/Script giả mạo đuôi `.pdf` bị phát hiện và từ chối.
- [x] **BUS-MAGIC 3:** Tập tin PNG chuẩn (`89 50 4E 47`) được chấp nhận.
- [x] **BUS-MAGIC 4:** Tập tin JPG chuẩn (`FF D8 FF`) được chấp nhận.
- [x] **BUS-MAGIC 5:** Văn bản thuần mạo danh `image/png` bị từ chối.
- [x] **BUS-STORAGE 1:** `StorageObject` lưu trữ mã băm SHA-256 chính xác của file nhị phân.
- [x] **BUS-STORAGE 2:** Hệ thống phát hiện tài liệu có trùng checksum SHA-256 trong kho lưu trữ (Deduplication).
- [x] **BUS-OCR 1:** Trích xuất chính xác Bill of Lading (B/L) Number (`BL-SGN-2026-8899`).
- [x] **BUS-OCR 2:** Trích xuất và chuẩn hóa số Container ISO 6346 (`TMLU 458921-3` -> `TMLU4589213`).
- [x] **BUS-OCR 3:** Trích xuất mã Job lô hàng (`JOB-2026-904`).
- [x] **BUS-OCR 4:** Trích xuất số hóa đơn thương mại Commercial Invoice (`INV-2026-VN-4401`).
- [x] **BUS-OCR 5:** Nhận diện Cảng xếp hàng (POL: `CAT LAI PORT, HO CHI MINH`).
- [x] **BUS-OCR 6:** Nhận diện Cảng dỡ hàng (POD: `PORT OF ROTTERDAM, NETHERLANDS`).
- [x] **BUS-OCR 7:** Độ tin cậy trích xuất đạt mức rất cao (98%).
- [x] **BUS-SHIP 1:** Tạo mới lô hàng thành công với mã Job duy nhất.
- [x] **BUS-SHIP 2:** Tự động khởi tạo đầy đủ 4 hạng mục chứng từ bắt buộc (`BL`, `INVOICE`, `PACKING_LIST`, `CUSTOMS`).
- [x] **BUS-SHIP 3:** Các chứng từ bắt buộc ban đầu ở trạng thái `MISSING`.
- [x] **BUS-SHIP 4:** Lịch sử thay đổi trạng thái lô hàng được lưu vết đầy đủ trong `ShipmentStatusHistory`.
- [x] **BUS-SEARCH 1:** Chuẩn hóa tiếng Việt NFD loại bỏ dấu chính xác (`van don duong bien cat lai`).
- [x] **BUS-SEARCH 2:** Tìm kiếm không dấu `"van don duong bien"` khớp tài liệu *"Vận đơn đường biển"*.
- [x] **BUS-SEARCH 3:** Thuật toán Levenshtein Fuzzy: Gõ sai `"Maerskk"` vẫn tìm thấy *"Maersk Line"*.
- [x] **BUS-SEARCH 4:** Tìm kiếm chính xác B/L Number trả về lô hàng phù hợp.
- [x] **BUS-ALERT 1:** Nhân viên DOC thấy cảnh báo hết hạn của phòng ban mình.
- [x] **BUS-ALERT 2:** Nhân viên DOC bị CÁCH LY không thấy cảnh báo hết hạn của phòng EXP.
- [x] **BUS-ALERT 3:** Quản trị viên Admin xem được toàn bộ cảnh báo hết hạn xuyên phòng ban trong tổ chức.
- [x] **BUS-HEALTH 1:** Endpoint `/api/health` trả về HTTP 200 OK.
- [x] **BUS-HEALTH 2:** Trạng thái hệ thống tổng thể đạt `healthy`.
- [x] **BUS-HEALTH 3:** Kết nối cơ sở dữ liệu (`prisma.$queryRaw`) ping hoạt động tốt với độ trễ thấp.
- [x] **BUS-HEALTH 4:** Kho lưu trữ `storage_vault` có quyền đọc/ghi nhị phân hợp lệ.
- [x] **BUS-HEALTH 5:** Uptime máy chủ và thông số RAM (RSS, Heap Used) được báo cáo đầy đủ.

---

### 3. KIỂM TRA BIÊN DỊCH VÀ ĐÓNG GÓI SẢN PHẨM

1. **TypeScript Type Check:**
   - Lệnh: `npx tsc --noEmit`
   - Kết quả: **0 errors**, hoàn thành xuất sắc.
2. **Next.js Production Build:**
   - Lệnh: `npm run build`
   - Động cơ: Next.js 16.4.3 (Turbopack)
   - Kết quả: **Compiled successfully in 4.9s**, toàn bộ 38 routes và API endpoints sẵn sàng phục vụ.

