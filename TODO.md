# TODO

- [x] Sửa `botuc.html` để form “bổ túc/BOTUC” gửi đúng payload khớp backend `/api/customers/register`.
- [x] Trong `botuc.html`: dùng `API_BASE = location.origin`.
- [x] Trong `botuc.html`: xóa `registration_type` khỏi payload (backend tự set).
- [x] Trong `botuc.html`: nếu không tìm thấy `course_code='BOTUC'` thì alert chi tiết.
- [ ] Chạy test: mở `botuc.html`, submit form, kiểm tra response ok=true và bản ghi vào CSDL (registrations/customers).
- [ ] (Nếu còn lỗi) kiểm tra log server và đối chiếu schema `thayha_admin.sql`.




