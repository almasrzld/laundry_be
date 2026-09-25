-- =======================================================
-- SQL SCHEMA UNTUK ALMAS LAUNDRY (DBeaver / MySQL)
-- Database: laundry_app
-- Standar ID: id_<nama_tabel> INT AUTO_INCREMENT PRIMARY KEY
-- Standar Foreign Key: <nama_tabel>_id INT
-- Standar Nama: name_<nama_tabel> VARCHAR(...) NOT NULL
-- Standar Audit: created_at, creator NOT NULL, updated_at, update_pic, deleted_at, delete_pic (Soft Delete)
-- =======================================================

USE `laundry_app`;

-- Drop existing tables in reverse foreign key order
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS `order_timelines`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `addresses`;
DROP TABLE IF EXISTS `services`;
DROP TABLE IF EXISTS `promos`;
DROP TABLE IF EXISTS `role_menus`;
DROP TABLE IF EXISTS `role_permissions`;
DROP TABLE IF EXISTS `menus`;
DROP TABLE IF EXISTS `permissions`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `roles`;
DROP TABLE IF EXISTS `master_storage_shelves`;
DROP TABLE IF EXISTS `master_shelf_types`;
DROP TABLE IF EXISTS `master_service_categories`;
DROP TABLE IF EXISTS `master_units`;
DROP TABLE IF EXISTS `master_perfumes`;
DROP TABLE IF EXISTS `master_payment_methods`;
DROP TABLE IF EXISTS `master_order_statuses`;
DROP TABLE IF EXISTS `icons`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. TABEL ROLES (PERAN PENGGUNA)
CREATE TABLE IF NOT EXISTS `roles` (
  `id_roles` INT AUTO_INCREMENT PRIMARY KEY,
  `name_roles` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) UNIQUE NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. TABEL PERMISSIONS (HAK AKSES FITUR)
