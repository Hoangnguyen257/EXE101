# 🔒 CẢNH BÁO BẢO MẬT & HƯỚNG DẪN THU HỒI SECRET, LÀM SẠCH LỊCH SỬ GIT (GIT FILTER-REPO)

> **CẤP ĐỘ KHẨN CẤP: BẮT BUỘC THỰC HIỆN TRƯỚC KHI GO-LIVE HOẶC VẬN HÀNH THẬT**

---

## 1. Thông Báo Khẩn Cấp Về Secret & Mật Khẩu Khởi Tạo

1. **Khóa ký số JWT (`JWT_SECRET`) cũ đã bị lộ:**
   - Giá trị fallback trước đây (`tml-enterprise-super-secure-jwt-secret-key-min-32-chars-2026`) đã xuất hiện trong mã nguồn và lịch sử commit cũ.
   - **Mã nguồn hiện tại đã loại bỏ hoàn toàn khóa fallback hardcode này.** Nếu thiếu biến môi trường `JWT_SECRET` hoặc ngắn hơn 32 ký tự, ứng dụng sẽ **từ chối khởi động ngay lập tức** với lỗi `FATAL SECURITY CONFIGURATION ERROR`.
   - **BẮT BUỘC:** Toàn bộ máy chủ Production (Vercel, VPS, Docker, v.v.) phải tạo một chuỗi khóa bí mật mới hoàn toàn độc lập và bảo mật.

2. **Tạo chuỗi `JWT_SECRET` mới an toàn:**
   Chạy lệnh sau trên terminal của máy chủ hoặc máy phát triển để sinh secret ngẫu nhiên chuẩn 256-bit:
   ```bash
   openssl rand -base64 48
   ```
   Sao chép giá trị tạo ra và cấu hình vào biến môi trường:
   - **Trên Vercel:** Vào **Project Settings -> Environment Variables**, đặt `JWT_SECRET = <giá_trị_mới>`.
   - **Trên VPS / Docker:** Khai báo vào file `.env` trên máy chủ (không commit lên Git).

3. **Mật khẩu dùng chung `Tml@2026!` đã bị loại bỏ:**
   - Cơ chế Seed production (`npm run db:seed`) hiện tại **chỉ tạo duy nhất 1 tài khoản Quản trị viên (`admin@tml.vn`)** với mật khẩu ngẫu nhiên độ dài 20 ký tự, chỉ in ra một lần duy nhất tại log màn hình.
   - Cột `mustChangePassword` được thiết lập `true`, buộc Admin phải đổi mật khẩu tại trang `/change-password` ngay lần đăng nhập đầu tiên.

---

## 2. Hướng Dẫn Làm Sạch Lịch Sử Git Bằng `git-filter-repo`

Mặc dù các tệp `prisma/dev.db`, `storage_vault/`, `backups/`, `*.zip`, `tsconfig.tsbuildinfo` đã được gỡ khỏi git index (`git rm --cached`) và đưa vào `.gitignore`, chúng vẫn còn lưu vết trong các commit trước đó của kho Git.

Để xóa vĩnh viễn các tệp nhị phân và dữ liệu nhạy cảm khỏi toàn bộ lịch sử Git của repository, thực hiện theo các bước chuẩn sau:

### Bước 1: Sao lưu mã nguồn
```bash
# Tạo bản sao lưu toàn bộ thư mục dự án đề phòng sự cố
cp -r tml-doc-manager-development tml-doc-manager-backup
cd tml-doc-manager-development
```

### Bước 2: Cài đặt công cụ `git-filter-repo`
Yêu cầu máy có cài sẵn Python 3.
```bash
pip install git-filter-repo
```

### Bước 3: Thực hiện thanh lọc lịch sử Git
Chạy lệnh sau để xóa sạch các tệp nhạy cảm khỏi mọi commit trong lịch sử:
```bash
git filter-repo --invert-paths \
  --path prisma/dev.db \
  --path-glob 'storage_vault/*' \
  --path-glob 'backups/*' \
  --path-glob '*.zip' \
  --path tsconfig.tsbuildinfo \
  --path .env
```

### Bước 4: (Tùy chọn) Che giấu chuỗi secret cũ trong commit messages hoặc diff
Tạo tệp `replace-secret.txt`:
```text
tml-enterprise-super-secure-jwt-secret-key-min-32-chars-2026==>REDACTED_EXPOSED_KEY_DO_NOT_USE
Tml@2026!==>REDACTED_DEFAULT_PASSWORD
```
Chạy lệnh thay thế văn bản:
```bash
git filter-repo --replace-text replace-secret.txt
rm replace-secret.txt
```

### Bước 5: Cấu hình lại remote và Force Push lên Repository
Sau khi chạy `git filter-repo`, Git sẽ tự động gỡ remote cũ để tránh vô tình push đè. Cấu hình lại remote và đẩy lên GitHub:
```bash
# Thêm lại remote origin
git remote add origin https://github.com/Hoangnguyen257/EXE101.git

# Đẩy lịch sử đã làm sạch lên remote (yêu cầu quyền force push trên nhánh main)
git push origin --force --all
git push origin --force --tags
```

---

## 3. Quy Trình Khởi Tạo Dữ Liệu Sạch Cho Môi Trường Production

1. Chạy migration trên cơ sở dữ liệu:
   ```bash
   npx prisma migrate deploy
   ```
2. Khởi tạo tài khoản Quản trị viên duy nhất (Seed sạch):
   ```bash
   npm run db:seed
   ```
3. Lưu lại thông tin Admin được in ra trên terminal:
   - Email: `admin@tml.vn`
   - Mật khẩu ngẫu nhiên (chỉ xuất hiện 1 lần)
4. Đăng nhập tại `/login`, hệ thống sẽ tự động chuyển hướng sang `/change-password` để thiết lập mật khẩu cá nhân mới trước khi mở quyền sử dụng hệ thống.
