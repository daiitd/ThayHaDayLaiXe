-- phpMyAdmin SQL Dump
-- version 4.9.2
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3306
-- Generation Time: May 19, 2026 at 02:40 PM
-- Server version: 10.4.10-MariaDB
-- PHP Version: 7.3.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT = 0;
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `thayha_admin`
--

-- --------------------------------------------------------

--
-- Table structure for table `admin_activity_logs`
--

DROP TABLE IF EXISTS `admin_activity_logs`;
CREATE TABLE IF NOT EXISTS `admin_activity_logs` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `admin_user_id` bigint(20) UNSIGNED NOT NULL,
  `entity_type` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `entity_id` bigint(20) UNSIGNED DEFAULT NULL,
  `action` varchar(80) COLLATE utf8mb4_unicode_ci NOT NULL,
  `meta_json` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meta_json`)),
  `ip_address` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_admin_user_id` (`admin_user_id`),
  KEY `idx_entity` (`entity_type`,`entity_id`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `admin_users`
--

DROP TABLE IF EXISTS `admin_users`;
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `full_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('admin','manager','teacher') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'manager',
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `last_login` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_admin_users_username` (`username`),
  KEY `idx_admin_users_role` (`role`),
  KEY `idx_admin_users_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `admin_users`
--

INSERT INTO `admin_users` (`id`, `username`, `password_hash`, `full_name`, `phone`, `email`, `role`, `is_active`, `last_login`, `created_at`, `updated_at`) VALUES
(1, 'admin', '$2b$10$hCtinkSL/wSz5df/5BLb/.eeXn0al/8xgxG1XmocszFU/IDKhDKOa', 'Thầy Hà - Admin', '0941822239', 'phuongnguyendai240@gmail.com', 'admin', 1, NULL, '2026-05-13 14:28:02', '2026-05-18 06:26:44'),
(2, 'thayha', '$2b$10$147KcrfYWE7nekU8CBN9o.IhOlvm9FjAKyt4Mc3xK26wwBr0ZhpJG', 'Thầy Hà', '0941822239', 'lexuanha280473@gmail.com', 'admin', 1, NULL, '2026-05-17 09:11:14', '2026-05-17 09:11:33'),
(3, 'phuongdai', '$2b$12$dT5L9unlNJCyeY6LG56ije8LYw50rn1lPKzi5B.stgEw8xu4lcYdK', 'Thầy Hà', '0776257464', 'phuongnguyendai8@gmail.com', 'admin', 1, NULL, '2026-05-18 08:10:08', '2026-05-18 08:38:03');

-- --------------------------------------------------------

--
-- Table structure for table `attendance`
--

DROP TABLE IF EXISTS `attendance`;
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `schedule_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `status` enum('present','absent','late','excused') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'present',
  `notes` varchar(300) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_attendance` (`schedule_id`,`customer_id`),
  KEY `idx_schedule_id` (`schedule_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `class_enrollment`
--

DROP TABLE IF EXISTS `class_enrollment`;
CREATE TABLE IF NOT EXISTS `class_enrollment` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_class_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `enrollment_date` timestamp NOT NULL DEFAULT current_timestamp(),
  `completed_date` datetime DEFAULT NULL,
  `status` enum('enrolled','active','completed','dropped') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'enrolled',
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_enrollment` (`course_class_id`,`customer_id`),
  KEY `idx_course_class_id` (`course_class_id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `consultations`
--

DROP TABLE IF EXISTS `consultations`;
CREATE TABLE IF NOT EXISTS `consultations` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `course_id` bigint(20) UNSIGNED DEFAULT NULL,
  `topic` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `message` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `consultant_id` bigint(20) UNSIGNED DEFAULT NULL,
  `consultation_date` datetime DEFAULT NULL,
  `consultation_notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_status` enum('new','contacted','scheduled','completed','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `admin_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_consultant_id` (`consultant_id`),
  KEY `idx_admin_status` (`admin_status`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_consultations_multi` (`admin_status`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `courses`
--

DROP TABLE IF EXISTS `courses`;
CREATE TABLE IF NOT EXISTS `courses` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_code` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL,
  `course_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(180) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  `duration_days` int(10) UNSIGNED DEFAULT NULL,
  `theory_hours` int(10) UNSIGNED DEFAULT NULL,
  `practice_hours` int(10) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `course_code` (`course_code`),
  UNIQUE KEY `slug` (`slug`),
  KEY `idx_courses_code` (`course_code`),
  KEY `idx_courses_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `courses`
--

INSERT INTO `courses` (`id`, `course_code`, `course_name`, `slug`, `description`, `price`, `duration_days`, `theory_hours`, `practice_hours`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 'B1', 'Hạng B1 (Số tự động)', 'hang-b1-so-tu-dong', 'Đào tạo B1 cho xe số tự động', '2500000.00', 30, 20, 40, 1, '2026-05-13 14:28:02', '2026-05-14 10:02:09'),
(2, 'B2', 'Hạng B2 (Số sàn)', 'hang-b2-so-san', 'Đào tạo phổ biến nhất cho xe số sàn', '2000000.00', 30, 20, 40, 1, '2026-05-13 14:28:02', '2026-05-13 14:28:02'),
(3, 'C', 'Hạng C (Xe tải)', 'hang-c-xe-tai', 'Đào tạo bài bản cho xe tải', '3500000.00', 180, 40, 140, 1, '2026-05-13 14:28:02', '2026-05-13 14:28:02'),
(4, 'A1', 'Hạng A1 (Xe mô tô)', 'hang-a1-xe-mo-to', 'Thi nhanh, phù hợp người mới', '1500000.00', 20, 15, 25, 1, '2026-05-13 14:28:02', '2026-05-13 14:28:02'),
(5, 'A', 'Hạng A (Xe mô tô)', 'hang-a-xe-mo-to', 'Thủ tục đơn giản, tỉ lệ đậu cao', '1800000.00', 25, 18, 32, 1, '2026-05-13 14:28:02', '2026-05-13 14:28:02'),
(6, 'BOTUC', 'Bổ túc tay lái', 'bo-tuc-tay-lai', 'Học nhanh, hiệu quả, an toàn', '1200000.00', 15, 10, 20, 1, '2026-05-13 14:28:02', '2026-05-13 14:28:02');

-- --------------------------------------------------------

--
-- Table structure for table `course_classes`
--

DROP TABLE IF EXISTS `course_classes`;
CREATE TABLE IF NOT EXISTS `course_classes` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_id` bigint(20) UNSIGNED NOT NULL,
  `class_code` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `class_name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `schedule_note` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT '',
  `capacity` int(10) UNSIGNED NOT NULL DEFAULT 20,
  `enrolled` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `status` enum('draft','open','ongoing','closed','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `teacher_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `class_code` (`class_code`),
  UNIQUE KEY `uq_class_code` (`class_code`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_teacher_id` (`teacher_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

DROP TABLE IF EXISTS `customers`;
CREATE TABLE IF NOT EXISTS `customers` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `full_name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `phone` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(120) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `gender` enum('male','female','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `address` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source` enum('website','facebook','zalo','referral','other','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'website',
  `status` enum('prospect','enrolled','completed','dropped') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'prospect',
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `phone` (`phone`),
  KEY `idx_phone` (`phone`),
  KEY `idx_email` (`email`),
  KEY `idx_source` (`source`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=60 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) UNSIGNED DEFAULT NULL,
  `admin_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `course_class_id` bigint(20) UNSIGNED DEFAULT NULL,
  `title` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `notification_type` enum('schedule','payment','consultation','announcement') COLLATE utf8mb4_unicode_ci NOT NULL,
  `sent_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_admin_user_id` (`admin_user_id`),
  KEY `idx_course_class_id` (`course_class_id`),
  KEY `idx_read_at` (`read_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

DROP TABLE IF EXISTS `payments`;
CREATE TABLE IF NOT EXISTS `payments` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `registration_id` bigint(20) UNSIGNED DEFAULT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_method` enum('cash','bank_transfer','momo','vietcombank','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'cash',
  `payment_status` enum('pending','completed','cancelled','refunded') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `transaction_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_registration_id` (`registration_id`),
  KEY `idx_payment_status` (`payment_status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `registrations`
--

DROP TABLE IF EXISTS `registrations`;
CREATE TABLE IF NOT EXISTS `registrations` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `course_id` bigint(20) UNSIGNED DEFAULT NULL,
  `course_class_id` bigint(20) UNSIGNED DEFAULT NULL,
  `registration_type` enum('register','trial_class','callback_request') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'register',
  `note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `admin_status` enum('new','contacted','in_progress','enrolled','completed','rejected') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'new',
  `admin_note` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `contacted_at` timestamp NULL DEFAULT NULL,
  `contacted_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_customer_id` (`customer_id`),
  KEY `idx_course_id` (`course_id`),
  KEY `idx_course_class_id` (`course_class_id`),
  KEY `idx_admin_status` (`admin_status`),
  KEY `idx_created_at` (`created_at`),
  KEY `fk_reg_contacted_by` (`contacted_by`),
  KEY `idx_registrations_multi` (`admin_status`,`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=43 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `schedules`
--

DROP TABLE IF EXISTS `schedules`;
CREATE TABLE IF NOT EXISTS `schedules` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `course_class_id` bigint(20) UNSIGNED NOT NULL,
  `teacher_id` bigint(20) UNSIGNED DEFAULT NULL,
  `schedule_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `lesson_number` int(10) UNSIGNED DEFAULT NULL,
  `lesson_topic` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `lesson_description` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `location` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT 'Trường ĐH An Ninh',
  `notes` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('scheduled','ongoing','completed','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'scheduled',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_course_class_id` (`course_class_id`),
  KEY `idx_teacher_id` (`teacher_id`),
  KEY `idx_schedule_date` (`schedule_date`),
  KEY `idx_status` (`status`),
  KEY `idx_schedules_upcoming` (`schedule_date`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_class_details`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `vw_class_details`;
CREATE TABLE IF NOT EXISTS `vw_class_details` (
`id` bigint(20) unsigned
,`class_code` varchar(50)
,`class_name` varchar(150)
,`course_code` varchar(30)
,`course_name` varchar(150)
,`teacher_name` varchar(120)
,`start_date` date
,`end_date` date
,`capacity` int(10) unsigned
,`enrolled` int(10) unsigned
,`available_seats` bigint(11) unsigned
,`status` enum('draft','open','ongoing','closed','completed')
,`schedule_note` varchar(200)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_pending_consultations`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `vw_pending_consultations`;
CREATE TABLE IF NOT EXISTS `vw_pending_consultations` (
`id` bigint(20) unsigned
,`customer_id` bigint(20) unsigned
,`full_name` varchar(120)
,`phone` varchar(20)
,`email` varchar(120)
,`course_id` bigint(20) unsigned
,`course_name` varchar(150)
,`topic` varchar(150)
,`message` text
,`admin_status` enum('new','contacted','scheduled','completed','closed')
,`created_at` timestamp
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_pending_registrations`
-- (See below for the actual view)
--
DROP VIEW IF EXISTS `vw_pending_registrations`;
CREATE TABLE IF NOT EXISTS `vw_pending_registrations` (
`id` bigint(20) unsigned
,`customer_id` bigint(20) unsigned
,`full_name` varchar(120)
,`phone` varchar(20)
,`email` varchar(120)
,`course_id` bigint(20) unsigned
,`course_name` varchar(150)
,`course_class_id` bigint(20) unsigned
,`class_name` varchar(150)
,`registration_type` enum('register','trial_class','callback_request')
,`note` varchar(500)
,`admin_status` enum('new','contacted','in_progress','enrolled','completed','rejected')
,`created_at` timestamp
);

-- --------------------------------------------------------

--
-- Structure for view `vw_class_details`
--
DROP TABLE IF EXISTS `vw_class_details`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vw_class_details`  AS  select `cc`.`id` AS `id`,`cc`.`class_code` AS `class_code`,`cc`.`class_name` AS `class_name`,`co`.`course_code` AS `course_code`,`co`.`course_name` AS `course_name`,`a`.`full_name` AS `teacher_name`,`cc`.`start_date` AS `start_date`,`cc`.`end_date` AS `end_date`,`cc`.`capacity` AS `capacity`,`cc`.`enrolled` AS `enrolled`,`cc`.`capacity` - `cc`.`enrolled` AS `available_seats`,`cc`.`status` AS `status`,`cc`.`schedule_note` AS `schedule_note` from ((`course_classes` `cc` left join `courses` `co` on(`cc`.`course_id` = `co`.`id`)) left join `admin_users` `a` on(`cc`.`teacher_id` = `a`.`id`)) order by `cc`.`start_date` desc ;

-- --------------------------------------------------------

--
-- Structure for view `vw_pending_consultations`
--
DROP TABLE IF EXISTS `vw_pending_consultations`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vw_pending_consultations`  AS  select `con`.`id` AS `id`,`con`.`customer_id` AS `customer_id`,`c`.`full_name` AS `full_name`,`c`.`phone` AS `phone`,`c`.`email` AS `email`,`con`.`course_id` AS `course_id`,`co`.`course_name` AS `course_name`,`con`.`topic` AS `topic`,`con`.`message` AS `message`,`con`.`admin_status` AS `admin_status`,`con`.`created_at` AS `created_at` from ((`consultations` `con` left join `customers` `c` on(`con`.`customer_id` = `c`.`id`)) left join `courses` `co` on(`con`.`course_id` = `co`.`id`)) where `con`.`admin_status` in ('new','contacted','scheduled') order by `con`.`created_at` ;

-- --------------------------------------------------------

--
-- Structure for view `vw_pending_registrations`
--
DROP TABLE IF EXISTS `vw_pending_registrations`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vw_pending_registrations`  AS  select `r`.`id` AS `id`,`r`.`customer_id` AS `customer_id`,`c`.`full_name` AS `full_name`,`c`.`phone` AS `phone`,`c`.`email` AS `email`,`r`.`course_id` AS `course_id`,`co`.`course_name` AS `course_name`,`r`.`course_class_id` AS `course_class_id`,`cc`.`class_name` AS `class_name`,`r`.`registration_type` AS `registration_type`,`r`.`note` AS `note`,`r`.`admin_status` AS `admin_status`,`r`.`created_at` AS `created_at` from (((`registrations` `r` left join `customers` `c` on(`r`.`customer_id` = `c`.`id`)) left join `courses` `co` on(`r`.`course_id` = `co`.`id`)) left join `course_classes` `cc` on(`r`.`course_class_id` = `cc`.`id`)) where `r`.`admin_status` in ('new','contacted','in_progress') order by `r`.`created_at` ;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `admin_activity_logs`
--
ALTER TABLE `admin_activity_logs`
  ADD CONSTRAINT `fk_log_admin_user` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `attendance`
--
ALTER TABLE `attendance`
  ADD CONSTRAINT `fk_att_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_att_schedule` FOREIGN KEY (`schedule_id`) REFERENCES `schedules` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `class_enrollment`
--
ALTER TABLE `class_enrollment`
  ADD CONSTRAINT `fk_enroll_course_class` FOREIGN KEY (`course_class_id`) REFERENCES `course_classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_enroll_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `consultations`
--
ALTER TABLE `consultations`
  ADD CONSTRAINT `fk_cons_consultant` FOREIGN KEY (`consultant_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_cons_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_cons_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `course_classes`
--
ALTER TABLE `course_classes`
  ADD CONSTRAINT `fk_course_classes_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_course_classes_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `notifications`
--
ALTER TABLE `notifications`
  ADD CONSTRAINT `fk_notif_admin_user` FOREIGN KEY (`admin_user_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notif_course_class` FOREIGN KEY (`course_class_id`) REFERENCES `course_classes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_notif_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `fk_pay_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_pay_registration` FOREIGN KEY (`registration_id`) REFERENCES `registrations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;

--
-- Constraints for table `registrations`
--
ALTER TABLE `registrations`
  ADD CONSTRAINT `fk_reg_contacted_by` FOREIGN KEY (`contacted_by`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reg_course` FOREIGN KEY (`course_id`) REFERENCES `courses` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reg_course_class` FOREIGN KEY (`course_class_id`) REFERENCES `course_classes` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_reg_customer` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `schedules`
--
ALTER TABLE `schedules`
  ADD CONSTRAINT `fk_schedule_course_class` FOREIGN KEY (`course_class_id`) REFERENCES `course_classes` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_schedule_teacher` FOREIGN KEY (`teacher_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