CREATE TABLE IF NOT EXISTS `permissions` (
  `id_permissions` INT AUTO_INCREMENT PRIMARY KEY,
  `name_permissions` VARCHAR(100) NOT NULL,
  `code` VARCHAR(100) UNIQUE NOT NULL,
  `module` VARCHAR(50) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. TABEL ROLE_PERMISSIONS (MAPPING ROLE -> HAK AKSES)
CREATE TABLE IF NOT EXISTS `role_permissions` (
  `id_role_permissions` INT AUTO_INCREMENT PRIMARY KEY,
  `roles_id` INT NOT NULL,
  `permissions_id` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL,
  FOREIGN KEY (`roles_id`) REFERENCES `roles`(`id_roles`) ON DELETE CASCADE,
  FOREIGN KEY (`permissions_id`) REFERENCES `permissions`(`id_permissions`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. TABEL MENUS (KATALOG MENU & STRUKTUR SIDEBAR DINAMIS)
CREATE TABLE IF NOT EXISTS `menus` (
  `id_menus` INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(100) NULL,
  `name_menus` VARCHAR(100) NOT NULL,
  `path` VARCHAR(200) NOT NULL,
  `nama_akses` VARCHAR(100) NULL DEFAULT NULL,
  `icon` VARCHAR(50) NULL DEFAULT NULL,
  `menus_id` INT NULL,
  `order_index` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `is_sidebar` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. TABEL ROLE_MENUS (VISIBILITAS MENU PER ROLE)
CREATE TABLE IF NOT EXISTS `role_menus` (
  `id_role_menus` INT AUTO_INCREMENT PRIMARY KEY,
  `roles_id` INT NOT NULL,
  `menus_id` INT NOT NULL,
  `can_view` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL,
  FOREIGN KEY (`roles_id`) REFERENCES `roles`(`id_roles`) ON DELETE CASCADE,
  FOREIGN KEY (`menus_id`) REFERENCES `menus`(`id_menus`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. TABEL USERS
CREATE TABLE IF NOT EXISTS `users` (
  `id_users` INT AUTO_INCREMENT PRIMARY KEY,
  `name_users` VARCHAR(100) NOT NULL,
  `email` VARCHAR(100) UNIQUE NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `role_code` VARCHAR(50) NOT NULL DEFAULT 'customer',
  `status` VARCHAR(20) NOT NULL DEFAULT 'active',
  `avatar_url` TEXT,
  `member_tier` VARCHAR(30) DEFAULT 'Gold Member',
  `laundry_pay_balance` INT DEFAULT 185000,
  `reward_points` INT DEFAULT 350,
  `failed_login_attempts` INT NOT NULL DEFAULT 0,
  `lockout_stage` INT NOT NULL DEFAULT 0,
  `locked_until` DATETIME NULL DEFAULT NULL,
  `is_permanently_locked` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 7. TABEL SERVICES (KATALOG LAYANAN)
CREATE TABLE IF NOT EXISTS `services` (
  `id_services` INT AUTO_INCREMENT PRIMARY KEY,
  `name_services` VARCHAR(150) NOT NULL,
  `description` TEXT NOT NULL,
  `price` INT NOT NULL,
  `units_id` INT NOT NULL,
  `service_categories_id` INT NOT NULL,
  `icons_id` INT NULL,
  `duration` VARCHAR(50) NOT NULL DEFAULT '2 Hari',
  `is_popular` BOOLEAN NOT NULL DEFAULT FALSE,
  `badge_color_hex` BIGINT NOT NULL DEFAULT 4278412487,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL,
  FOREIGN KEY (`units_id`) REFERENCES `master_units`(`id_units`),
  FOREIGN KEY (`service_categories_id`) REFERENCES `master_service_categories`(`id_service_categories`),
  FOREIGN KEY (`icons_id`) REFERENCES `icons`(`id_icons`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. TABEL ORDERS (PESANAN)
CREATE TABLE IF NOT EXISTS `orders` (
  `id_orders` INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_no` VARCHAR(50) UNIQUE NOT NULL,
  `users_id` INT NOT NULL,
  `service_name` VARCHAR(150) NOT NULL,
  `service_type` VARCHAR(50) NOT NULL,
  `order_date` DATETIME NOT NULL,
  `estimated_completion_date` DATETIME NOT NULL,
  `status` VARCHAR(50) NOT NULL DEFAULT 'Menunggu Penjemputan',
  `quantity` DOUBLE NOT NULL DEFAULT 1.0,
  `unit` VARCHAR(20) NOT NULL DEFAULT 'kg',
  `price_per_unit` INT NOT NULL,
  `delivery_fee` INT NOT NULL DEFAULT 0,
  `discount` INT NOT NULL DEFAULT 0,
  `pickup_address` TEXT NOT NULL,
  `delivery_address` TEXT NOT NULL,
  `courier_name` VARCHAR(100),
  `courier_phone` VARCHAR(30),
  `notes` TEXT,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL,
  FOREIGN KEY (`users_id`) REFERENCES `users`(`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. TABEL ORDER_TIMELINES (STATUS TRACKING)
CREATE TABLE IF NOT EXISTS `order_timelines` (
  `id_order_timelines` INT AUTO_INCREMENT PRIMARY KEY,
  `orders_id` INT NOT NULL,
  `title` VARCHAR(100) NOT NULL,
  `description` TEXT NOT NULL,
  `time` VARCHAR(50) NOT NULL,
  `is_completed` BOOLEAN NOT NULL DEFAULT FALSE,
  `is_current` BOOLEAN NOT NULL DEFAULT FALSE,
  `step_order` INT NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL,
  FOREIGN KEY (`orders_id`) REFERENCES `orders`(`id_orders`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. TABEL PROMOS (VOUCHER & PROMO)
CREATE TABLE IF NOT EXISTS `promos` (
  `id_promos` INT AUTO_INCREMENT PRIMARY KEY,
  `name_promos` VARCHAR(100) NOT NULL,
  `subtitle` VARCHAR(200) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `discount_amount` INT NOT NULL,
  `min_order_amount` INT NOT NULL,
  `icon_code` VARCHAR(50) NOT NULL DEFAULT 'ticket',
  `color_hex` BIGINT NOT NULL DEFAULT 4278412487,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. TABEL ADDRESSES (ALAMAT PENJEMPUTAN)
CREATE TABLE IF NOT EXISTS `addresses` (
  `id_addresses` INT AUTO_INCREMENT PRIMARY KEY,
  `users_id` INT NOT NULL,
  `label` VARCHAR(50) NOT NULL,
  `full_address` TEXT NOT NULL,
  `note` VARCHAR(200),
  `is_default` BOOLEAN NOT NULL DEFAULT FALSE,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL,
  FOREIGN KEY (`users_id`) REFERENCES `users`(`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11.1 TABEL USER_SECURITY_QUESTIONS (PERTANYAAN KEAMANAN PELANGGAN)
CREATE TABLE IF NOT EXISTS `user_security_questions` (
  `id_user_security_questions` INT AUTO_INCREMENT PRIMARY KEY,
  `users_id` INT NOT NULL,
  `question_1` VARCHAR(255) NOT NULL,
  `answer_1` VARCHAR(255) NOT NULL,
  `question_2` VARCHAR(255) NOT NULL,
  `answer_2` VARCHAR(255) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL DEFAULT 0,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL,
  FOREIGN KEY (`users_id`) REFERENCES `users`(`id_users`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. TABEL MASTER_SHELF_TYPES
CREATE TABLE IF NOT EXISTS `master_shelf_types` (
  `id_shelf_types` INT AUTO_INCREMENT PRIMARY KEY,
  `name_shelf_types` VARCHAR(100) NOT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 13. TABEL MASTER_STORAGE_SHELVES
CREATE TABLE IF NOT EXISTS `master_storage_shelves` (
  `id_storage_shelves` INT AUTO_INCREMENT PRIMARY KEY,
  `name_storage_shelves` VARCHAR(100) NOT NULL,
  `shelf_types_id` INT NULL,
  `code` VARCHAR(50) NOT NULL,
  `capacity` INT NOT NULL DEFAULT 0,
  `location_notes` VARCHAR(255) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL,
  FOREIGN KEY (`shelf_types_id`) REFERENCES `master_shelf_types`(`id_shelf_types`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. TABEL MASTER_SERVICE_CATEGORIES
CREATE TABLE IF NOT EXISTS `master_service_categories` (
  `id_service_categories` INT AUTO_INCREMENT PRIMARY KEY,
  `name_service_categories` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `icon_code` VARCHAR(50) NULL,
  `badge_color` VARCHAR(50) NOT NULL DEFAULT 'primary',
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. TABEL MASTER_UNITS
CREATE TABLE IF NOT EXISTS `master_units` (
  `id_units` INT AUTO_INCREMENT PRIMARY KEY,
  `name_units` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `symbol` VARCHAR(20) NOT NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 16. TABEL MASTER_PERFUMES
CREATE TABLE IF NOT EXISTS `master_perfumes` (
  `id_perfumes` INT AUTO_INCREMENT PRIMARY KEY,
  `name_perfumes` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `scent_type` VARCHAR(50) NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 17. TABEL MASTER_PAYMENT_METHODS
CREATE TABLE IF NOT EXISTS `master_payment_methods` (
  `id_payment_methods` INT AUTO_INCREMENT PRIMARY KEY,
  `name_payment_methods` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `type` VARCHAR(50) NOT NULL DEFAULT 'cash',
  `account_number` VARCHAR(50) NULL,
  `account_name` VARCHAR(100) NULL,
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 18. TABEL MASTER_ORDER_STATUSES
CREATE TABLE IF NOT EXISTS `master_order_statuses` (
  `id_order_statuses` INT AUTO_INCREMENT PRIMARY KEY,
  `name_order_statuses` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `step_order` INT NOT NULL DEFAULT 1,
  `color_hex` VARCHAR(20) NOT NULL DEFAULT '#0284c7',
  `badge_variant` VARCHAR(50) NOT NULL DEFAULT 'info',
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 19. TABEL ICONS
CREATE TABLE IF NOT EXISTS `icons` (
  `id_icons` INT AUTO_INCREMENT PRIMARY KEY,
  `name_icons` VARCHAR(100) NOT NULL,
  `code` VARCHAR(50) NOT NULL,
  `category` VARCHAR(50) NOT NULL DEFAULT 'Laundry',
  `description` TEXT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `creator` BIGINT UNSIGNED NOT NULL,
  `updated_at` DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
  `update_pic` BIGINT UNSIGNED NULL,
  `deleted_at` DATETIME NULL,
  `delete_pic` BIGINT UNSIGNED NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
