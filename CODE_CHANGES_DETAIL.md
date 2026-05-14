# 📝 Chi Tiết Các Thay Đổi Mã Code

## File 1: server.js - Thêm API Endpoints

### **Vị trí:** Trước `// ---- Debug (admin/dev only) ----`

### **Thêm 2 DELETE endpoints mới:**

#### ✅ Endpoint 1: DELETE /api/admin/customers/:customer_id

```javascript
/**
 * DELETE /api/admin/customers/:customer_id
 * Xóa một học viên và tất cả dữ liệu liên quan (registrations, consultations)
 * Requires: JWT authentication
 */
app.delete('/api/admin/customers/:customer_id', authMiddleware, async (req, res) => {
  try {
    const customerId = Number(req.params.customer_id);
    if (!customerId) return sendError(res, 400, 'Invalid customer_id');

    // 1) Kiểm tra customer tồn tại
    const [checkCustomer] = await db.query(
      'SELECT id, full_name FROM customers WHERE id = :id LIMIT 1',
      { id: customerId }
    );

    if (!checkCustomer.length) {
      return sendError(res, 404, 'Customer not found');
    }

    const customerName = checkCustomer[0].full_name;

    // 2) Xóa tất cả registrations của customer này
    await db.query(
      'DELETE FROM registrations WHERE customer_id = :customer_id',
      { customer_id: customerId }
    );

    // 3) Xóa tất cả consultations của customer này
    await db.query(
      'DELETE FROM consultations WHERE customer_id = :customer_id',
      { customer_id: customerId }
    );

    // 4) Xóa customer
    await db.query(
      'DELETE FROM customers WHERE id = :id',
      { id: customerId }
    );

    res.json({ 
      ok: true, 
      message: `Đã xóa học viên ${customerName} và tất cả dữ liệu liên quan`,
      customer_name: customerName
    });
  } catch (e) {
    console.error('Delete customer error:', e);
    sendError(res, 500, 'Server error');
  }
});
```

#### ✅ Endpoint 2: DELETE /api/admin/registrations/:registration_id

```javascript
/**
 * DELETE /api/admin/registrations/:registration_id
 * Xóa một đơn đăng ký (nếu không có học viên nào khác, có thể xóa customer luôn)
 * Requires: JWT authentication
 */
app.delete('/api/admin/registrations/:registration_id', authMiddleware, async (req, res) => {
  try {
    const registrationId = Number(req.params.registration_id);
    if (!registrationId) return sendError(res, 400, 'Invalid registration_id');

    // Lấy customer_id từ registration
    const [regData] = await db.query(
      'SELECT customer_id, id FROM registrations WHERE id = :id LIMIT 1',
      { id: registrationId }
    );

    if (!regData.length) {
      return sendError(res, 404, 'Registration not found');
    }

    const customerId = regData[0].customer_id;

    // Xóa registration
    await db.query(
      'DELETE FROM registrations WHERE id = :id',
      { id: registrationId }
    );

    res.json({ 
      ok: true, 
      message: 'Đã xóa đăng ký',
      customer_id: customerId
    });
  } catch (e) {
    console.error('Delete registration error:', e);
    sendError(res, 500, 'Server error');
  }
});
```

---

## File 2: admin/dashboard.html - JavaScript Changes

### **Thay Đổi 1: Thêm Global Variables**

**Tìm:**
```javascript
const API_BASE = 'http://localhost:3000';
let allData = [];
let filteredData = [];
let currentSort = 'newest';
let itemsPerPage = 10;
let currentPage = 1;
let editingId = null;
```

**Thay thành:**
```javascript
const API_BASE = 'http://localhost:3000';
let allData = [];
let filteredData = [];
let currentSort = 'newest';
let itemsPerPage = 10;
let currentPage = 1;
let editingId = null;
let lastRegistrationCheckTime = Date.now();
let notifiedRegistrationIds = new Set(); // Để theo dõi những registration đã thông báo
```

---

### **Thay Đổi 2: Thêm Auto-Refresh**

**Tìm:**
```javascript
// ── LOAD DATA ON PAGE LOAD ── 
$(document).ready(function() {
    loadRegistrations();
    setupEventListeners();
});
```

**Thay thành:**
```javascript
// ── LOAD DATA ON PAGE LOAD ── 
$(document).ready(function() {
    loadRegistrations();
    setupEventListeners();
    
    // Auto-refresh registrations every 5 seconds to detect new students
    setInterval(checkForNewRegistrations, 5000);
});
```

---

### **Thay Đổi 3: Thêm Hàm checkForNewRegistrations**

**Thêm sau hàm `loadRegistrations()`:**

