'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuth } from './AuthProvider'

interface SocketContextType {
  socket: Socket | null
  connected: boolean
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [connected, setConnected] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      return
    }

    const token = localStorage.getItem('token')
    
    const newSocket = io('http://localhost:3001', {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling'], 
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    // 連接成功
    newSocket.on('connect', () => {
      setConnected(true)
    })

    // 連接失敗
    newSocket.on('connect_error', (error) => {
      console.error('❌ SocketProvider: Connection error:', error.message)
      setConnected(false)
    })

    // 斷開連接
    newSocket.on('disconnect', (reason) => {
      console.log('⚠️ SocketProvider: Disconnected:', reason)
      setConnected(false)
    })

    // 重新連接嘗試
    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('SocketProvider: Reconnection attempt:', attemptNumber)
    })

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('SocketProvider: Reconnected after', attemptNumber, 'attempts')
      setConnected(true)
    })

    setSocket(newSocket)

    // 清理函數
    return () => {
      newSocket.close()
    }
  }, [user])

  console.log('SocketProvider render:', { 
    hasSocket: !!socket, 
    connected,
    hasUser: !!user 
  })

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  const context = useContext(SocketContext)
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider')
  }
  return context
}