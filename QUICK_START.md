# 🚀 Quick Start Guide - Hệ Thống Quản Lý Học Viên

## ⚡ Bắt Đầu Nhanh Chóng (30 giây)

### **1️⃣ Khởi động Server**

```bash
cd e:\ThayHaFullStack
node server.js
```

✅ Khi thấy: `Server running on http://localhost:3000` → Đã sẵn sàng

---

### **2️⃣ Mở Trang Admin**

1. Mở trình duyệt → `http://localhost:3000/admin/dashboard.html`
2. Hoặc mở file: `e:\ThayHaFullStack\admin\dashboard.html`
3. Đăng nhập với:
   - **Username**: `admin`
   - **Password**: `123`

✅ Dashboard mở → Hệ thống hoạt động

---

### **3️⃣ Test Thông Báo**

1. **Mở trang khác:** `http://localhost:3000/detaila.html`
2. **Điền form đăng ký:** Tên, SĐT, Khóa học
3. **Nhấp Đăng Ký**
4. **Quay lại Admin Dashboard**
5. ✅ Chờ 5 giây → Thấy thông báo popup

---

### **4️⃣ Test Xóa Học Viên**

1. Tìm học viên trong bảng
2. **Nhấp nút "Xóa"** (màu đỏ)
3. Xác nhận
4. ✅ Thành công → Học viên biến mất

---

## 📚 Tài Liệu Chi Tiết

| Tài Liệu | Nội Dung | Đọc Khi |
|---------|---------|--------|
| **IMPLEMENTATION_SUMMARY.md** | 📊 Tóm tắt các tính năng | Muốn biết được gì trong hệ thống |
| **ADMIN_NOTIFICATION_GUIDE.md** | 📖 Hướng dẫn chi tiết | Muốn hiểu cách hoạt động |
| **CODE_CHANGES_DETAIL.md** | 💻 Mã code chính xác | Muốn xem mã thay đổi |

---

## 🎯 Các Tính Năng Chính

### ✨ **Thông Báo Real-time**
- 📢 Popup + âm thanh khi có đăng ký mới
- 🔔 Badge ở header navbar
- 🔄 Tự động kiểm tra mỗi 5 giây
- ⏰ Tự động ẩn sau 6 giây

### 🗑️ **Xóa Học Viên**
- ✅ Xóa toàn bộ từ database
- ✅ Xóa từ giao diện tự động
- ✅ Xác nhận trước xóa
- ⚠️ **KHÔNG thể hoàn tác!**

### 📊 **Quản Lý Tập Trung**
- 📈 Stats cards cập nhật tự động
- 🔍 Tìm kiếm & lọc học viên
- 📋 Danh sách chi tiết
- 👤 "Học viên mới nhất" box

---

## 🔧 Thay Đổi Cấu Hình

### **Thay Đổi Tần Suất Kiểm Tra (mặc định: 5 giây)**

Tệp: `admin/dashboard.html`

Tìm dòng:
```javascript
setInterval(checkForNewRegistrations, 5000);
```

Thay `5000` thành:
- `3000` = 3 giây (nhanh)
- `10000` = 10 giây (chậm)

### **Tắt Âm Thanh Beep**

Tìm hàm `playNotificationSound()` và comment out:
```javascript
// playNotificationSound(); // ← Comment này
```

---

## 🐛 Xử Lý Sự Cố

| Vấn Đề | Giải Pháp |
|--------|---------|
| 🚫 Không thấy thông báo | Kiểm tra console (F12), làm mới trang |
| 🚫 Không nghe âm thanh | Bật volume, kiểm tra browser settings |
| 🚫 Xóa không hoạt động | Kiểm tra token JWT, DB connection |
| 🚫 Server không chạy | Kiểm tra port 3000 còn trống |
| 🚫 Database error | Kiểm tra MySQL running, user/pass đúng |

---

## 📞 Hỗ Trợ

**Kiểm tra:**
1. Console (F12) → xem error messages
2. Network tab → kiểm tra API calls
3. Terminal → xem server logs
4. MySQL → kiểm tra dữ liệu

---

## 📌 Điều Cần Nhớ

✅ Kiểm tra mỗi 5s → Hơi chậm 1 chút là bình thường  
✅ Thông báo tự động ẩn → Có thể nhấp X để ẩn ngay  
✅ Xóa học viên = xóa tất cả dữ liệu → Không thể khôi phục  
✅ Cần có token hợp lệ → Phải đăng nhập admin  
✅ Hệ thống tích hợp sẵn → Không cần cấu hình thêm  

---

## 🎯 Lộ Trình Sử Dụng

### **Ngày 1: Học Cách Sử Dụng**
1. Đọc tài liệu này
2. Xem `IMPLEMENTATION_SUMMARY.md`
3. Test các tính năng
4. Làm quen với giao diện

### **Ngày 2+: Sử Dụng Thực Tế**
1. Đợi thông báo học viên mới
2. Quản lý trạng thái đăng ký
3. Xóa học viên không phù hợp (nếu cần)
4. Theo dõi stats

---

## 💡 Mẹo & Thủ Thuật

**Mẹo 1:** Làm mới lại bảng (F5) để xem dữ liệu mới nhất  
**Mẹo 2:** Dùng Ctrl+F để tìm kiếm nhanh trong bảng  
**Mẹo 3:** Badge số ở header → Biết ngay có bao nhiêu mới  
**Mẹo 4:** Kiểm tra "Học viên mới nhất" box để xem thông tin nhanh  
**Mẹo 5:** Xóa cần cẩn thận → Nên kiểm tra kỹ trước xóa  

---

## 📊 API Reference

### **Registrations**
```
GET  /api/admin/students/registrations     → Lấy danh sách
POST /api/customers/register               → Đăng ký mới
```

### **Delete (NEW)**
```
DELETE /api/admin/customers/:customer_id   → Xóa học viên
DELETE /api/admin/registrations/:reg_id    → Xóa đơn đăng ký
```

---

## ✨ Tính Năng Nổi Bật

🌟 **Real-time Updates** - Không cần làm mới trang  
🌟 **Sound Notification** - Âm thanh beep để chú ý  
🌟 **Auto-refresh** - Kiểm tra tự động mỗi 5s  
🌟 **Notification Badge** - Hiển thị số lượng mới  
🌟 **Complete Delete** - Xóa toàn bộ dữ liệu  
🌟 **Database Sync** - Tích hợp tự động với DB  
🌟 **Security** - Yêu cầu xác nhận trước xóa  
🌟 **User Friendly** - Giao diện dễ sử dụng  

---

## 🎓 Học Tập Thêm

Các tệp trong dự án:
- `IMPLEMENTATION_SUMMARY.md` - Tóm tắt
- `ADMIN_NOTIFICATION_GUIDE.md` - Hướng dẫn
- `CODE_CHANGES_DETAIL.md` - Mã chi tiết

---

## 🎉 Hệ Thống Đã Sẵn Sàng!

**Bạn có thể bắt đầu sử dụng ngay!**

1. ✅ Khởi động server
2. ✅ Mở admin dashboard
3. ✅ Nhận thông báo đăng ký
4. ✅ Quản lý học viên

---

**Chúc bạn sử dụng vui vẻ! 🚀**

*Nếu có vấn đề, tham khảo các tài liệu chi tiết trong folder.*