```javascript
function checkForNewRegistrations() {
    $.ajax({
        url: `${API_BASE}/api/admin/students/registrations`,
        type: 'GET',
        dataType: 'json',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        },
        success: function(response) {
            if (response.ok && response.registrations) {
                const newRegistrations = response.registrations.map(r => ({
                    id: r.registration_id ?? r.id,
                    customer_id: r.customer_id,
                    full_name: r.full_name,
                    phone: r.phone,
                    email: r.email,
                    course_name: r.course_name || r.note || '',
                    admin_status: r.admin_status,
                    admin_note: r.admin_note,
                    created_at: r.created_at,
                    note: r.note
                }));

                // Kiểm tra có registration mới
                newRegistrations.forEach(newReg => {
                    const existingReg = allData.find(x => x.id === newReg.id);
                    
                    // Nếu là registration mới (không tồn tại trong allData) và status là 'new'
                    if (!existingReg && newReg.admin_status === 'new' && !notifiedRegistrationIds.has(newReg.id)) {
                        // Thêm vào notified set
                        notifiedRegistrationIds.add(newReg.id);
                        
                        // Hiển thị thông báo
                        showNewRegistrationNotification(newReg);
                        
                        // Cập nhật UI
                        allData.unshift(newReg); // Thêm vào đầu danh sách
                        filteredData = [...allData];
                        updateStats();
                        displayData();
                        renderLatestStudent();
                    }
                });
            }
        },
        error: function(xhr, status, error) {
            // Silently fail - không cần báo lỗi vì đây là background polling
            console.log('Background refresh failed', error);
        }
    });
}
```

---

### **Thay Đổi 4: Cập Nhật updateStats() Function**

**Tìm:**
```javascript
function updateStats() {
    const newCount = allData.filter(item => item.admin_status === 'new').length;
    const contactedCount = allData.filter(item => item.admin_status === 'contacted').length;
    const enrolledCount = allData.filter(item => item.admin_status === 'enrolled').length;

    $('#newRegCount').text(newCount);
    $('#contactedCount').text(contactedCount);
    $('#enrolledCount').text(enrolledCount);
}
```

**Thay thành:**
```javascript
function updateStats() {
    const newCount = allData.filter(item => item.admin_status === 'new').length;
    const contactedCount = allData.filter(item => item.admin_status === 'contacted').length;
    const enrolledCount = allData.filter(item => item.admin_status === 'enrolled').length;

    $('#newRegCount').text(newCount);
    $('#contactedCount').text(contactedCount);
    $('#enrolledCount').text(enrolledCount);
    
    // Update notification badge
    if (newCount > 0) {
        $('#notificationBadge').text(newCount).show();
    } else {
        $('#notificationBadge').hide();
    }
}
```

---

### **Thay Đổi 5: Thay Thế confirmDelete() Function**

**Tìm:**
```javascript
function confirmDelete() {
    const index = allData.findIndex(x => x.id === editingId);
    if (index !== -1) {
        const deletedName = allData[index].full_name;
        allData.splice(index, 1);

        filteredData = allData.filter(x => {
            // ... filter logic ...
        });

        currentPage = 1;
        updateStats();
        displayData();

        // Save to localStorage
        localStorage.setItem('registrations', JSON.stringify(allData));

        const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
        modal.hide();

        showSuccessMessage('Xóa đăng ký của ' + deletedName + ' thành công!');
    }
}
```

**Thay thành:**
```javascript
function confirmDelete() {
    const item = allData.find(x => x.id === editingId);
    if (!item) return;

    const customerId = item.customer_id;
    const deletedName = item.full_name;

    // Xóa bằng API
    $.ajax({
        url: `${API_BASE}/api/admin/customers/${customerId}`,
        type: 'DELETE',
        headers: {
            'Authorization': 'Bearer ' + localStorage.getItem('admin_token')
        },
        success: function(response) {
            if (response.ok) {
                // Xóa từ UI
                const index = allData.findIndex(x => x.id === editingId);
                if (index !== -1) {
                    allData.splice(index, 1);
                }

                filteredData = allData.filter(x => {
                    const search = $('#searchInput').val().toLowerCase();
                    const course = $('#courseFilter').val();
                    const status = $('#statusFilter').val();
                    
                    const matchSearch = !search || 
                        x.full_name.toLowerCase().includes(search) ||
                        x.phone.includes(search);
                    const matchCourse = !course || x.course_name.includes(course);
                    const matchStatus = !status || x.admin_status === status;

                    return matchSearch && matchCourse && matchStatus;
                });

                currentPage = 1;
                updateStats();
                displayData();
                renderLatestStudent();

                const modal = bootstrap.Modal.getInstance(document.getElementById('deleteModal'));
                modal.hide();

                showSuccessMessage('✓ Đã xóa học viên ' + deletedName + ' khỏi hệ thống!');
            }
        },
        error: function(xhr, status, error) {
            console.error('Delete error:', error);
            showErrorMessage('Lỗi xóa: ' + (xhr.responseJSON?.message || 'Không thể xóa học viên này'));
        }
    });
}
```

---

### **Thay Đổi 6: Cập Nhật showSuccessMessage() & Thêm showErrorMessage()**

