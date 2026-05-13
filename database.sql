-- ============================================
-- DATABASE SQL: Quản lý khóa học Thầy Hà
-- Admin login, Courses, Classes, Students,
-- Registrations, Consultations, Schedule
-- MySQL 8.x compatible
-- ============================================

CREATE DATABASE IF NOT EXISTS thayha_admin
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE thayha_admin;

-- ============================================
-- 1) BẢNG ADMIN_USERS - Quản lý người dùng hệ thống
-- (admin, manager, teacher)
-- ============================================

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(120) UNIQUE,
  
  role ENUM('admin','manager','teacher') NOT NULL DEFAULT 'manager',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_admin_users_username (username),
  KEY idx_admin_users_role (role),
  KEY idx_admin_users_is_active (is_active)
) ENGINE=InnoDB;

-- Seed admin mặc định
-- Mật khẩu bcrypt cho "123": $2b$10$147KcrfYWE7nekU8CBN9o.IhOlvm9FjAKyt4Mc3xK26wwBr0ZhpJG
INSERT INTO admin_users(username, password_hash, full_name, phone, email, role, is_active)
SELECT 'admin', '$2b$10$147KcrfYWE7nekU8CBN9o.IhOlvm9FjAKyt4Mc3xK26wwBr0ZhpJG', 'Thầy Hà - Admin', '0941822239', 'lexuanha280473@gmail.com', 'admin', 1
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE username = 'admin');

-- ============================================
-- 2) BẢNG COURSES - Danh sách các khóa học
-- (B1, B2, C, A1, A, Bổ túc...)
-- ============================================

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_code VARCHAR(30) NOT NULL UNIQUE,
  course_name VARCHAR(150) NOT NULL,
  slug VARCHAR(180) NOT NULL UNIQUE,
  description TEXT,
  
  price DECIMAL(10,2),
  duration_days INT UNSIGNED,
  theory_hours INT UNSIGNED,
  practice_hours INT UNSIGNED,
  
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_courses_code (course_code),
  KEY idx_courses_is_active (is_active)
) ENGINE=InnoDB;

-- Seed dữ liệu khóa học
INSERT INTO courses(course_code, course_name, slug, description, price, duration_days, theory_hours, practice_hours, is_active)
SELECT 'B1', 'Hạng B1 (Số tự động)', 'hang-b1-so-tu-dong', 'Đào tạo B1 cho xe số tự động', 2500000, 30, 20, 40, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'B1')
UNION ALL
SELECT 'B2', 'Hạng B2 (Số sàn)', 'hang-b2-so-san', 'Đào tạo phổ biến nhất cho xe số sàn', 2000000, 30, 20, 40, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'B2')
UNION ALL
SELECT 'C', 'Hạng C (Xe tải)', 'hang-c-xe-tai', 'Đào tạo bài bản cho xe tải', 3500000, 180, 40, 140, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'C')
UNION ALL
SELECT 'A1', 'Hạng A1 (Xe mô tô)', 'hang-a1-xe-mo-to', 'Thi nhanh, phù hợp người mới', 1500000, 20, 15, 25, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'A1')
UNION ALL
SELECT 'A', 'Hạng A (Xe mô tô)', 'hang-a-xe-mo-to', 'Thủ tục đơn giản, tỉ lệ đậu cao', 1800000, 25, 18, 32, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'A')
UNION ALL
SELECT 'BOTUC', 'Bổ túc tay lái', 'bo-tuc-tay-lai', 'Học nhanh, hiệu quả, an toàn', 1200000, 15, 10, 20, 1
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM courses WHERE course_code = 'BOTUC');

-- ============================================
-- 3) BẢNG COURSE_CLASSES - Các lớp học cụ thể
-- (VD: Lớp B2 ca Sáng, Lớp A ca Chiều...)
-- ============================================

CREATE TABLE IF NOT EXISTS course_classes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_id BIGINT UNSIGNED NOT NULL,
  
  class_code VARCHAR(50) NOT NULL UNIQUE,
  class_name VARCHAR(150) NOT NULL,
  
  start_date DATE,
  end_date DATE,
  schedule_note VARCHAR(200) DEFAULT '',
  
  capacity INT UNSIGNED NOT NULL DEFAULT 20,
  enrolled INT UNSIGNED NOT NULL DEFAULT 0,
  
  status ENUM('draft','open','ongoing','closed','completed') NOT NULL DEFAULT 'draft',
  
  teacher_id BIGINT UNSIGNED,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_class_code (class_code),
  KEY idx_course_id (course_id),
  KEY idx_teacher_id (teacher_id),
  KEY idx_status (status),
  
  CONSTRAINT fk_course_classes_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    
  CONSTRAINT fk_course_classes_teacher
    FOREIGN KEY (teacher_id) REFERENCES admin_users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 4) BẢNG CUSTOMERS - Học viên / Khách hàng
