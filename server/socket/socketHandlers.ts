import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import pool from '../database/connection'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

interface AuthenticatedSocket extends Socket {
  userId?: number
  username?: string
}

interface JoinRoomData {
  roomId: number
}

interface SendMessageData {
  roomId: number
  content: string
  type?: 'text' | 'image' | 'file'
  fileUrl?: string
}

interface TypingData {
  roomId: number
  isTyping: boolean
}

export function setupSocketHandlers(io: Server) {
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token
      
      if (!token) {
        return next(new Error('Authentication error'))
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any
      socket.userId = decoded.userId
      socket.username = decoded.username

      // 更新用戶狀態為在線
      await pool.execute(
        'UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?',
        ['online', decoded.userId]
      )

      next()
    } catch (err) {
      next(new Error('Authentication error'))
    }
  })

  io.on('connection', async (socket: AuthenticatedSocket) => {

    try {
      const [rooms] = await pool.execute<RowDataPacket[]>(
        `SELECT r.* FROM rooms r
         JOIN room_members rm ON r.id = rm.room_id
         WHERE rm.user_id = ?`,
        [socket.userId]
      )

      // 加入所有聊天室
      for (const room of rooms) {
        socket.join(`room-${room.id}`)
        console.log(`User ${socket.username} joined room ${room.id}`)
      }
    } catch (error) {
      console.error('Error loading user rooms:', error)
    }


socket.on('join-room', async (roomId: number) => {
  
  try {
    const [rooms] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM rooms WHERE id = ?',
      [roomId]
    )

    if (rooms.length === 0) {
      console.log('❌ Room not found:', roomId)
      socket.emit('error', { message: 'Room does not exist' })
      return
    }

    const room = rooms[0]

    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, socket.userId]
    )

    console.log('Membership check:', {
      roomId,
      userId: socket.userId,
      found: members.length > 0
    })

    if (members.length === 0) {
      if (room.created_by === socket.userId) {
        console.log('🔧 Auto-fixing: Adding creator as admin')
        await pool.execute(
          'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
          [roomId, socket.userId, 'admin']
        )
      } 
      else if (!room.is_private) {
        console.log('🔧 Auto-fixing: Adding user to public room')
        await pool.execute(
          'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
          [roomId, socket.userId, 'member']
        )
      } 
      else {
        console.log('❌ Private room access denied')
        socket.emit('error', { message: 'Access denied to private room' })
        return
      }
    }

    socket.join(`room-${roomId}`)
    console.log(`✅ ${socket.username} joined room-${roomId}`)
    
    socket.to(`room-${roomId}`).emit('user-joined', {
      userId: socket.userId,
      username: socket.username,
      roomId
    })
    
  } catch (error) {
    console.error('❌ Error in join-room:', error)
    socket.emit('error', { message: 'Failed to join room' })
  }
})

    socket.on('send-message', async (data: SendMessageData) => {
      const { roomId, content, type = 'text', fileUrl } = data

      try {
        const [members] = await pool.execute<RowDataPacket[]>(
          'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
          [roomId, socket.userId]
        )

        if (members.length === 0) {
          socket.emit('error', { message: 'You are not a member of this room' })
          return
        }

        // 插入訊息
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT INTO messages (room_id, user_id, content, type, file_url)
           VALUES (?, ?, ?, ?, ?)`,
          [roomId, socket.userId, content, type, fileUrl || null]
        )

        const [messages] = await pool.execute<RowDataPacket[]>(
          `SELECT m.*, u.username, u.avatar
           FROM messages m
           JOIN users u ON m.user_id = u.id
           WHERE m.id = ?`,
          [result.insertId]
        )

        const message = messages[0]
        io.to(`room-${roomId}`).emit('new-message', message)

        // 更新聊天室的最後更新時間
        await pool.execute(
          'UPDATE rooms SET updated_at = NOW() WHERE id = ?',
          [roomId]
        )

        // 為離線用戶創建通知
        const [offlineMembers] = await pool.execute<RowDataPacket[]>(
          `SELECT u.id FROM users u
           JOIN room_members rm ON u.id = rm.user_id
           WHERE rm.room_id = ? AND u.status = 'offline' AND u.id != ?`,
          [roomId, socket.userId]
        )

        for (const member of offlineMembers) {
          await pool.execute(
            `INSERT INTO notifications (user_id, type, title, content, related_id)
             VALUES (?, 'new_message', ?, ?, ?)`,
            [member.id, `New message from ${socket.username}`, content, roomId]
          )
        }
      } catch (error) {
        console.error('Error sending message:', error)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    socket.on('typing', (data: TypingData) => {
      const { roomId, isTyping } = data
      
      socket.to(`room-${roomId}`).emit('user-typing', {
        userId: socket.userId,
        username: socket.username,
        roomId,
        isTyping
      })
    })

    socket.on('edit-message', async (data: { messageId: number; content: string }) => {
      
      const { messageId, content } = data
    
      try {
        const [messages] = await pool.execute<RowDataPacket[]>(
          'SELECT * FROM messages WHERE id = ? AND user_id = ?',
          [messageId, socket.userId]
        )
    
    
        if (messages.length === 0) {
          socket.emit('error', { message: 'Message not found or unauthorized' })
          return
        }
    
        await pool.execute(
          'UPDATE messages SET content = ?, is_edited = TRUE WHERE id = ?',
          [content, messageId]
        )
    
        const roomId = messages[0].room_id
    
        io.to(`room-${roomId}`).emit('message-edited', {
          messageId,
          content,
          editedAt: new Date()
        })
      } catch (error) {
        console.error('Error editing message:', error)
        socket.emit('error', { message: 'Failed to edit message' })
      }
    })

  // 刪除訊息 - 只對自己隱藏
socket.on('delete-message', async (data: { messageId: number }) => {
  const { messageId } = data

  try {
    // 檢查訊息是否存在
    const [messages] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM messages WHERE id = ?',
      [messageId]
    )

    if (messages.length === 0) {
      socket.emit('error', { message: 'Message not found' })
      return
    }

    await pool.execute(
      `INSERT INTO user_deleted_messages (user_id, message_id) 
       VALUES (?, ?) 
       ON DUPLICATE KEY UPDATE deleted_at = NOW()`,
      [socket.userId, messageId]
    )

    socket.emit('message-deleted', { messageId })

  } catch (error) {
    console.error('Error deleting message:', error)
    socket.emit('error', { message: 'Failed to delete message' })
  }
})

    // 收回訊息 (所有人都會看到「訊息已收回」)
socket.on('recall-message', async (data: { roomId: number; messageId: number }) => {
  const { roomId, messageId } = data

  try {
    const [messages] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM messages WHERE id = ? AND user_id = ?',
      [messageId, socket.userId]
    )

    if (messages.length === 0) {
      socket.emit('error', { message: 'Message not found or unauthorized' })
      return
    }

    const message = messages[0]

    const messageTime = new Date(message.created_at).getTime()
    const now = Date.now()
    const twoMinutes = 2 * 60 * 1000

    if (now - messageTime > twoMinutes) {
      socket.emit('error', { message: '已超過可收回時間（2分鐘）' })
      return
    }

    // 更新訊息為已收回
    await pool.execute(
      'UPDATE messages SET is_recalled = TRUE, content = "" WHERE id = ?',
      [messageId]
    )

    // 通知聊天室內的所有人
    io.to(`room-${roomId}`).emit('message-recalled', {
      messageId
    })

  } catch (error) {
    console.error('Error recalling message:', error)
    socket.emit('error', { message: 'Failed to recall message' })
  }
})

    // 標記訊息已讀
    socket.on('mark-read', async (data: { messageId: number }) => {
      const { messageId } = data

      try {
        await pool.execute(
          `INSERT INTO message_reads (message_id, user_id)
           VALUES (?, ?)
           ON DUPLICATE KEY UPDATE read_at = NOW()`,
          [messageId, socket.userId]
        )
      } catch (error) {
        console.error('Error marking message as read:', error)
      }
    })

    // 離開聊天室
    socket.on('leave-room', (data: { roomId: number }) => {
      const { roomId } = data
      
      socket.leave(`room-${roomId}`)
      
      socket.to(`room-${roomId}`).emit('user-left', {
        userId: socket.userId,
        username: socket.username,
        roomId
      })
    })

    // 斷線處理
    socket.on('disconnect', async () => {

      try {
        await pool.execute(
          'UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?',
          ['offline', socket.userId]
        )

        // 通知所有聊天室
        const [rooms] = await pool.execute<RowDataPacket[]>(
          `SELECT room_id FROM room_members WHERE user_id = ?`,
          [socket.userId]
        )

        for (const room of rooms) {
          socket.to(`room-${room.room_id}`).emit('user-offline', {
            userId: socket.userId,
            username: socket.username
          })
        }
      } catch (error) {
        console.error('Error updating user status:', error)
      }
    })
  })
}