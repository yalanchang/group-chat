import { Router } from 'express'
import pool from '../database/connection'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { authenticateToken } from '../middleware/auth'
import multer from 'multer'
import path from 'path'
import fs from 'fs'



const convertHeic = async (inputBuffer: Buffer): Promise<Buffer> => {
  // @ts-ignore
  const heicConvert = (await import('heic-convert')).default
  return await heicConvert({
    buffer: inputBuffer,
    format: 'JPEG',
    quality: 0.9
  })
}

const uploadDir = path.join(__dirname, '../../public/uploads/messages')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, uniqueSuffix + ext)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024 
  }
})

const isImageFile = (mimetype: string, filename: string) => {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif']
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif']
  const ext = path.extname(filename).toLowerCase()
  
  return imageTypes.includes(mimetype) || imageExtensions.includes(ext)
}

const isHeicFile = (mimetype: string, filename: string) => {
  const ext = path.extname(filename).toLowerCase()
  return mimetype === 'image/heic' || mimetype === 'image/heif' || ext === '.heic' || ext === '.heif'
}


const router = Router()

router.get('/room/:roomId', authenticateToken, async (req: any, res) => {
  const { roomId } = req.params
  const { page = 1, limit = 50 } = req.query
  const offset = (parseInt(page) - 1) * parseInt(limit)

  try {
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId]
    )

    if (members.length === 0) {
      return res.status(403).json({ message: 'Access denied' })
    }

    const [messages] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        m.id,
        m.content,
        m.type,
        m.file_url,
        m.is_edited,
        m.is_deleted,
        m.created_at,
        m.updated_at,
        u.id as user_id,
        u.username,
        u.avatar,
        (SELECT COUNT(*) FROM message_reads WHERE message_id = m.id) as read_count
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.room_id = ? AND m.is_deleted = FALSE
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?`,
      [roomId, parseInt(limit), offset]
    )

    // 獲取總數
    const [countResult] = await pool.execute<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM messages WHERE room_id = ? AND is_deleted = FALSE',
      [roomId]
    )

    res.json({
      messages: messages.reverse(),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult[0].total,
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 搜尋訊息
router.get('/search', authenticateToken, async (req: any, res) => {
  const { q, roomId } = req.query

  if (!q) {
    return res.status(400).json({ message: 'Search query is required' })
  }

  try {
    let query = `
      SELECT 
        m.id,
        m.content,
        m.room_id,
        m.created_at,
        u.username,
        u.avatar,
        r.name as room_name
      FROM messages m
      JOIN users u ON m.user_id = u.id
      JOIN rooms r ON m.room_id = r.id
      JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
      WHERE m.content LIKE ? AND m.is_deleted = FALSE
    `
    const params: any[] = [req.userId, `%${q}%`]

    if (roomId) {
      query += ' AND m.room_id = ?'
      params.push(roomId)
    }

    query += ' ORDER BY m.created_at DESC LIMIT 50'

    const [messages] = await pool.execute<RowDataPacket[]>(query, params)

    res.json({ messages })
  } catch (error) {
    console.error('Error searching messages:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})



router.post('/upload', authenticateToken, upload.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '請選擇檔案' })
    }

    const { roomId, type, content } = req.body

    if (!roomId) {
      return res.status(400).json({ message: '缺少 roomId' })
    }

    // 檢查是否為房間成員
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId]
    )

    if (members.length === 0) {
      fs.unlinkSync(req.file.path)
      return res.status(403).json({ message: '您不是此房間的成員' })
    }
    let fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8')
    let fileUrl = `/uploads/messages/${req.file.filename}`
    let fileSize = req.file.size

    if (isHeicFile(req.file.mimetype, fileName)) {
      try {
        console.log('🔄 開始轉換 HEIC...')
        
        const inputBuffer = fs.readFileSync(req.file.path)
        const outputBuffer = await convertHeic(inputBuffer)
        
        const jpgFilename = req.file.filename.replace(/\.(heic|heif)$/i, '.jpg')
        const jpgPath = path.join(uploadDir, jpgFilename)
        
        fs.writeFileSync(jpgPath, outputBuffer)
        
        // 刪除原始 HEIC 檔案
        fs.unlinkSync(req.file.path)

        // 更新檔案資訊
        fileUrl = `/uploads/messages/${jpgFilename}`
        fileName = fileName.replace(/\.(heic|heif)$/i, '.jpg')
        fileSize = outputBuffer.length

        console.log('✅ HEIC 轉換成功:', jpgFilename)
      } catch (convertError) {
        console.error('❌ HEIC 轉換失敗:', convertError)
        // 轉換失敗就當作一般檔案處理
      }
    }


    const messageType = isImageFile(req.file.mimetype, fileName) ? 'image' : 'file'

    const [result] = await pool.execute<ResultSetHeader>(
      `INSERT INTO messages (room_id, user_id, content, type, file_url, file_name, file_size) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [roomId, req.userId, content || '', messageType, fileUrl, fileName, fileSize]
    )

    const messageId = result.insertId

    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT username, avatar_url FROM users WHERE id = ?',
      [req.userId]
    )

    const newMessage = {
      id: messageId,
      room_id: parseInt(roomId),
      user_id: req.userId,
      username: users[0]?.username,
      avatar: users[0]?.avatar_url,
      content: content || '',
      type: messageType,
      file_url: fileUrl,
      file_name: fileName,
      file_size: fileSize,
      created_at: new Date().toISOString()
    }

    await pool.execute(
      'UPDATE rooms SET updated_at = NOW() WHERE id = ?',
      [roomId]
    )

    const io = req.app.get('io')
    if (io) {
      io.to(`room-${roomId}`).emit('new-message', newMessage)

    }

    res.status(201).json({
      message: '上傳成功',
      data: newMessage
    })

  } catch (error) {
    console.error('Error uploading file:', error)
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path)
      } catch (e) {}
    }
    res.status(500).json({ message: '上傳失敗' })
  }
})