**Tìm:**
```javascript
// ────── UTILITY FUNCTIONS ──────
function showSuccessMessage(message) {
    const alertHtml = `
        <div class="alert alert-success alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
            <i class="fas fa-check-circle me-2"></i>
            <strong>Thành công!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    $('body').append(alertHtml);
    setTimeout(() => {
        $('.alert').fadeOut(function() { $(this).remove(); });
    }, 3000);
}
```

**Thay thành:**
```javascript
// ────── UTILITY FUNCTIONS ──────
function showSuccessMessage(message) {
    const alertHtml = `
        <div class="alert alert-success alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <i class="fas fa-check-circle me-2"></i>
            <strong>Thành công!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    $('body').append(alertHtml);
    playNotificationSound();
    setTimeout(() => {
        $('.alert').fadeOut(function() { $(this).remove(); });
    }, 4000);
}

function showErrorMessage(message) {
    const alertHtml = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
            <i class="fas fa-exclamation-circle me-2"></i>
            <strong>Lỗi!</strong> ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    $('body').append(alertHtml);
    setTimeout(() => {
        $('.alert').fadeOut(function() { $(this).remove(); });
    }, 5000);
}

function showNewRegistrationNotification(student) {
    const notificationHtml = `
        <div class="alert alert-info alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 350px; box-shadow: 0 6px 16px rgba(13, 110, 253, 0.3); animation: slideInRight 0.4s ease;">
            <div style="display: flex; align-items: flex-start; gap: 10px;">
                <div style="flex-shrink: 0;">
                    <i class="fas fa-star me-1" style="color: var(--orange); font-size: 1.2rem;"></i>
                </div>
                <div style="flex-grow: 1;">
                    <strong style="color: var(--navy);">🎉 Có học viên đăng ký mới!</strong>
                    <div style="margin-top: 8px; font-size: 0.9rem; color: var(--text);">
                        <div><strong>${student.full_name}</strong></div>
                        <div><i class="fas fa-phone me-1"></i>${student.phone}</div>
                        <div><i class="fas fa-book me-1"></i>${student.course_name || 'N/A'}</div>
                    </div>
                </div>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;
    $('body').append(notificationHtml);
    playNotificationSound();
    
    // Auto-close after 6 seconds
    setTimeout(() => {
        $('.alert').fadeOut(function() { $(this).remove(); });
    }, 6000);
}

function playNotificationSound() {
    // Sử dụng Web Audio API để tạo beep đơn giản
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 800;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.5);
    } catch (e) {
        // Browser không support Web Audio API
        console.log('Web Audio API not supported');
    }
}
```

---

### **Thay Đổi 7: Thêm Notification Badge vào Header**

**Tìm HTML (trong navbar):**
```html
<li class="nav-item">
    <a class="nav-link admin-nav-link" href="#logout" id="logoutBtn">
        <i class="fas fa-sign-out-alt me-2"></i>Đăng Xuất
    </a>
</li>
```

**Thêm trước đó:**
```html
<li class="nav-item" style="position: relative;">
    <a class="nav-link admin-nav-link" href="dashboard.html">
        <i class="fas fa-bell me-2"></i>Thông báo
        <span id="notificationBadge" class="badge bg-danger" style="position: absolute; top: 5px; right: 0; font-size: 0.7rem; display: none;">0</span>
    </a>
</li>
```

---

### **Thay Đổi 8: Thêm CSS Animation**

**Tìm:**
```css
/* ── RESPONSIVE ── */
@media (max-width: 768px) {
```

**Thêm trước nó:**
```css
/* ── ANIMATIONS ── */
@keyframes slideInRight {
    from {
        transform: translateX(400px);
        opacity: 0;
    }
    to {
        transform: translateX(0);
        opacity: 1;
    }
}

.alert {
    animation: slideInRight 0.4s ease !important;
}
```

---

## 📊 Tóm Tắt Thay Đổi

| File | Loại | Chi Tiết |
|-----|------|---------|
| server.js | Thêm | 2 DELETE endpoints |
| dashboard.html | Thêm | Auto-refresh interval |
| dashboard.html | Thêm | 5 hàm mới (check, notify, error, sound, etc) |
| dashboard.html | Sửa | confirmDelete() - tích hợp API |
| dashboard.html | Sửa | updateStats() - thêm badge |
| dashboard.html | Sửa | showSuccessMessage() - tăng timeout |
| dashboard.html | Thêm | Global variables cho tracking |
| dashboard.html | Thêm | Notification badge HTML |
| dashboard.html | Thêm | CSS animation |

---

## ✅ Kiểm Tra Các Thay Đổi

Sau khi áp dụng, bạn có thể kiểm tra:

1. **Server**: `node server.js` - không có lỗi syntax
2. **API**: `curl http://localhost:3000/health` - server chạy
3. **Dashboard**: Mở admin/dashboard.html - không có JS errors
4. **Test**: Đăng ký từ form - thấy thông báo trong 5 giây
5. **Delete**: Nhấp nút Xóa - kiểm tra xóa từ DB

---

**Tất cả thay đổi đã được áp dụng!** ✨
