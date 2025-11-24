import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'


dotenv.config()

import authRouter from './routes/auth'
import messageRouter from './routes/messages'
import roomRouter from './routes/rooms'


import { setupSocketHandlers } from './socket/socketHandlers'
import pool from './database/connection'

const app = express()
const server = createServer(app)

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true
  },
  transports: ['websocket', 'polling']
})

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))


app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use((req: any, res, next) => {
  req.io = io
  next()
})

app.use('/api/auth', authRouter)
app.use('/api/messages', messageRouter)
app.use('/api/rooms', roomRouter)

setupSocketHandlers(io)

const PORT = process.env.PORT || 3001


server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`)
  })

export { io, pool }