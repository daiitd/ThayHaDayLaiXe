# Hướng Dẫn Sử Dụng Hệ Thống Thông Báo & Quản Lý Học Viên

## 📋 Tổng Quan

Tôi đã phát triển một hệ thống thông báo và quản lý học viên toàn diện cho trang Admin Dashboard của bạn. Hệ thống này cho phép:

1. ✅ **Thông báo real-time** khi có học viên đăng ký mới
2. ✅ **Xóa thông tin học viên** hoàn toàn khỏi hệ thống (cả database lẫn frontend)
3. ✅ **Làm mới tự động** danh sách đăng ký mỗi 5 giây
4. ✅ **Quản lý tập trung** với các hành động nhanh chóng

---

## 🔧 Các Thay Đổi Được Thực Hiện

### 1. **Backend - API Endpoints** (server.js)

#### ✨ DELETE `/api/admin/customers/:customer_id`
**Xóa hoàn toàn một học viên và tất cả dữ liệu liên quan**

- **Yêu cầu**: JWT authentication (Bearer token)
- **Tham số**: 
  - `customer_id` (số): ID của học viên cần xóa
- **Hành động**:
  - Xóa tất cả `registrations` (đơn đăng ký) của học viên
  - Xóa tất cả `consultations` (yêu cầu tư vấn) của học viên
  - Xóa thông tin `customer` từ database
- **Response**:
  ```json
  {
    "ok": true,
    "message": "Đã xóa học viên [Tên] và tất cả dữ liệu liên quan",
    "customer_name": "[Tên học viên]"
  }
  ```

#### ✨ DELETE `/api/admin/registrations/:registration_id`
**Xóa một đơn đăng ký riêng lẻ**

- **Yêu cầu**: JWT authentication
- **Tham số**: 
  - `registration_id` (số): ID của đơn đăng ký
- **Response**:
  ```json
  {
    "ok": true,
    "message": "Đã xóa đăng ký",
    "customer_id": [ID]
  }
  ```

---

### 2. **Frontend - Dashboard UI** (admin/dashboard.html)

#### 🔔 **Hệ Thống Thông Báo**

**Các loại thông báo:**

1. **Thông báo đăng ký mới** - Hiện tự động khi có học viên đăng ký
   - Hiển thị: Tên, Số điện thoại, Khóa học
   - Có âm thanh beep để thu hút chú ý
   - Tự động ẩn sau 6 giây
   - Có nút Đóng để ẩn ngay

2. **Thông báo thành công** - Khi thực hiện hành động (xóa, thêm, sửa)
   - Hiển thị biểu tượng ✓
   - Tự động ẩn sau 4 giây

3. **Thông báo lỗi** - Khi có sự cố
   - Hiển thị biểu tượng ⚠
   - Tự động ẩn sau 5 giây

#### 📊 **Badge Thông Báo**

- Có một badge màu đỏ ở header navbar "Thông báo"
- Hiển thị số lượng đơn đăng ký **"Mới"** chưa được xử lý
- Tự động cập nhật khi có học viên mới đăng ký

#### 🔄 **Làm Mới Tự Động**

- Dashboard sẽ tự động kiểm tra dữ liệu mới mỗi 5 giây
- Nếu phát hiện đăng ký mới → Hiển thị thông báo
- Cập nhật stats cards tự động
- Cập nhật "Học viên mới nhất" box

---

## 📱 Hướng Dẫn Sử Dụng

### **Xóa Một Học Viên**

**Bước 1:** Tìm học viên trong danh sách

**Bước 2:** Nhấp nút **"Xóa"** (màu đỏ) ở cột "Hành Động"

**Bước 3:** Một cửa sổ xác nhận sẽ hiện lên:
```
Bạn có chắc chắn muốn xóa đăng ký của [Tên]?
Hành động này không thể hoàn tác.
```

**Bước 4:** Nhấp **"Xóa"** để xác nhận

**Kết quả:**
- ✅ Thông báo thành công hiện lên
- ✅ Học viên bị xóa khỏi danh sách trên giao diện
- ✅ Tất cả dữ liệu của học viên bị xóa từ database:
  - Thông tin cá nhân
  - Các đơn đăng ký
  - Các yêu cầu tư vấn

### **Nhận Thông Báo Đăng Ký Mới**

**Khi có học viên từ trang detail hoặc botuc.html đăng ký:**

1. **Thông báo hiện ngay:**
   ```
   🎉 Có học viên đăng ký mới!
   
   Họ Tên: [Tên học viên]
   📞 [Số điện thoại]
   📚 [Khóa học]
   ```

2. **Có âm thanh beep** để nhắc nhở

3. **Tự động cập nhật:**
   - Học viên xuất hiện ở đầu danh sách
   - Stats cards được cập nhật
   - Badge "Thông báo" hiển thị số lượng mới
   - "Học viên mới nhất" box cập nhật

---

## 🔄 Quy Trình Làm Việc Toàn Bộ

### **Khi học viên đăng ký từ trang Detail hoặc Botuc:**

```
1. Học viên điền form → Gửi đến /api/customers/register
   ↓
2. Server lưu vào database (customers, registrations)
   ↓
3. Dashboard admin (chạy ở background) kiểm tra mỗi 5 giây
   ↓
4. Phát hiện đăng ký mới với status = 'new'
   ↓
5. Hiển thị thông báo realtime trên màn hình
   ↓
6. Admin có thể xem, quản lý, hoặc xóa
```

