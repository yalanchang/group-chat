import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization']

  const token = authHeader && authHeader.split(' ')[1] 
  

  if (!token) {
    return res.status(401).json({ message: 'Access token required' })
  }

  try {
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any
    req.user = {
      id: decoded.userId || decoded.id,  
      username: decoded.username,
      ...decoded
    }
    req.userId = decoded.userId || decoded.id
    next()
  } catch (error) {
    console.error('Token verification failed:', error)
    return res.status(403).json({ message: 'Invalid or expired token' })
  }
}