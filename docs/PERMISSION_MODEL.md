# Mô Hình Phân Quyền Hệ Thống TML DocManager (Permission Model)

Tài liệu này mô tả chi tiết kiến trúc và cơ chế phân quyền RBAC (Role-Based Access Control) kết hợp ABAC (Attribute-Based Access Control / Scope-Based) trong Hệ thống Quản lý Chứng từ Vận tải Tân Minh Logistics (TML DocManager).

---

## 1. Mục Tiêu & Nguyên Tắc Phân Quyền

Trong nghiệp vụ giao nhận vận tải (freight forwarding / logistics), luồng xử lý chứng từ diễn ra đa phòng ban (Cross-Departmental Collaboration):
- Lô hàng thường do phòng **Xuất khẩu (EXP)** hoặc **Nhập khẩu (IMP)** khởi tạo và chịu trách nhiệm chính.
- Tuy nhiên, nhân sự phòng **Chứng từ (DOC)** hoặc **Hiện trường (OPS)** thường xuyên được phân công tham gia trực tiếp để lập Bill of Lading, phát hành lệnh giao hàng (D/O), làm tờ khai hải quan, hoặc xin cấp C/O.

### Yêu Cầu Nghiệp Vụ Cốt Lõi:
1. **ADMIN (Quản trị viên / Ban Giám đốc):**
   - Toàn quyền (`ORG` scope) trên mọi tài nguyên, phòng ban, lô hàng và chứng từ trong tổ chức.
   - Quản lý cấu hình hệ thống, người dùng, vai trò và phân bổ quyền hạn.
2. **MANAGER (Trưởng phòng / Quản lý bộ phận):**
   - Quản lý toàn bộ lô hàng và chứng từ thuộc phòng ban mình phụ trách.
   - **Mô hình nhân viên phụ trách (Responsible Staff Model):** Thấy và quản lý các lô hàng/chứng từ của phòng ban khác nếu nhân viên thuộc phòng mình được phân công phụ trách (`ShipmentParticipant`).
   - Quyền hạn: VIEW, UPLOAD, EDIT, DOWNLOAD, SHARE. **Không có quyền DELETE** (chỉ ADMIN có quyền xóa trừ khi được phân quyền đặc biệt). Không truy cập Cài đặt hệ thống (`SYSTEM_CONFIG`).
3. **STAFF (Chuyên viên nghiệp vụ):**
   - Thấy và thao tác trên các lô hàng thuộc phòng ban của mình HOẶC các lô hàng được phân công phụ trách cá nhân (`assignedUserIds`).
   - Có quyền: VIEW, UPLOAD, EDIT chứng từ trong các lô hàng được phép truy cập.
   - **Không được tạo lô hàng mới** và **Không được xóa lô hàng hay chứng từ** (`DELETE`).

---

## 2. Mô Hình Phòng Ban Phụ Trách (Responsible Staff Department Model)

### Vấn đề của mô hình phân quyền theo phòng ban truyền thống (Naive Department Scoping)
Nếu chỉ kiểm tra `shipment.departmentId === user.departmentId`:
- Khi lô hàng xuất khẩu (`EXP`) do chuyên viên Chứng từ Lan (`DOC`) xử lý chứng từ:
  - Lan có thể được cấp quyền cá nhân, nhưng **Trưởng phòng Chứng từ (Hà - DOC Manager) hoàn toàn không thấy lô hàng này**.
  - Trưởng phòng DOC không thể giám sát tiến độ chứng từ của cấp dưới, không duyệt được báo cáo, dẫn đến "điểm mù quản lý" (managerial blindspot).

### Giải Pháp: Phạm Vi Mở Rộng Theo Nhân Sự Phụ Trách
TML DocManager áp dụng quy tắc 2 chiều:
1. **Theo phòng ban sở hữu (Primary Department):** Lô hàng thuộc phòng ban người dùng.
2. **Theo nhân viên phụ trách (Assigned Personnel):**
   - Với **STAFF**: Lô hàng có `ShipmentParticipant.userId === staff.id`.
   - Với **MANAGER**: Lô hàng có `ShipmentParticipant.user.departmentId === manager.departmentId` HOẶC `Shipment.createdBy.departmentId === manager.departmentId`.

Nhờ đó:
- Trưởng phòng DOC luôn bao quát được 100% công việc mà các chuyên viên DOC đang thực hiện, dù lô hàng đó thuộc phòng Xuất khẩu hay Nhập khẩu.
- Chuyên viên DOC chỉ thấy các lô hàng của phòng mình và các lô hàng mình được đích thân phân công.

---

## 3. Ma Trận Quyền Hạn Chuẩn (SSoT Role Permission Matrix)

Được định nghĩa tập trung tại `lib/auth/role-matrix.ts` và đồng bộ vào CSDL qua `prisma/seed.ts`:

