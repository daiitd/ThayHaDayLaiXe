-- ============================================
-- DATABASE SQL for: Admin login + Manage courses
-- plus store customer registrations & consultations
-- Thích hợp MySQL 8.x
-- ============================================

-- (Tuỳ chọn) Tạo database
CREATE DATABASE IF NOT EXISTS thayha_admin
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE thayha_admin;

-- ============================================
-- 1) BẢNG ADMIN
-- ============================================

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL DEFAULT '',
  role ENUM('admin','manager') NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_username (username)
) ENGINE=InnoDB;

-- ============================================
-- 1.1) Seed tài khoản admin ban đầu
-- ============================================

-- LƯU Ý QUAN TRỌNG:
-- server.js dùng bcrypt.compare(password, password_hash)
-- => password_hash PHẢI LÀ bcrypt hash thật, KHÔNG được là mật khẩu thường.

-- Cách dùng:
-- 1) Tạo bcrypt hash cho mật khẩu bạn muốn (ví dụ "123")
-- 2) Thay '$2y$10$PASTE_BCRYPT_HASH_HERE' dưới đây bằng hash đó

INSERT INTO admin_users(username, password_hash, full_name, role, is_active)
SELECT 'admin', '$2b$10$147KcrfYWE7nekU8CBN9o.IhOlvm9FjAKyt4Mc3xK26wwBr0ZhpJG', 'Quản trị viên', 'admin', 1
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM admin_users WHERE username = 'admin' LIMIT 1
);

-- ============================================
-- 2) KHÓA HỌC / LỚP HỌC
-- ============================================

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_code VARCHAR(30) NOT NULL, -- ví dụ: B2, B1, A1, A, C, BOTUC
  course_name VARCHAR(150) NOT NULL, -- ví dụ: Hạng B2 (Số sàn)
  slug VARCHAR(180) NOT NULL, -- để SEO nội bộ (nếu cần)
  description TEXT NOT NULL DEFAULT '',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_courses_course_code (course_code),
  UNIQUE KEY uq_courses_slug (slug)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS course_classes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,

  class_name VARCHAR(150) NOT NULL, -- ví dụ: Lớp B2 Ca Sáng 12/05
  start_date DATE NULL,
  end_date DATE NULL,
  schedule_note VARCHAR(200) NOT NULL DEFAULT '', -- note ca/giờ
  capacity INT UNSIGNED NOT NULL DEFAULT 0,

  -- trạng thái
  status ENUM('draft','open','closed','completed') NOT NULL DEFAULT 'draft',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_course_classes_course_id (course_id),
  CONSTRAINT fk_course_classes_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 3) KHÁCH HÀNG - ĐĂNG KÝ/HỌC VIÊN (đến từ form người dùng)
--    Khi người dùng đăng ký => admin xem & liên hệ
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(120) NULL,
  source ENUM('website','facebook','zalo','referral','other') NOT NULL DEFAULT 'website',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_customers_phone (phone),
  KEY idx_customers_source (source)
) ENGINE=InnoDB;

-- Mỗi lần khách để lại form: đăng ký/đặt lịch/đăng ký học
CREATE TABLE IF NOT EXISTS registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  customer_id BIGINT UNSIGNED NOT NULL,
  course_class_id BIGINT UNSIGNED NULL, -- người dùng chọn lớp nào (có thể null nếu chưa chọn)
  course_id BIGINT UNSIGNED NULL, -- lưu thêm để admin filter
  registration_type ENUM('register','callback_request','other') NOT NULL DEFAULT 'register',

  -- Thông tin form
  note VARCHAR(500) NOT NULL DEFAULT '',

  -- Trạng thái admin
  admin_status ENUM('new','contacted','in_progress','done','rejected') NOT NULL DEFAULT 'new',
  admin_note VARCHAR(500) NOT NULL DEFAULT '',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_registrations_customer_id (customer_id),
  KEY idx_registrations_course_id (course_id),
  KEY idx_registrations_course_class_id (course_class_id),
  KEY idx_registrations_admin_status (admin_status),

  CONSTRAINT fk_registrations_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_registrations_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_registrations_course_class
    FOREIGN KEY (course_class_id) REFERENCES course_classes(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 4) TƯ VẤN KHÁCH HÀNG (liên hệ tư vấn)
--    Nếu bạn có form “Tư vấn/Để lại số điện thoại”
-- ============================================

CREATE TABLE IF NOT EXISTS consultations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,

  course_id BIGINT UNSIGNED NULL,
  topic VARCHAR(150) NOT NULL DEFAULT '', -- ví dụ: tư vấn hạng B2, tư vấn lịch
  message VARCHAR(1000) NOT NULL DEFAULT '',

  admin_status ENUM('new','contacted','scheduled','done','closed') NOT NULL DEFAULT 'new',
  admin_note VARCHAR(500) NOT NULL DEFAULT '',

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_consultations_customer_id (customer_id),
  KEY idx_consultations_course_id (course_id),
  KEY idx_consultations_admin_status (admin_status),

  CONSTRAINT fk_consultations_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_consultations_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 5) LOG HOẠT ĐỘNG ADMIN (tuỳ chọn nhưng nên có)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,

  entity_type VARCHAR(60) NOT NULL DEFAULT '', -- 'registration','consultation','course_class'...
  entity_id BIGINT UNSIGNED NULL,

  action VARCHAR(80) NOT NULL, -- 'update_status','create','delete'...
  meta_json JSON NULL,         -- ghi thêm meta (tránh thêm nhiều cột)
  ip VARCHAR(45) NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_admin_activity_logs_admin_user_id (admin_user_id),
  KEY idx_admin_activity_logs_entity (entity_type, entity_id),
  CONSTRAINT fk_admin_activity_logs_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 6) GIÁ TRỊ MẪU
-- ============================================

-- Courses mẫu (bạn có thể xóa/điều chỉnh)
INSERT INTO courses(course_code, course_name, slug, description, is_active)
VALUES
  ('B1', 'Hạng B1 (Số tự động)', 'hang-b1-so-tu-dong', 'Đào tạo B1 cho xe số tự động', 1),
  ('B2', 'Hạng B2 (Số sàn)', 'hang-b2-so-san', 'Đào tạo phổ biến nhất cho xe số sàn', 1),
  ('C',  'Hạng C (Xe tải)', 'hang-c-xe-tai', 'Đào tạo bài bản cho xe tải', 1),
  ('A1', 'Hạng A1 (Xe mô tô)', 'hang-a1-xe-mo-to', 'Thi nhanh, phù hợp người mới', 1),
  ('A',  'Hạng A (Xe mô tô)', 'hang-a-xe-mo-to', 'Thủ tục đơn giản, tỉ lệ đậu cao', 1),
  ('BOTUC', 'Bổ túc tay lái', 'bo-tuc-tay-lai', 'Học nhanh, hiệu quả, an toàn', 1)
ON DUPLICATE KEY UPDATE
  course_name = VALUES(course_name),
  slug = VALUES(slug),
  description = VALUES(description),
  is_active = VALUES(is_active);

-- ============================================
-- NOTES triển khai backend
-- 1) admin login: lưu password_hash (bcrypt/argon2)
-- 2) form người dùng:
--    - tìm khách theo phone -> nếu có thì reuse customer_id
--    - ghi registrations/consultations tương ứng
-- 3) admin dashboard:
--    - query registrations where admin_status='new'
--    - update admin_status + admin_note
-- ============================================
