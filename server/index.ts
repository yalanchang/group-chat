import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config()

import authRouter from './routes/auth'
import messageRouter from './routes/messages'
import roomRouter from './routes/rooms'
import userProfileRoutes from './routes/profile';

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
  methods: ['GET', 'POST', 'PUT', 'DELETE',  'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}))



app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use((req: any, res, next) => {
  req.io = io
  next()
})
app.use('/uploads', express.static('public/uploads'))

app.use('/api/auth', authRouter)
app.use('/api/messages', messageRouter)
app.use('/api/rooms', roomRouter)

app.use('/api/user', userProfileRoutes);


setupSocketHandlers(io)

const PORT = process.env.PORT || 3001


server.listen(PORT, () => {
    console.log(`Server is running on ${PORT}`)
  })

export { io, pool }