import express, { Request, Response } from 'express';
import  { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import multer, { StorageEngine } from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import bcrypt from 'bcrypt'
import pool from '../database/connection'
import { authenticateToken } from '../middleware/auth'



const router = express.Router();


interface UserProfile extends RowDataPacket {
  id: number;
  username: string;
  email: string;
  password?: string;
  avatar_url?: string;
  bio?: string;
  phone?: string;
  birthday?: Date;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  location?: string;
  website?: string;
  created_at: Date;
  updated_at: Date;
  total_messages: number;
  total_rooms_joined: number;
  total_rooms_created: number;
  last_active?: Date;
  email_notifications: boolean;
  push_notifications: boolean;
  show_online_status: boolean;
  allow_private_messages: boolean;
  theme: 'light' | 'dark' | 'auto';
  language: string;
}

interface UpdateProfileBody {
  username?: string;
  bio?: string;
  phone?: string;
  birthday?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  location?: string;
  website?: string;
}

interface UpdateSettingsBody {
  email_notifications?: boolean;
  push_notifications?: boolean;
  show_online_status?: boolean;
  allow_private_messages?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  language?: string;
}

interface ChangePasswordBody {
  currentPassword: string;
  newPassword: string;
}

interface DeleteAccountBody {
  password: string;
}



const storage: StorageEngine = multer.diskStorage({
  destination: async (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    const uploadPath = 'public/uploads/avatars';
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error as Error, '');
    }
  },
  filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, 
  fileFilter: (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      cb(null, true);
    } else {
      cb(new Error('只允許上傳圖片檔案'));
    }
  }
});


