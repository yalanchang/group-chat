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
      r.is_private,
      r.created_by,
      r.created_at,
      r.updated_at,
      u.username as creator_name,
      CASE 
        WHEN rm.user_id IS NOT NULL THEN 1 
        ELSE 0 
      END as is_member,
      (SELECT status FROM room_join_requests 
       WHERE room_id = r.id AND user_id = ? AND status = 'pending' 
       LIMIT 1) as request_status
     FROM rooms r
     LEFT JOIN users u ON r.created_by = u.id
     LEFT JOIN room_members rm ON r.id = rm.room_id AND rm.user_id = ?
     ORDER BY r.updated_at DESC`

    const [rooms] = await pool.execute<RowDataPacket[]>(query, [req.userId, req.userId])
    res.json(rooms)
  } catch (error) {
    console.error('Error fetching rooms:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})


  router.post('/', authenticateToken, async (req: any, res) => {
    const { name, description, is_private = false, type = 'group', memberIds = [] } = req.body 
  
    try {
      if (!name) {
        return res.status(400).json({ message: 'Room name is required' })
      }
  
      const connection = await pool.getConnection()
      await connection.beginTransaction()
  
      try {
        const [roomResult] = await connection.execute<ResultSetHeader>(
          'INSERT INTO rooms (name, description, type, is_private, created_by) VALUES (?, ?, ?, ?, ?)',
          [name, description || null, type, is_private, req.userId]
        )
  
        const roomId = roomResult.insertId
  
        await connection.execute(
          'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
          [roomId, req.userId, 'admin']
        )
  
        for (const memberId of memberIds) {
          if (memberId !== req.userId) {
            await connection.execute(
              'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
              [roomId, memberId, 'member']
            )
          }
        }
  
        await connection.execute(
          'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
          [roomId, req.userId, `${req.user.username} created the room`, 'system']
        )
  
        await connection.commit()
  
        const io = (req as any).io
        if (io) {
          memberIds.forEach((memberId: number) => {
            io.to(`user-${memberId}`).emit('room-created', {
              roomId,
              name,
              createdBy: req.user.username  
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
        return res.status(403).json({ message: '無法進入私密房間' })
      }
  
      await pool.execute(
        'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
        [roomId, req.userId, 'member']
      )
  
  
      res.json({ 
        message: '成功進入房間',
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

    await pool.execute(
      'DELETE FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId]
    )

    await pool.execute(
      'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
      [roomId, req.userId, `${req.user.username} left the room`, 'system'] 
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
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ? AND role IN (?, ?)',
      [roomId, req.userId, 'admin', 'moderator']
    )

    if (members.length === 0) {
      return res.status(403).json({ message: 'Only admins and moderators can add members' })
    }

    const addedUsers = []

    for (const userId of userIds) {
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
      await pool.execute(
        'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
        [roomId, req.userId, `${req.user.username} added ${addedUsers.length} member(s) to the room`, 'system']  
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

    if (parseInt(userId) === req.userId) {
      return res.status(400).json({ message: 'Cannot remove yourself' })
    }

    const [result] = await pool.execute<ResultSetHeader>(
      'DELETE FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Member not found' })
    }

    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT username FROM users WHERE id = ?',
      [userId]
    )

    await pool.execute(
      'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
      [roomId, req.userId, `${req.user.username} removed ${users[0]?.username || 'a member'} from the room`, 'system'] 
    )

    res.json({ message: 'Member removed successfully' })
  } catch (error) {
    console.error('Error removing member:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 申請加入私密房間
router.post('/:roomId/request', authenticateToken, async (req: any, res) => {
  const { roomId } = req.params
  const { message } = req.body  // 可選的申請訊息

  try {
    // 檢查房間是否存在且為私密
    const [rooms] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM rooms WHERE id = ?',
      [roomId]
    )

    if (rooms.length === 0) {
      return res.status(404).json({ message: '房間不存在' })
    }

    const room = rooms[0]

    if (!room.is_private) {
      return res.status(400).json({ message: '公開房間可直接加入，無需申請' })
    }

    // 檢查是否已經是成員
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, req.userId]
    )

    if (members.length > 0) {
      return res.status(400).json({ message: '您已經是此房間的成員' })
    }

    // 檢查是否已有待審核的申請
    const [existingRequests] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_join_requests WHERE room_id = ? AND user_id = ? AND status = ?',
      [roomId, req.userId, 'pending']
    )

    if (existingRequests.length > 0) {
      return res.status(400).json({ message: '您已有待審核的申請' })
    }

    // 建立申請
    await pool.execute(
      'INSERT INTO room_join_requests (room_id, user_id, message) VALUES (?, ?, ?)',
      [roomId, req.userId, message || null]
    )

    res.status(201).json({ message: '申請已送出，請等待管理員審核' })

  } catch (error) {
    console.error('Error requesting to join room:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// 獲取房間的加入申請列表（僅管理員）
router.get('/:roomId/requests', authenticateToken, async (req: any, res) => {
  const { roomId } = req.params

  try {
    // 檢查是否為管理員
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ? AND role IN (?, ?)',
      [roomId, req.userId, 'admin', 'moderator']
    )

    if (members.length === 0) {
      return res.status(403).json({ message: '只有管理員可以查看申請' })
    }

    // 獲取待審核的申請
    const [requests] = await pool.execute<RowDataPacket[]>(
      `SELECT 
        r.id,
        r.room_id,
        r.user_id,
        r.message,
        r.status,
        r.created_at,
        u.username,
        u.avatar_url
       FROM room_join_requests r
       JOIN users u ON r.user_id = u.id
       WHERE r.room_id = ? AND r.status = ?
       ORDER BY r.created_at ASC`,
      [roomId, 'pending']
    )

    res.json(requests)

  } catch (error) {
    console.error('Error fetching join requests:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// 批准申請
router.post('/:roomId/requests/:requestId/approve', authenticateToken, async (req: any, res) => {
  const { roomId, requestId } = req.params

  try {
    // 檢查是否為管理員
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ? AND role IN (?, ?)',
      [roomId, req.userId, 'admin', 'moderator']
    )

    if (members.length === 0) {
      return res.status(403).json({ message: '只有管理員可以審核申請' })
    }

    // 獲取申請資訊
    const [requests] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_join_requests WHERE id = ? AND room_id = ? AND status = ?',
      [requestId, roomId, 'pending']
    )

    if (requests.length === 0) {
      return res.status(404).json({ message: '申請不存在或已處理' })
    }

    const request = requests[0]

    const connection = await pool.getConnection()
    await connection.beginTransaction()

    try {
      // 更新申請狀態
      await connection.execute(
        'UPDATE room_join_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
        ['approved', req.userId, requestId]
      )

      // 加入成員
      await connection.execute(
        'INSERT INTO room_members (room_id, user_id, role) VALUES (?, ?, ?)',
        [roomId, request.user_id, 'member']
      )

      // 發送系統訊息
      const [users] = await connection.execute<RowDataPacket[]>(
        'SELECT username FROM users WHERE id = ?',
        [request.user_id]
      )

      await connection.execute(
        'INSERT INTO messages (room_id, user_id, content, type) VALUES (?, ?, ?, ?)',
        [roomId, request.user_id, `${users[0]?.username} joined the room`, 'system']
      )

      await connection.commit()

      res.json({ message: '已批准加入申請' })

    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

  } catch (error) {
    console.error('Error approving request:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

// 拒絕申請
router.post('/:roomId/requests/:requestId/reject', authenticateToken, async (req: any, res) => {
  const { roomId, requestId } = req.params

  try {
    // 檢查是否為管理員
    const [members] = await pool.execute<RowDataPacket[]>(
      'SELECT * FROM room_members WHERE room_id = ? AND user_id = ? AND role IN (?, ?)',
      [roomId, req.userId, 'admin', 'moderator']
    )

    if (members.length === 0) {
      return res.status(403).json({ message: '只有管理員可以審核申請' })
    }

    // 更新申請狀態
    const [result] = await pool.execute<ResultSetHeader>(
      'UPDATE room_join_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ? AND room_id = ? AND status = ?',
      ['rejected', req.userId, requestId, roomId, 'pending']
    )

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: '申請不存在或已處理' })
    }

    res.json({ message: '已拒絕加入申請' })

  } catch (error) {
    console.error('Error rejecting request:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

router.get('/:roomId/request/status', authenticateToken, async (req: any, res) => {
  const { roomId } = req.params

  try {
    const [requests] = await pool.execute<RowDataPacket[]>(
      'SELECT status, created_at FROM room_join_requests WHERE room_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 1',
      [roomId, req.userId]
    )

    if (requests.length === 0) {
      return res.json({ status: null })
    }

    res.json({ status: requests[0].status, created_at: requests[0].created_at })

  } catch (error) {
    console.error('Error checking request status:', error)
    res.status(500).json({ message: '伺服器錯誤' })
  }
})

export default router