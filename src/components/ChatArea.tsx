'use client'

import { useEffect, useState, useRef } from 'react'
import { useSocket } from '@/providers/SocketProvider'
import { useAuth } from '@/providers/AuthProvider'

interface Message {
  id: number
  room_id: number
  user_id: number
  username: string
  avatar?: string
  content: string
  type: string
  file_url?: string
  created_at: string
}

interface ChatAreaProps {
  roomId: string
}

export default function ChatArea({ roomId }: ChatAreaProps) {
  const { socket, connected } = useSocket()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [roomInfo, setRoomInfo] = useState<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!roomId) return

    const fetchRoomData = async () => {
      try {
        const token = localStorage.getItem('token')
        
        const roomResponse = await fetch(`http://localhost:3001/api/rooms/${roomId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (roomResponse.ok) {
          const roomData = await roomResponse.json()
          setRoomInfo(roomData.room)
        }

        const messagesResponse = await fetch(`http://localhost:3001/api/rooms/${roomId}/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (messagesResponse.ok) {
          const messagesData = await messagesResponse.json()
          setMessages(messagesData)
        } else {
          setMessages([])
        }
      } catch (error) {
        console.error('Error fetching room data:', error)
        setMessages([])
      }
    }

    fetchRoomData()
  }, [roomId])

  useEffect(() => {
    if (!socket || !roomId) return

    socket.emit('join-room', parseInt(roomId))

    const handleNewMessage = (message: Message) => {
      setMessages((prev) => {
        if (prev.find(m => m.id === message.id)) return prev
        return [...prev, message]
      })
    }

    const handleError = (error: any) => {
      console.error('❌ Socket error:', error)
    }

    socket.on('new-message', handleNewMessage)
    socket.on('error', handleError)

    return () => {
      socket.emit('leave-room', parseInt(roomId))
      socket.off('new-message', handleNewMessage)
      socket.off('error', handleError)
    }
  }, [socket, roomId])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !socket || !connected) return

    try {
      setLoading(true)

      socket.emit('send-message', {
        roomId: parseInt(roomId),
        content: newMessage.trim(),
        type: 'text'
      })

      setNewMessage('')
    } catch (error) {
      console.error('❌ Error:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (timestamp: string) => {
    try {
      if (!timestamp) return ''
      const date = new Date(timestamp)
      if (isNaN(date.getTime())) return ''
      return date.toLocaleTimeString('zh-TW', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    } catch (error) {
      return ''
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden">
      <div className="flex-none p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {roomInfo?.name || 'Loading...'}
            </h2>
            {roomInfo?.description && (
              <p className="text-sm text-gray-500 mt-1">{roomInfo.description}</p>
            )}
          </div>
          
          <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-xs font-medium text-gray-700">
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* 訊息區域 */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-0">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="mb-4">
                <svg
                  className="mx-auto h-16 w-16 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">尚未有聊天訊息</h3>
              <p className="text-sm text-gray-500 mt-1">開啟聊天吧</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.user_id === user?.id

              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div className="max-w-xs lg:max-w-md">
                    {!isOwnMessage && (
                      <div className="flex items-center gap-2 mb-1 ml-2">
                        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                          {message.username.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {message.username}
                        </span>
                      </div>
                    )}
                    
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isOwnMessage
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      <p className="text-sm break-words whitespace-pre-wrap">
                        {message.content}
                      </p>
                    </div>
                    
                    {message.created_at && (
                      <div className={`text-xs text-gray-400 mt-1 ${isOwnMessage ? 'text-right mr-2' : 'ml-2'}`}>
                        {formatTime(message.created_at)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="flex-none p-4 border-t border-gray-200 bg-white">
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={connected ? "Type a message..." : "Connecting..."}
            disabled={!connected || loading}
            className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-900 placeholder-gray-400 outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!connected || loading || !newMessage.trim()}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-lg hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}