router.get('/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ message: '未授權' });
      return;
    }
    
    const [users] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        id, username, email, avatar_url, bio, phone, 
        DATE_FORMAT(birthday, "%Y-%m-%d") AS birthday, gender, location, website, 
        created_at, updated_at 
       FROM users WHERE id = ?`,
      [userId]
    );
    
    if (users.length === 0) {
      res.status(404).json({ message: '使用者不存在' });
      return;
    }
    
    const user = users[0];
    
    const [messageCount] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM messages WHERE user_id = ?',
      [userId]
    );
    
    const [roomsJoined] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM room_members WHERE user_id = ?',
      [userId]
    );
    
    const [roomsCreated] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM rooms WHERE created_by = ?',
      [userId]
    );
    
    const [settings] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [userId]
    );
    
    res.json({
      ...user,
      total_messages: messageCount[0]?.count ?? 0,
      total_rooms_joined: roomsJoined[0]?.count ?? 0,
      total_rooms_created: roomsCreated[0]?.count ?? 0,
      last_active: user.updated_at,
      email_notifications: settings[0]?.email_notifications ?? true,
      push_notifications: settings[0]?.push_notifications ?? false,
      show_online_status: settings[0]?.show_online_status ?? true,
      allow_private_messages: settings[0]?.allow_private_messages ?? true,
      theme: settings[0]?.theme ?? 'light',
      language: settings[0]?.language ?? 'zh-TW'
    });
    
  } catch (error) {
    console.error('❌ 獲取使用者資料錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

router.put('/profile', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ message: '未授權' });
      return;
    }
    
    const { 
      username, 
      bio, 
      phone, 
      birthday, 
      gender, 
      location, 
      website 
    } = req.body;
    
    const sanitizedBirthday = birthday || null;
    const sanitizedPhone = phone || null;
    const sanitizedBio = bio || null;
    const sanitizedLocation = location || null;
    const sanitizedWebsite = website || null;
    const sanitizedGender = gender || null;
    
    if (username) {
      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [username, userId]
      );
      
      if (existing.length > 0) {
        res.status(400).json({ message: '此用戶名已被使用' });
        return;
      }
    }
    
    
    await pool.execute<ResultSetHeader>(`
      UPDATE users 
      SET 
        username = COALESCE(?, username),
        bio = ?,
        phone = ?,
        birthday = ?,
        gender = ?,
        location = ?,
        website = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      username, 
      sanitizedBio, 
      sanitizedPhone, 
      sanitizedBirthday,  
      sanitizedGender, 
      sanitizedLocation, 
      sanitizedWebsite, 
      userId
    ]);
    
    res.json({ message: '資料更新成功' });
  } catch (error) {
    console.error('更新使用者資料錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: any, res)  => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ message: '未授權' });
      return;
    }
    
    if (!req.file) {
      res.status(400).json({ message: '請選擇要上傳的圖片' });
      return;
    }
    
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT avatar_url FROM users WHERE id = ?',
      [userId]
    );
    
    if (users[0]?.avatar_url) {
      const oldPath = path.join('public', users[0].avatar_url);
      try {
        await fs.unlink(oldPath);
      } catch (err) {
        console.log('舊檔案可能不存在:', err);
      }
    }
    
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    await pool.execute<ResultSetHeader>(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, userId]
    );
    
    res.json({ 
      message: '頭像上傳成功',
      avatar_url: avatarUrl 
    });
  } catch (error) {
    console.error('上傳頭像錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

router.put('/settings', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ message: '未授權' });
      return;
    }
    
    const {
      email_notifications,
      push_notifications,
      show_online_status,
      allow_private_messages,
      theme,
      language
    }: UpdateSettingsBody = req.body;
    
    await pool.execute<ResultSetHeader>(`
      INSERT INTO user_settings (
        user_id,
        email_notifications,
        push_notifications,
        show_online_status,
        allow_private_messages,
        theme,
        language
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        email_notifications = VALUES(email_notifications),
        push_notifications = VALUES(push_notifications),
        show_online_status = VALUES(show_online_status),
        allow_private_messages = VALUES(allow_private_messages),
        theme = VALUES(theme),
        language = VALUES(language)
    `, [
      userId,
      email_notifications,
      push_notifications,
      show_online_status,
      allow_private_messages,
      theme,
      language
    ]);
    
    res.json({ message: '設定更新成功' });
  } catch (error) {
    console.error('更新設定錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

router.put('/password', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ message: '未授權' });
      return;
    }
    
    const { currentPassword, newPassword }: ChangePasswordBody = req.body;
    
    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: '請提供當前密碼和新密碼' });
      return;
    }
    
    if (newPassword.length < 6) {
      res.status(400).json({ message: '新密碼至少需要6個字元' });
      return;
    }
    
    // 驗證當前密碼
    const [users] = await pool.execute<UserProfile[]>(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0 || !users[0].password) {
      res.status(404).json({ message: '使用者不存在' });
      return;
    }
    
    const isValidPassword = await bcrypt.compare(currentPassword, users[0].password);
    
    if (!isValidPassword) {
      res.status(401).json({ message: '當前密碼不正確' });
      return;
    }
    
    // 加密新密碼
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密碼
    await pool.execute<ResultSetHeader>(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );
    
    res.json({ message: '密碼更新成功' });
  } catch (error) {
    console.error('更改密碼錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

router.delete('/account', authenticateToken, async (req: any, res)  => {
  try {
    const userId = req.user?.userId;
    
    if (!userId) {
      res.status(401).json({ message: '未授權' });
      return;
    }
    
    const { password }: DeleteAccountBody = req.body;
    
    if (!password) {
      res.status(400).json({ message: '請提供密碼以確認刪除' });
      return;
    }
    
    // 驗證密碼
    const [users] = await pool.execute<UserProfile[]>(
      'SELECT password, avatar_url FROM users WHERE id = ?',
      [userId]
    );
    
    if (users.length === 0 || !users[0].password) {
      res.status(404).json({ message: '使用者不存在' });
      return;
    }
    
    const isValidPassword = await bcrypt.compare(password, users[0].password);
    
    if (!isValidPassword) {
      res.status(401).json({ message: '密碼不正確' });
      return;
    }
    
    // 刪除頭像檔案
    if (users[0]?.avatar_url) {
      const avatarPath = path.join('public', users[0].avatar_url);
      try {
        await fs.unlink(avatarPath);
      } catch (err) {
        console.log('頭像檔案可能不存在:', err);
      }
    }
    
    await pool.execute<ResultSetHeader>('DELETE FROM users WHERE id = ?', [userId]);
    
    res.json({ message: '帳號已成功刪除' });
  } catch (error) {
    console.error('刪除帳號錯誤:', error);
    res.status(500).json({ message: '伺服器錯誤' });
  }
});

router.get('/managed-rooms', authenticateToken, async (req: any, res) => {
  try {
    const [rooms] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        r.id,
        r.name,
        r.is_private,
        (SELECT COUNT(*) FROM room_join_requests 
         WHERE room_id = r.id AND status = 'pending') as pending_count
       FROM rooms r
       INNER JOIN room_members rm ON r.id = rm.room_id
       WHERE rm.user_id = ? AND rm.role IN ('admin', 'moderator')
       ORDER BY pending_count DESC, r.name ASC`,
      [req.userId]
    )

    res.json(rooms)
  } catch (error) {
    console.error('Error fetching managed rooms:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router;