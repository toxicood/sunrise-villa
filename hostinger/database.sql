-- =========================================================
-- Sunrise Villa — MySQL tables (reference only)
-- Ye file import karne ki ZAROORAT NAHI hai:
-- tables pehli baar website khulne pe KHUD ban jaati hain.
-- Ye file sirf backup/reference ke liye hai.
-- =========================================================

CREATE TABLE IF NOT EXISTS sv_bookings (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference VARCHAR(20) NOT NULL UNIQUE,
  room_id VARCHAR(20) NOT NULL,
  room_name VARCHAR(60) NOT NULL,
  price_per_night INT NULL,
  checkin DATE NOT NULL,
  checkout DATE NOT NULL,
  nights INT NOT NULL,
  adults INT NOT NULL,
  children INT NOT NULL DEFAULT 0,
  total INT NULL,
  name VARCHAR(120) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(160) NULL,
  notes TEXT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  INDEX idx_status (status),
  INDEX idx_dates (room_id, checkin, checkout)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sv_messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NULL,
  phone VARCHAR(20) NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