// 獲取未讀訊息數量
router.get('/unread', authenticateToken, async (req: any, res) => {
  try {
    const [result] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        rm.room_id,
        r.name as room_name,
        COUNT(m.id) as unread_count
      FROM room_members rm
      JOIN rooms r ON rm.room_id = r.id
      JOIN messages m ON m.room_id = rm.room_id AND m.created_at > rm.last_read_at
      WHERE rm.user_id = ? AND m.user_id != ?
      GROUP BY rm.room_id, r.name`,
      [req.userId, req.userId]
    )

    res.json({ unreadCounts: result })
  } catch (error) {
    console.error('Error fetching unread counts:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 標記聊天室訊息為已讀
router.post('/room/:roomId/read', authenticateToken, async (req: any, res) => {
  const { roomId } = req.params

  try {
    // 更新最後讀取時間
    await pool.execute(
      'UPDATE room_members SET last_read_at = NOW() WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId]
    )

    // 標記所有訊息為已讀
    await pool.execute(
      `INSERT INTO message_reads (message_id, user_id)
       SELECT m.id, ? FROM messages m
       WHERE m.room_id = ? AND m.user_id != ?
       AND NOT EXISTS (
         SELECT 1 FROM message_reads mr 
         WHERE mr.message_id = m.id AND mr.user_id = ?
       )`,
      [req.userId, roomId, req.userId, req.userId]
    )

    res.json({ message: 'Messages marked as read' })
  } catch (error) {
    console.error('Error marking messages as read:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 獲取訊息的已讀狀態
router.get('/:messageId/reads', authenticateToken, async (req: any, res) => {
  const { messageId } = req.params

  try {
    // 檢查用戶是否有權限查看此訊息
    const [messages] = await pool.execute<RowDataPacket[]>(
      `SELECT m.* FROM messages m
       JOIN room_members rm ON rm.room_id = m.room_id
       WHERE m.id = ? AND rm.user_id = ?`,
      [messageId, req.userId]
    )

    if (messages.length === 0) {
      return res.status(403).json({ message: 'Access denied' })
    }

    // 獲取已讀用戶列表
    const [reads] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        u.id,
        u.username,
        u.avatar,
        mr.read_at
      FROM message_reads mr
      JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = ?
      ORDER BY mr.read_at ASC`,
      [messageId]
    )

    res.json({ reads })
  } catch (error) {
    console.error('Error fetching read status:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router