---

## 📋 Trạng Thái Đơn Đăng Ký

| Trạng Thái | Ý Nghĩa | Màu |
|-----------|--------|-----|
| **new** (Mới) | Vừa đăng ký, chưa xử lý | Vàng ⚠️ |
| **contacted** (Đã Liên Hệ) | Đã gọi điện thoại | Xanh 📞 |
| **in_progress** (Đang Xử Lý) | Đang xem xét hồ sơ | Xanh Lá 🔄 |
| **enrolled** (Đã Ghi Danh) | Đã nhập học | Xanh Lá ✅ |
| **rejected** (Từ Chối) | Từ chối đơn | Đỏ ❌ |

---

## ⚙️ Cấu Hình & Điều Chỉnh

### **Thay Đổi Tần Suất Kiểm Tra (mặc định: 5 giây)**

Tìm dòng này trong `admin/dashboard.html`:
```javascript
setInterval(checkForNewRegistrations, 5000); // 5000ms = 5 giây
```

Thay đổi `5000` thành:
- `3000` = 3 giây (kiểm tra thường xuyên hơn)
- `10000` = 10 giây (kiểm tra ít thường xuyên hơn)

### **Thay Đổi Thời Gian Hiển Thị Thông Báo**

Tìm dòng này:
```javascript
setTimeout(() => {
    $('.alert').fadeOut(function() { $(this).remove(); });
}, 6000); // 6000ms = 6 giây
```

Thay `6000` để điều chỉnh thời gian (tính bằng milliseconds).

---

## 🚀 Các Tính Năng Nâng Cao

### **1. Thêm Âm Thanh Thông Báo Tùy Chỉnh**

Hiện tại sử dụng Web Audio API tạo beep đơn giản. Bạn có thể thay bằng file âm thanh:

```javascript
function playNotificationSound() {
    const audio = new Audio('/assets/notification.mp3');
    audio.play().catch(e => console.log('Audio error:', e));
}
```

### **2. Gửi Thông Báo Push (nâng cao)**

Nếu bạn muốn thông báo ngay cả khi tab không active:

```javascript
if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Có học viên mới đăng ký!', {
        body: student.full_name + ' - ' + student.phone,
        icon: '/favicon.ico'
    });
}
```

---

## 🛡️ Tính Năng Bảo Mật

1. **Yêu cầu JWT Token**: Tất cả API endpoint đều cần authentication
2. **Kiểm tra quyền**: Chỉ admin đã đăng nhập mới có thể xóa
3. **Xác nhận trước khi xóa**: Cửa sổ modal yêu cầu xác nhận
4. **Ghi log**: Server ghi lại tất cả hành động xóa

---

## 📊 Database Impact

Khi xóa một học viên:

### Trước khi xóa:
```sql
SELECT * FROM customers WHERE id = 5;  -- 1 bản ghi
SELECT * FROM registrations WHERE customer_id = 5;  -- N bản ghi
SELECT * FROM consultations WHERE customer_id = 5;  -- M bản ghi
```

### Sau khi xóa:
```sql
-- Tất cả bị xóa hoàn toàn, không còn dấu vết
```

⚠️ **Cảnh báo**: Hành động này không thể hoàn tác! Dữ liệu bị xóa sẽ mất vĩnh viễn trừ khi bạn có backup.

---

## 🐛 Xử Lý Sự Cố

### **Vấn đề: Không nhận được thông báo**

**Nguyên nhân & Giải pháp:**
1. Kiểm tra server.js đang chạy: `node server.js`
2. Kiểm tra database connection
3. Kiểm tra Bearer token hợp lệ
4. Mở DevTools (F12) để xem console errors

### **Vấn đề: Thông báo âm thanh không phát**

**Nguyên nhân & Giải pháp:**
1. Browser phải cho phép âm thanh
2. Kiểm tra mute/volume hệ thống
3. Một số browser yêu cầu user tương tác trước khi phát âm

### **Vấn đề: Xóa không hoạt động**

**Nguyên nhân & Giải pháp:**
1. Kiểm tra console error (F12)
2. Đảm bảo token JWT còn hợp lệ
3. Kiểm tra quyền admin trong database
4. Xem network tab để kiểm tra API response

---

## 📝 Tóm Tắt API

| Phương Pháp | Endpoint | Mục Đích |
|----------|----------|---------|
| POST | `/api/customers/register` | Học viên đăng ký |
| DELETE | `/api/admin/customers/:id` | Xóa học viên |
| DELETE | `/api/admin/registrations/:id` | Xóa đơn đăng ký |
| GET | `/api/admin/students/registrations` | Lấy danh sách |

---

## 🎯 Kỳ Vọng & Tiếp Theo

**Tính năng có thể thêm:**
- [ ] Export danh sách học viên thành Excel
- [ ] Gửi SMS/Email thông báo tự động
- [ ] Dashboard phân tích thống kê
- [ ] Quản lý lịch dạy & điểm danh
- [ ] Hệ thống thanh toán học phí

---

## 📞 Hỗ Trợ

Nếu có vấn đề:
1. Kiểm tra console.log() trong browser
2. Kiểm tra server logs trong terminal
3. Xem database trực tiếp bằng MySQL client

---

**Hệ thống quản lý học viên đã sẵn sàng sử dụng!** 🎉
