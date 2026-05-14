# Hướng Dẫn Sử Dụng Hệ Thống Đăng Ký Khóa Học

## 📋 Tổng Quan

Hệ thống gồm 2 trang chính:
1. **registation.html** - Trang đăng ký cho khách hàng
2. **admin/registation_admin.html** - Trang quản lý đơn đăng ký cho admin

---

## 🎯 Trang Đăng Ký Khách Hàng (registation.html)

### Cách Hoạt Động
1. Khách hàng truy cập trang `registation.html`
2. Điền các thông tin:
   - **Họ và tên** (bắt buộc)
   - **Số điện thoại** (bắt buộc)
   - **Email** (tùy chọn)
   - **Chọn khóa học** (bắt buộc): B1, B2, C, A1, A, Bổ túc
   - **Thời gian học ưa thích** (tùy chọn): Sáng, Chiều, Tối, Linh hoạt
   - **Ghi chú** (tùy chọn): Để lại thêm thông tin
3. Nhấn "Gửi Đơn Đăng Ký"
4. Nhận thông báo kết quả

### Dữ Liệu Được Lưu
- Thông tin khách hàng lưu vào bảng `customers`
- Thông tin đơn đăng ký lưu vào bảng `registrations`
- Trạng thái mặc định: `admin_status = 'new'`

### Form Validation
✓ Họ tên không để trống  
✓ Số điện thoại không để trống  
✓ Khóa học phải chọn  
✓ Phải đồng ý điều khoản  

---

## 👨‍💼 Trang Admin Quản Lý (admin/registation_admin.html)

### Yêu Cầu
- Admin phải đăng nhập thành công
- Token lưu trong `localStorage` dưới key: `admin_token`
- Truy cập từ `admin/dashboard.html` → Đơn Đăng Ký

### Các Tính Năng

#### 1. Xem Danh Sách Đơn Đăng Ký
- Hiển thị bảng với các cột:
  - ID đơn đăng ký
  - Tên khách hàng
  - Số điện thoại (click để gọi)
  - Email (click để gửi email)
  - Khóa học đã chọn
  - Trạng thái hiện tại
  - Ngày đăng ký
  - Nút hành động

#### 2. Lọc & Tìm Kiếm
```
Lọc theo trạng thái:
- Tất cả (all)
- Mới (new) - 🆕
- Đang xử lý (in_progress) - ⏳
- Hoàn tất (completed) - ✅
- Từ chối (rejected) - ❌

Tìm kiếm:
- Theo tên khách hàng
- Theo số điện thoại
```

#### 3. Xem Chi Tiết Đơn
- Click nút 👁️ (Xem)
- Hiển thị modal với đầy đủ thông tin:
  - ID đơn, trạng thái
  - Thông tin khách hàng
  - Khóa học đã chọn
  - Ghi chú của khách
  - Ghi chú của admin
  - Ngày đăng ký

#### 4. Cập Nhật Trạng Thái
- Click nút ✏️ (Sửa)
- Hiển thị modal cập nhật:
  - Chọn trạng thái mới
  - Nhập ghi chú admin
  - Click "Lưu" để cập nhật
- Trạng thái có thể chọn:
  - new (mới)
  - in_progress (đang xử lý)
  - completed (hoàn tất)
  - rejected (từ chối)

#### 5. Xóa Đơn Đăng Ký
- Click nút 🗑️ (Xóa)
- Xác nhận trước khi xóa
- Nếu khách hàng không còn đơn/tư vấn nào khác → xóa cả khách hàng

---

## 🔗 API Endpoints

### Khách Hàng Sử Dụng

**POST /api/customers/register**
```json
{
  "full_name": "Nguyễn Văn A",
  "phone": "0901234567",
  "email": "a@example.com",
  "source": "website",
  "course_id": 1,
  "course_class_id": null,
  "note": "[Khóa A] Thời gian: morning - Ghi chú ..."
}

Response:
{
  "ok": true,
  "registration_id": 123,
  "customer_id": 456
}
```

### Admin Sử Dụng