| Tài nguyên (Resource) | Hành động (Action) | ADMIN (ORG) | MANAGER (DEPARTMENT) | STAFF (ASSIGNED/DEPT) |
| :--- | :--- | :---: | :---: | :---: |
| **SHIPMENT** | VIEW | Có (8) | Có (4) | Có (2) |
| | CREATE | Có | Có | Không |
| | EDIT | Có | Có | Không |
| | DELETE | Có | **Không** | Không |
| | EXPORT | Có | Có | Không |
| | ASSIGN | Có | Có | Không |
| **DOCUMENT** | VIEW | Có | Có | Có |
| | UPLOAD | Có | Có | Có |
| | EDIT | Có | Có | Có |
| | DOWNLOAD | Có | Có | Có |
| | SHARE | Có | Có | Có |
| | DELETE | Có | **Không** | Không |
| | APPROVE | Có | Có | Không |
| **SYSTEM / AUDIT** | AUDIT_VIEW | Có | Có | Không |
| | USER_MANAGE | Có | Không | Không |
| | SYSTEM_CONFIG | Có | Không | Không |

### Tổng số quyền hạn được cấp phát trong cơ sở dữ liệu:
- **ADMIN:** **84** permissions (Toàn quyền hệ thống, tất cả danh mục nghiệp vụ).
- **MANAGER:** **36** permissions (Quản lý nghiệp vụ phòng ban, không có DELETE, không có SYSTEM_CONFIG/USER_MANAGE).
- **STAFF:** **12** permissions (Thao tác chứng từ cơ bản theo phân công, không có DELETE/CREATE shipment).

---

## 4. Bộ Lọc Truy Vấn Tập Trung & Chống Rò Rỉ Dữ Liệu (Centralized Query Scoping)

Để đảm bảo tính nhất quán và triệt tiêu nguy cơ rò rỉ dữ liệu qua API hoặc Tìm kiếm (`Search`):

### 1. `buildShipmentWhereInput(user, action)` & `buildDocumentWhereInput(user, action)`
Tất cả các truy vấn danh sách (`GET /api/shipments`, `GET /api/documents`, `lib/data.ts`) đều bắt buộc đi qua bộ dựng điều kiện truy vấn tập trung tại `lib/auth/permission-service.ts`.
- **Nguyên tắc Explicit Deny:** Nếu người dùng không có quyền thực hiện hành động (ví dụ: STAFF yêu cầu bộ lọc xóa, hoặc chưa đăng nhập), hàm trả về điều kiện `{ id: '__explicit_deny__' }`. Kết quả truy vấn luôn rỗng, không thể truy cập trái phép.
- **Phân giải Scope tự động:**
  - `ORG` -> `{}` (không giới hạn phòng ban).
  - `DEPARTMENT` -> `{ OR: [{ departmentId: user.deptId }, { participants: { some: { user: { departmentId: user.deptId } } } }] }`.
  - `ASSIGNED` -> `{ OR: [{ departmentId: user.deptId }, { participants: { some: { userId: user.id } } }] }`.

### 2. Cô lập truy vấn tìm kiếm (`Safe Search Isolation`)
Trước đây, điều kiện tìm kiếm từ khóa `q` được nối lỏng lẻo ở cấp cao nhất gây nguy cơ bỏ qua điều kiện phòng ban. Hiện tại, mọi truy vấn tìm kiếm đều được đóng gói an toàn:
```typescript
whereClause = {
  AND: [
    permissionWhere, // Bộ lọc phòng ban/phân công bắt buộc
    {
      OR: [
        { jobNo: { contains: q, mode: 'insensitive' } },
        { blNo: { contains: q, mode: 'insensitive' } },
        { customerName: { contains: q, mode: 'insensitive' } },
      ]
    }
  ]
};
```
Ngay cả khi người dùng gõ từ khóa khớp chính xác với số JobNo của phòng ban khác, cơ sở dữ liệu vẫn chặn đứng và không trả về bản ghi nào.

---

## 5. Ràng Buộc Dữ Liệu Phòng Ban Của Chứng Từ (`Document.departmentId`)

- Trường `Document.departmentId` được chuyển từ kiểu `String?` (tùy chọn) sang **bắt buộc `String`** có quan hệ khóa ngoại trực tiếp tới bảng `Department`.
- Tất cả API upload (`/api/documents`, `/api/documents/upload`, `/api/documents/upload/presign`, `/api/documents/upload/confirm`) đều bắt buộc kiểm tra lô hàng mục tiêu và tự động kế thừa `departmentId` từ lô hàng. Nếu lô hàng không có phòng ban hợp lệ, yêu cầu bị từ chối với mã lỗi `400 Bad Request`.
- Dữ liệu cũ đã được đồng bộ thông qua migration SQLite và PostgreSQL:
  - `prisma/migrations/20261102_require_document_department_id/migration.sql`
  - `prisma/migrations_postgresql/20261102_require_document_department_id/migration.sql`
