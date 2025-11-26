import { Router } from 'express'
import pool from '../database/connection'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import { authenticateToken } from '../middleware/auth'

const router = Router()

router.get('/', authenticateToken, async (req: any, res) => {
    try {
  
      const query = `SELECT DISTINCT
        r.id,
        r.name,
        r.description,
        r.created_by,
        r.created_at,
        r.updated_at,
        u.username as creator_name,
        CASE 
          WHEN rm.user_id IS NOT NULL THEN 1 
          ELSE 0 
        END as member
       FROM rooms r
       LEFT JOIN users u ON r.created_by = u.id
       LEFT JOIN room_members rm ON r.id = rm.room_id AND rm.user_id = ?
       ORDER BY r.updated_at DESC, r.created_at DESC`
  
  
      const [rooms] = await pool.execute<RowDataPacket[]>(query, [req.userId])
        
      res.json(rooms)
    } catch (error: any) {
      console.error('❌ Error fetching rooms:')
      console.error('Error message:', error.message)
      console.error('Error code:', error.code)
      console.error('Error stack:', error.stack)
      res.status(500).json({ 
        message: 'Internal server error',
        error: error.message
      })
    }
  })


router.post('/', authenticateToken, async (req: any, res) => {
  const { name, description, type = 'group', memberIds = [] } = req.body

  try {
    if (!name) {
      return res.status(400).json({ message: 'Room name is required' })
    }

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      const [roomResult] = await connection.execute<ResultSetHeader>(
        'INSERT INTO rooms (name, description, type, created_by) VALUES (?, ?, ?, ?)',
        [name, description || null, type, req.userId]
      )

      const roomId = roomResult.insertId

      // 添加創建者為管理員
      await connection.execute(
        'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
        [roomId, req.userId, 'admin']
      )

      // 添加其他成員
      for (const memberId of memberIds) {
        if (memberId !== req.userId) {
          await connection.execute(
            'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
            [roomId, memberId, 'member']
          )
        }
      }

      // 創建系統訊息
      await connection.execute(
        'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
        [roomId, req.userId, `${req.username} created the room`, 'system']
      )

      await connection.commit()

      // 通知新成員（透過 Socket.io）
      const io = (req as any).io
      if (io) {
        memberIds.forEach((memberId: number) => {
          io.to(`user-${memberId}`).emit('room-created', {
            roomId,
            name,
            createdBy: req.username
          })
        })
      }

      res.status(201).json({
        message: 'Room created successfully',
        roomId
      })
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  } catch (error) {
    console.error('Error creating room:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 獲取單個房間資訊
router.get('/:roomId', authenticateToken, async (req: any, res) => {
    const { roomId } = req.params
  
    try {
      console.log('Fetching room info for room:', roomId)
  
      // 檢查用戶是否為成員
      const [members] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, req.userId]
      )
  
      if (members.length === 0) {
        return res.status(403).json({ message: 'Access denied' })
      }
  
      const [rooms] = await pool.execute<RowDataPacket[]>(
        `SELECT r.*, u.username as creator_name
         FROM rooms r
         LEFT JOIN users u ON r.created_by = u.id
         WHERE r.id = ?`,
        [roomId]
      )
  
      if (rooms.length === 0) {
        return res.status(404).json({ message: 'Room not found' })
      }
  
      const [memberList] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          u.id,
          u.username,
          u.avatar,
          u.status,
          u.last_seen,
          rm.role,
          rm.joined_at
         FROM room_members rm
         JOIN users u ON rm.user_id = u.id
         WHERE rm.room_id = ?
         ORDER BY rm.role = 'admin' DESC, rm.role = 'moderator' DESC, u.username ASC`,
        [roomId]
      )
  
      res.json({
        room: rooms[0],
        members: memberList
      })
    } catch (error) {
      console.error('Error fetching room details:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  })
  
  //獲取房間訊息
  router.get('/:roomId/messages', authenticateToken, async (req: any, res) => {
    const { roomId } = req.params
  
    try {
      console.log('Fetching messages for room:', roomId, 'user:', req.userId)
  
      // 檢查用戶是否為房間成員
      const [members] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, req.userId]
      )
  
      console.log('Member check:', members.length > 0 ? 'PASS' : 'FAIL')
  
      if (members.length === 0) {
        return res.status(403).json({ message: 'Access denied' })
      }
  
      const [messages] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          m.*,
          u.username,
          u.avatar
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.room_id = ?
         ORDER BY m.created_at ASC
         LIMIT 100`,
        [roomId]
      )
  
  
      res.json(messages)
    } catch (error) {
      console.error('❌ Error fetching messages:', error)
      res.status(500).json({ message: 'Internal server error' })
    }
  })

// 更新
router.put('/:roomId', authenticateToken, async (req: any, res) => {
  const { roomId } = req.params
  const { name, description } = req.body

  try {
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ? AND role IN (?, ?)',
      [roomId, req.userId, 'admin', 'moderator']
    )

    if (members.length === 0) {
      return res.status(403).json({ message: 'Only admins and moderators can update room info' })
    }

    const updates = []
    const values = []
    const [messages] = await pool.execute<RowDataPacket[]>(
        `SELECT 
          m.id,
          m.room_id as roomId,
          m.content as message,
          m.user_id as userId,
          u.username,
          m.created_at as timestamp
         FROM messages m
         JOIN users u ON m.user_id = u.id
         WHERE m.room_id = ?
         ORDER BY m.created_at ASC
         LIMIT 50`,
        [roomId]
      )
    if (name) {
      updates.push('name = ?')
      values.push(name)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: 'No fields to update' })
    }

    values.push(roomId)

    await pool.execute(
      `UPDATE rooms SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    res.json({ message: "房間資訊已更新" })
  } catch (error) {
    console.error('Error updating room:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

router.post('/:roomId/join', authenticateToken, async (req: any, res) => {
    const { roomId } = req.params
  
    try {
      const [rooms] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM rooms WHERE id = ?',
        [roomId]
      )
  
      if (rooms.length === 0) {
        return res.status(404).json({ message: 'Room not found' })
      }
  
      const room = rooms[0]
  
      const [existingMembers] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, req.userId]
      )
  
      if (existingMembers.length > 0) {
        return res.json({ message: 'Already a member' })
      }
  
      if (room.is_private) {
        return res.status(403).json({ message: 'Cannot join private room' })
      }
  
      await pool.execute(
        'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
        [roomId, req.userId, 'member']
      )
  
  
      res.json({ 
        message: 'Successfully joined room',
        room: {
          id: room.id,
          name: room.name
        }
      })
  
    } catch (error: any) {
      console.error('❌ Error in join room:')
      console.error('Error message:', error.message)
      console.error('Error code:', error.code)
      console.error('Error sqlMessage:', error.sqlMessage)
      console.error('Error stack:', error.stack)
      
      res.status(500).json({ 
        message: 'Failed to join room',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    }
  })


// 離開
router.post('/:roomId/leave', authenticateToken, async (req: any, res) => {
  const { roomId } = req.params

  try {
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId]
    )

    if (members.length === 0) {
      return res.status(400).json({ message: 'Not a member of this room' })
    }

    // 刪除成員資格
    await pool.execute(
      'DELETE FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId]
    )

    // 創建系統訊息
    await pool.execute(
      'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
      [roomId, req.userId, `${req.username} left the room`, 'system']
    )

    res.json({ message: 'Left room successfully' })
  } catch (error) {
    console.error('Error leaving room:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 添加成員到聊天室
router.post('/:roomId/members', authenticateToken, async (req: any, res) => {
  const { roomId } = req.params
  const { userIds } = req.body

  try {
    // 檢查請求者是否為管理員或版主
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ? AND role IN (?, ?)',
      [roomId, req.userId, 'admin', 'moderator']
    )

    if (members.length === 0) {
      return res.status(403).json({ message: 'Only admins and moderators can add members' })
    }

    const addedUsers = []

    for (const userId of userIds) {
      // 檢查是否已經是成員
      const [existing] = await pool.execute<RowDataPacket[]>(
        'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
        [roomId, userId]
      )

      if (existing.length === 0) {
        await pool.execute(
          'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
          [roomId, userId]
        )
        addedUsers.push(userId)
      }
    }

    if (addedUsers.length > 0) {
      // 創建系統訊息
      await pool.execute(
        'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
        [roomId, req.userId, `${req.username} added ${addedUsers.length} member(s) to the room`, 'system']
      )
    }

    res.json({ 
      message: 'Members added successfully',
      addedUsers 
    })
  } catch (error) {
    console.error('Error adding members:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 移除成員
router.delete('/:roomId/members/:userId', authenticateToken, async (req: any, res) => {
  const { roomId, userId } = req.params

  try {
    // 檢查請求者是否為管理員
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ? AND role = ?',
      [roomId, req.userId, 'admin']
    )

    if (members.length === 0) {
      return res.status(403).json({ message: 'Only admins can remove members' })
    }

    // 不能移除自己
    if (parseInt(userId) === req.userId) {
      return res.status(400).json({ message: 'Cannot remove yourself' })
    }

    // 移除成員
    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Member not found' })
    }

    // 創建系統訊息
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT username FROM users WHERE id = ?',
      [userId]
    )

    await pool.execute(
      'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
      [roomId, req.userId, `${req.username} removed ${users[0]?.username || 'a member'} from the room`, 'system']
    )

    res.json({ message: 'Member removed successfully' })
  } catch (error) {
    console.error('Error removing member:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router