**GET /api/admin/students/registrations**
```
Header: Authorization: Bearer <token>

Response:
{
  "ok": true,
  "registrations": [
    {
      "registration_id": 1,
      "full_name": "Nguyễn Văn A",
      "phone": "0901234567",
      "email": "a@example.com",
      "course_name": "Hạng A",
      "admin_status": "new",
      "note": "...",
      "admin_note": "",
      "created_at": "2024-05-14T10:30:00Z",
      ...
    }
  ]
}
```

**POST /api/admin/registrations/:id/status**
```
Header: Authorization: Bearer <token>
Body:
{
  "admin_status": "in_progress",
  "admin_note": "Đã liên hệ, khách hỏi lịch học"
}

Response:
{
  "ok": true
}
```

**POST /api/admin/registrations/:id/delete**
```
Header: Authorization: Bearer <token>

Response:
{
  "ok": true
}
```

---

## 📊 Cấu Trúc Database

### Bảng: customers
```sql
- id: ID khách hàng
- full_name: Họ tên
- phone: Số điện thoại
- email: Email
- source: Nguồn (website, ...)
- created_at: Ngày tạo
- updated_at: Ngày cập nhật
```

### Bảng: registrations
```sql
- id: ID đơn đăng ký
- customer_id: FK → customers
- course_id: FK → courses (khóa học)
- course_class_id: FK → course_classes (lớp học, nếu có)
- registration_type: Loại (register, consult, ...)
- note: Ghi chú khách hàng
- admin_status: Trạng thái (new, in_progress, completed, rejected)
- admin_note: Ghi chú admin
- created_at: Ngày đăng ký
- updated_at: Ngày cập nhật
```

### Bảng: courses
```sql
- id: ID khóa học
- course_code: Mã khóa (A, B1, B2, C, A1, BOTUC)
- course_name: Tên khóa học
- price: Giá học
- ...
```

---

## ⚙️ Thiết Lập & Chạy

### 1. Chuẩn Bị Database
```bash
# Import database.sql vào MySQL
mysql -u root -p < database.sql

# Hoặc từ MySQL console
SOURCE database.sql;
```

### 2. Chạy Server
```bash
cd /path/to/ThayHaFullStack
node server.js
# Server sẽ chạy tại http://localhost:3000
```

### 3. Truy Cập Trang
- **Đăng ký khách hàng**: http://localhost:3000/registation.html
- **Admin quản lý**: http://localhost:3000/admin/registation_admin.html
  - Cần đăng nhập tại admin/dashboard.html trước

---

## 🐛 Xử Lý Lỗi

### Lỗi: "Không tải được danh sách khóa học"
- Kiểm tra server.js đang chạy
- Kiểm tra database connection

### Lỗi: "Đăng ký thất bại"
- Điền đầy đủ thông tin bắt buộc
- Kiểm tra kết nối internet
- Xem console browser (F12) để xem lỗi chi tiết

### Lỗi: "Vui lòng đăng nhập"
- Token hết hạn, cần đăng nhập lại
- Clear localStorage và đăng nhập lại

### Lỗi: "403 Forbidden"
- Token không hợp lệ
- Quyền admin bị hạn chế
- Kiểm tra role admin

---

## 💡 Mẹo Sử Dụng

### Cho Khách Hàng
1. Điền đúng số điện thoại để admin có thể liên hệ
2. Chọn khóa học phù hợp với nhu cầu
3. Chọn thời gian học phù hợp với lịch của bạn
4. Để lại ghi chú thêm để admin hiểu rõ nhu cầu

### Cho Admin
1. Luôn kiểm tra các đơn "new" trước tiên
2. Cập nhật trạng thái khi liên hệ khách hàng
3. Ghi chú lại tình hình thảo luận với khách
4. Chuyển sang "completed" khi khách đã ghi danh
5. Chỉ "rejected" khi khách không quan tâm hoặc hết hiệu lực

---

## 📞 Liên Hệ Hỗ Trợ

- **Hotline**: 0941 822 239
- **Email**: lexuanha280473@gmail.com
- **Địa chỉ**: km18 Song Hành Xa Lộ Hà Nội, TP. HCM

---

## 🔐 Bảo Mật

- Mật khẩu admin được mã hóa với bcrypt
- Token JWT được sử dụng cho phiên đăng nhập
- CORS được kích hoạt để cho phép request từ các domain khác (nếu cần)
- Kiểm tra quyền admin trước mỗi API

---

**Cập nhật**: 14/05/2024