-- ============================================

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  full_name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  email VARCHAR(120),
  
  date_of_birth DATE,
  gender ENUM('male','female','other'),
  address VARCHAR(255),
  
  source ENUM('website','facebook','zalo','referral','other','admin') NOT NULL DEFAULT 'website',
  status ENUM('prospect','enrolled','completed','dropped') NOT NULL DEFAULT 'prospect',
  
  notes TEXT,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_phone (phone),
  KEY idx_email (email),
  KEY idx_source (source),
  KEY idx_status (status),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB;

-- ============================================
-- 5) BẢNG REGISTRATIONS - Đăng ký khóa học
-- ============================================

CREATE TABLE IF NOT EXISTS registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

  customer_id BIGINT UNSIGNED NOT NULL,
  course_id BIGINT UNSIGNED,
  course_class_id BIGINT UNSIGNED,
  
  registration_type ENUM('register','trial_class','callback_request') NOT NULL DEFAULT 'register',
  note VARCHAR(500),
  
  admin_status ENUM('new','contacted','in_progress','enrolled','completed','rejected') NOT NULL DEFAULT 'new',
  admin_note VARCHAR(500),
  
  contacted_at TIMESTAMP NULL,
  contacted_by BIGINT UNSIGNED,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_customer_id (customer_id),
  KEY idx_course_id (course_id),
  KEY idx_course_class_id (course_class_id),
  KEY idx_admin_status (admin_status),
  KEY idx_created_at (created_at),
  
  CONSTRAINT fk_reg_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_reg_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_reg_course_class
    FOREIGN KEY (course_class_id) REFERENCES course_classes(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
    
  CONSTRAINT fk_reg_contacted_by
    FOREIGN KEY (contacted_by) REFERENCES admin_users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 6) BẢNG CONSULTATIONS - Tư vấn khóa học
-- ============================================

CREATE TABLE IF NOT EXISTS consultations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,

  course_id BIGINT UNSIGNED,
  topic VARCHAR(150) DEFAULT '',
  message TEXT,

  consultant_id BIGINT UNSIGNED,
  consultation_date DATETIME,
  consultation_notes TEXT,

  admin_status ENUM('new','contacted','scheduled','completed','closed') NOT NULL DEFAULT 'new',
  admin_note VARCHAR(500),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_customer_id (customer_id),
  KEY idx_course_id (course_id),
  KEY idx_consultant_id (consultant_id),
  KEY idx_admin_status (admin_status),
  KEY idx_created_at (created_at),

  CONSTRAINT fk_cons_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_cons_course
    FOREIGN KEY (course_id) REFERENCES courses(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
    
  CONSTRAINT fk_cons_consultant
    FOREIGN KEY (consultant_id) REFERENCES admin_users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 7) BẢNG CLASS_ENROLLMENT - Danh sách học viên từng lớp
-- Liên kết giữa Students và Classes
-- ============================================

