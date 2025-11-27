CREATE DATABASE chat_app CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE chat_app;

-- =============================================
-- 1. 用戶表
-- =============================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar VARCHAR(255) DEFAULT NULL,
    status ENUM('online', 'offline', 'away') DEFAULT 'offline',
    last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 2. 聊天室表
-- =============================================
CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    type ENUM('private', 'group', 'public') DEFAULT 'group',
    avatar VARCHAR(255) DEFAULT NULL,
    created_by INT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_type (type),
    INDEX idx_created_by (created_by),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 3. 聊天室成員表
-- =============================================
CREATE TABLE room_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('admin', 'moderator', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_muted BOOLEAN DEFAULT FALSE,
    muted_until TIMESTAMP NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_room_user (room_id, user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 4. 訊息表
-- =============================================
CREATE TABLE messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    type ENUM('text', 'image', 'file', 'audio', 'video', 'system') DEFAULT 'text',
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size INT,
    reply_to INT DEFAULT NULL,
    is_edited BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_room_created (room_id, created_at),
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_is_deleted (is_deleted)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 5. 訊息已讀狀態表
-- =============================================
CREATE TABLE message_reads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_message_user (message_id, user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_message_id (message_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 6. 好友關係表
-- =============================================
CREATE TABLE friendships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    friend_id INT NOT NULL,
    status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_friendship (user_id, friend_id),
    INDEX idx_status (status),
    INDEX idx_user_id (user_id),
    INDEX idx_friend_id (friend_id),
    CHECK (user_id != friend_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 7. 通知表
-- =============================================
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    type ENUM('message', 'friend_request', 'room_invite', 'mention', 'system') NOT NULL,
    title VARCHAR(255),
    content TEXT,
    related_id INT,
    related_type VARCHAR(50),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_unread (user_id, is_read),
    INDEX idx_created_at (created_at),
    INDEX idx_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 8. 使用者封鎖表
-- =============================================
CREATE TABLE user_blocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    blocker_id INT NOT NULL,
    blocked_id INT NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_block (blocker_id, blocked_id),
    INDEX idx_blocker (blocker_id),
    INDEX idx_blocked (blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 9. 檔案上傳記錄表
-- =============================================
CREATE TABLE file_uploads (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    room_id INT,
    message_id INT,
    file_url VARCHAR(500) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    mime_type VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_room_id (room_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 10. 使用者設定表
-- =============================================
CREATE TABLE user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    notification_enabled BOOLEAN DEFAULT TRUE,
    notification_sound BOOLEAN DEFAULT TRUE,
    notification_desktop BOOLEAN DEFAULT TRUE,
    theme ENUM('light', 'dark', 'auto') DEFAULT 'auto',
    language VARCHAR(10) DEFAULT 'zh-TW',
    timezone VARCHAR(50) DEFAULT 'Asia/Taipei',
    privacy_online_status BOOLEAN DEFAULT TRUE,
    privacy_last_seen BOOLEAN DEFAULT TRUE,
    privacy_read_receipts BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================
-- 插入測試資料
-- =============================================

-- 測試用戶（密碼都是 'password123' 的 bcrypt hash）
INSERT INTO users (username, email, password, status) VALUES
('admin', 'admin@example.com', '$2a$10$YourHashedPasswordHere', 'offline'),
('alice', 'alice@example.com', '$2a$10$YourHashedPasswordHere', 'offline'),
('bob', 'bob@example.com', '$2a$10$YourHashedPasswordHere', 'offline'),
('charlie', 'charlie@example.com', '$2a$10$YourHashedPasswordHere', 'offline'),
('test', 'test@example.com', '$2a$10$YourHashedPasswordHere', 'offline');

-- 測試聊天室
INSERT INTO rooms (name, description, type, created_by) VALUES
('General', '一般討論區', 'public', 1),
('Random', '隨意聊天', 'public', 1),
('Tech Talk', '技術討論', 'group', 2),
('Gaming', '遊戲討論', 'group', 3);

-- 加入聊天室成員
INSERT INTO room_members (room_id, user_id, role) VALUES
-- General 聊天室
(1, 1, 'admin'),
(1, 2, 'member'),
(1, 3, 'member'),
(1, 4, 'member'),
-- Random 聊天室
(2, 1, 'admin'),
(2, 2, 'member'),
(2, 3, 'member'),
-- Tech Talk 聊天室
(3, 2, 'admin'),
(3, 1, 'member'),
(3, 4, 'member'),
-- Gaming 聊天室
(4, 3, 'admin'),
(4, 1, 'member'),
(4, 2, 'member');

-- 測試訊息
INSERT INTO messages (room_id, user_id, content, type) VALUES
(1, 1, '歡迎來到 General 聊天室！', 'system'),
(1, 2, '大家好！', 'text'),
(1, 3, '嗨！很高興見到大家', 'text'),
(1, 1, '歡迎新成員加入', 'text'),
(2, 1, '這是 Random 聊天室', 'system'),
(2, 2, '今天天氣真好', 'text'),
(2, 3, '確實不錯呢', 'text'),
(3, 2, '有人知道 React 18 的新功能嗎？', 'text'),
(3, 1, 'Suspense 和 Concurrent Mode 很有趣', 'text'),
(4, 3, '有人要一起玩遊戲嗎？', 'text');

-- 測試好友關係
INSERT INTO friendships (user_id, friend_id, status) VALUES
(1, 2, 'accepted'),
(2, 1, 'accepted'),
(1, 3, 'accepted'),
(3, 1, 'accepted'),
(2, 3, 'pending'),
(4, 1, 'pending');

-- 測試通知
INSERT INTO notifications (user_id, type, title, content, related_id, related_type) VALUES
(1, 'friend_request', '好友請求', 'Charlie 想要加你為好友', 4, 'user'),
(2, 'message', '新訊息', '你有來自 Tech Talk 的新訊息', 3, 'room'),
(3, 'room_invite', '聊天室邀請', '你被邀請加入 Secret Room', 5, 'room');

-- 用戶設定
INSERT INTO user_settings (user_id) 
SELECT id FROM users;

-- 如果 users 表還沒有這些欄位，請添加
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS birthday DATE DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender ENUM('male', 'female', 'other', 'prefer_not_to_say') DEFAULT 'prefer_not_to_say';
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255) DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- 建立使用者統計表
CREATE TABLE IF NOT EXISTS user_stats (
  user_id INT PRIMARY KEY,
  total_messages INT DEFAULT 0,
  total_rooms_joined INT DEFAULT 0,
  total_rooms_created INT DEFAULT 0,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);


-- 建立完整的 user_settings 表
CREATE TABLE user_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL UNIQUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT FALSE,
  show_online_status BOOLEAN DEFAULT TRUE,
  allow_private_messages BOOLEAN DEFAULT TRUE,
  theme VARCHAR(10) DEFAULT 'light',
  language VARCHAR(10) DEFAULT 'zh-TW',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE user_deleted_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  message_id INT NOT NULL,
  deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_message (user_id, message_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (message_id) REFERENCES messages(id)
);

CREATE TABLE room_join_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  room_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT,  
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  reviewed_by INT, 
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE KEY unique_request (room_id, user_id, status) 
);

UPDATE rooms SET description = NULL WHERE description = '0' OR description = '';
DESCRIBE rooms;