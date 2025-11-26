import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import pool from '../database/connection'
import { RowDataPacket, ResultSetHeader } from 'mysql2'
import { authenticateToken } from '../middleware/auth'

const router = Router()

// 註冊
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body

  try {
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' })
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' })
    }

    const [existingUsers] = await pool.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [username, email]
    )

    if (existingUsers.length > 0) {
      return res.status(409).json({ message: 'Username or email already exists' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const [result] = await pool.execute<ResultSetHeader>(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword]
    )

    const token = jwt.sign(
      { 
        userId: result.insertId, 
        username,
        email 
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    )

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: result.insertId,
        username,
        email
      }
    })
  } catch (error) {
    console.error('Registration error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 登入
router.post('/login', async (req, res) => {
  const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required' })
    }

    try {
        const [users] = await pool.execute<RowDataPacket[]>(
          'SELECT * FROM users WHERE username = ?',
          [username]
        )

    if (users.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const user = users[0]
    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
        return res.status(401).json({ message: 'Invalid credentials' })
      }

      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET!,
        { expiresIn: '7d' }
      )

    await pool.execute(
      'UPDATE users SET last_seen = NOW() WHERE id = ?',
      [user.id]
    )


    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

// 獲取當前用戶資訊
router.get('/me', authenticateToken, async (req: any, res) => {
  try {
    const [users] = await pool.execute<RowDataPacket[]>(
      'SELECT id, username, email, avatar, status, created_at FROM users WHERE id = ?',
      [req.userId]
    )

    if (users.length === 0) {
      return res.status(404).json({ message: 'User not found' })
    }

    res.json({ user: users[0] })
  } catch (error) {
    console.error('Error fetching user:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})


// 登出
router.post('/logout', authenticateToken, async (req: any, res) => {
  try {
    await pool.execute(
      'UPDATE users SET status = ?, last_seen = NOW() WHERE id = ?',
      ['offline', req.userId]
    )

    res.json({ message: 'Logged out successfully' })
  } catch (error) {
    console.error('Logout error:', error)
    res.status(500).json({ message: 'Internal server error' })
  }
})

export default router