CREATE TABLE IF NOT EXISTS class_enrollment (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_class_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  
  enrollment_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_date DATETIME,
  status ENUM('enrolled','active','completed','dropped') NOT NULL DEFAULT 'enrolled',
  
  notes VARCHAR(500),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_enrollment (course_class_id, customer_id),
  KEY idx_course_class_id (course_class_id),
  KEY idx_customer_id (customer_id),
  KEY idx_status (status),
  
  CONSTRAINT fk_enroll_course_class
    FOREIGN KEY (course_class_id) REFERENCES course_classes(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT fk_enroll_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 8) BẢNG SCHEDULES - Lịch học chi tiết
-- ============================================

CREATE TABLE IF NOT EXISTS schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  course_class_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED,
  
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  
  lesson_number INT UNSIGNED,
  lesson_topic VARCHAR(200),
  lesson_description TEXT,
  
  location VARCHAR(255) DEFAULT 'Trường ĐH An Ninh',
  notes VARCHAR(500),
  
  status ENUM('scheduled','ongoing','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_course_class_id (course_class_id),
  KEY idx_teacher_id (teacher_id),
  KEY idx_schedule_date (schedule_date),
  KEY idx_status (status),
  
  CONSTRAINT fk_schedule_course_class
    FOREIGN KEY (course_class_id) REFERENCES course_classes(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT fk_schedule_teacher
    FOREIGN KEY (teacher_id) REFERENCES admin_users(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 9) BẢNG ATTENDANCE - Điểm danh học viên
-- ============================================

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  schedule_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  
  status ENUM('present','absent','late','excused') NOT NULL DEFAULT 'present',
  notes VARCHAR(300),
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance (schedule_id, customer_id),
  KEY idx_schedule_id (schedule_id),
  KEY idx_customer_id (customer_id),
  KEY idx_status (status),
  
  CONSTRAINT fk_att_schedule
    FOREIGN KEY (schedule_id) REFERENCES schedules(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT fk_att_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 10) BẢNG ADMIN_ACTIVITY_LOGS - Log hoạt động
-- ============================================

CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,

  entity_type VARCHAR(60) NOT NULL DEFAULT '',
  entity_id BIGINT UNSIGNED,

  action VARCHAR(80) NOT NULL,
  meta_json JSON,
  ip_address VARCHAR(45),

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_admin_user_id (admin_user_id),
  KEY idx_entity (entity_type, entity_id),
  KEY idx_created_at (created_at),
  
  CONSTRAINT fk_log_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 11) BẢNG NOTIFICATIONS - Thông báo cho học viên
-- ============================================

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED,
  admin_user_id BIGINT UNSIGNED,
  course_class_id BIGINT UNSIGNED,
  
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  notification_type ENUM('schedule','payment','consultation','announcement') NOT NULL,
  
  sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_customer_id (customer_id),
  KEY idx_admin_user_id (admin_user_id),
  KEY idx_course_class_id (course_class_id),
  KEY idx_read_at (read_at),
  
  CONSTRAINT fk_notif_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
    
  CONSTRAINT fk_notif_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
    
  CONSTRAINT fk_notif_course_class
    FOREIGN KEY (course_class_id) REFERENCES course_classes(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- 12) BẢNG PAYMENTS - Thanh toán
-- ============================================

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  registration_id BIGINT UNSIGNED,
  
  amount DECIMAL(10,2) NOT NULL,
  payment_method ENUM('cash','bank_transfer','momo','vietcombank','other') NOT NULL DEFAULT 'cash',
  payment_status ENUM('pending','completed','cancelled','refunded') NOT NULL DEFAULT 'pending',
  
  transaction_code VARCHAR(100),
  notes VARCHAR(500),
  
  paid_at DATETIME,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (id),
  KEY idx_customer_id (customer_id),
  KEY idx_registration_id (registration_id),
  KEY idx_payment_status (payment_status),
  KEY idx_created_at (created_at),
  
  CONSTRAINT fk_pay_customer
    FOREIGN KEY (customer_id) REFERENCES customers(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    
  CONSTRAINT fk_pay_registration
    FOREIGN KEY (registration_id) REFERENCES registrations(id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ============================================
-- INDEXES BỔ SUNG CHO HIỆU NĂNG
-- ============================================

CREATE INDEX idx_registrations_multi ON registrations(admin_status, created_at DESC);
CREATE INDEX idx_consultations_multi ON consultations(admin_status, created_at DESC);
CREATE INDEX idx_schedules_upcoming ON schedules(schedule_date DESC, status);

-- ============================================
-- VIEWS - Để truy vấn dễ dàng từ backend
-- ============================================

-- View: Danh sách đăng ký chưa xử lý
CREATE OR REPLACE VIEW vw_pending_registrations AS
SELECT 
  r.id,
  r.customer_id,
  c.full_name,
  c.phone,
  c.email,
  r.course_id,
  co.course_name,
  r.course_class_id,
  cc.class_name,
  r.registration_type,
  r.note,
  r.admin_status,
  r.created_at
FROM registrations r
LEFT JOIN customers c ON r.customer_id = c.id
LEFT JOIN courses co ON r.course_id = co.id
LEFT JOIN course_classes cc ON r.course_class_id = cc.id
WHERE r.admin_status IN ('new', 'contacted', 'in_progress')
ORDER BY r.created_at ASC;

-- View: Danh sách tư vấn chưa xử lý
CREATE OR REPLACE VIEW vw_pending_consultations AS
SELECT 
  con.id,
  con.customer_id,
  c.full_name,
  c.phone,
  c.email,
  con.course_id,
  co.course_name,
  con.topic,
  con.message,
  con.admin_status,
  con.created_at
FROM consultations con
LEFT JOIN customers c ON con.customer_id = c.id
LEFT JOIN courses co ON con.course_id = co.id
WHERE con.admin_status IN ('new', 'contacted', 'scheduled')
ORDER BY con.created_at ASC;

-- View: Thông tin lớp học chi tiết
CREATE OR REPLACE VIEW vw_class_details AS
SELECT 
  cc.id,
  cc.class_code,
  cc.class_name,
  co.course_code,
  co.course_name,
  a.full_name as teacher_name,
  cc.start_date,
  cc.end_date,
  cc.capacity,
  cc.enrolled,
  (cc.capacity - cc.enrolled) as available_seats,
  cc.status,
  cc.schedule_note
FROM course_classes cc
LEFT JOIN courses co ON cc.course_id = co.id
LEFT JOIN admin_users a ON cc.teacher_id = a.id
ORDER BY cc.start_date DESC;

-- ============================================
-- END OF DATABASE SCHEMA
-- ============================================
