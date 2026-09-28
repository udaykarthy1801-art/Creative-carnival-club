CREATE DATABASE IF NOT EXISTS creative_carnival CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE creative_carnival;

CREATE TABLE IF NOT EXISTS registrations (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  registration_id VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  mobile CHAR(10) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  visitor_type VARCHAR(30) NOT NULL,
  college_organization VARCHAR(200) NOT NULL,
  purpose VARCHAR(30) NOT NULL,
  reference VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  lookup_token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT uq_registration_id UNIQUE (registration_id),
  CONSTRAINT uq_visitor_contacts UNIQUE (mobile, email),
  CONSTRAINT chk_mobile CHECK (mobile REGEXP '^[0-9]{10}$'),
  CONSTRAINT chk_visitor_type CHECK (visitor_type IN ('Student 11th','Student 12th','College Student','Worker / Job','General Visitor')),
  CONSTRAINT chk_purpose CHECK (purpose IN ('Event Visit','Project Exhibition','Innovation','General Visitor')),
  CONSTRAINT chk_message_length CHECK (CHAR_LENGTH(message) <= 2000),
  INDEX idx_mobile (mobile),
  INDEX idx_email (email),
  INDEX idx_created_at (created_at),
  INDEX idx_visitor_type (visitor_type),
  INDEX idx_purpose (purpose)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  csrf_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_session_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
