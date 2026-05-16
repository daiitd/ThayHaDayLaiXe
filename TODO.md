# TODO - Fix admin consultation không hiện / không chỉnh sửa được

- [ ] Đọc kỹ luồng auth/token và UI trong `admin/consultation.html`.
- [ ] Sửa `admin/consultation.html`:
  - [ ] Cải thiện hàm lấy token (thử thêm key khác + đảm bảo không rỗng).
  - [ ] Khi `loadAll()` / `patchStatus()` thất bại, hiện toast + console log rõ `status`/`data.message`.
  - [ ] Trong `openEditModal(id)`, nếu không tìm thấy bản ghi thì show toast hướng dẫn bấm "Làm mới".
- [ ] (Nếu cần) Sửa `server.js` để đảm bảo route/status field khớp UI (chỉ khi debug cho thấy mismatch).
- [ ] Chạy `node server.js` và test:
  - [ ] Login admin -> vào trang consultation -> bấm Làm mới.
  - [ ] Mở modal xem -> bấm Chỉnh sửa -> sửa trạng thái/ghi chú -> Lưu.

