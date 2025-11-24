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

    console.log('🔌 Joining room:', roomId)
    socket.emit('join-room', parseInt(roomId))

    const handleNewMessage = (message: Message) => {
      console.log('💬 New message:', message)
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
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: 'white'
    }}>
      {/* 頭部 */}
      <div style={{
        padding: '16px',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: 'white',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
              {roomInfo?.name || 'Loading...'}
            </h2>
            {roomInfo?.description && (
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0 0' }}>
                {roomInfo.description}
              </p>
            )}
          </div>
          
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px',
            padding: '4px 12px',
            backgroundColor: '#f3f4f6',
            borderRadius: '9999px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: connected ? '#10b981' : '#ef4444'
            }}></div>
            <span style={{ fontSize: '12px', fontWeight: '500', color: '#374151' }}>
              {connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* 訊息區域 */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
        backgroundColor: '#f9fafb'
      }}>
        {messages.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            textAlign: 'center'
          }}>
            <div>
              <div style={{ marginBottom: '16px', fontSize: '48px' }}>💬</div>
              <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#111827', margin: '0 0 4px 0' }}>
                No messages yet
              </h3>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
                Start the conversation by sending a message below
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {messages.map((message) => {
              const isOwnMessage = message.user_id === user?.id

              return (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    justifyContent: isOwnMessage ? 'flex-end' : 'flex-start'
                  }}
                >
                  <div style={{ maxWidth: '384px' }}>
                    {!isOwnMessage && (
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px',
                        marginBottom: '4px',
                        marginLeft: '8px'
                      }}>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#3b82f6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}>
                          {message.username.charAt(0).toUpperCase()}
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: '500', color: '#4b5563' }}>
                          {message.username}
                        </span>
                      </div>
                    )}
                    
                    <div style={{
                      padding: '8px 16px',
                      borderRadius: '16px',
                      backgroundColor: isOwnMessage ? '#2563eb' : 'white',
                      color: isOwnMessage ? 'white' : '#111827',
                      border: isOwnMessage ? 'none' : '1px solid #e5e7eb',
                      boxShadow: isOwnMessage ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      borderBottomRightRadius: isOwnMessage ? '4px' : '16px',
                      borderBottomLeftRadius: isOwnMessage ? '16px' : '4px'
                    }}>
                      <p style={{ 
                        fontSize: '14px', 
                        margin: 0,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {message.content}
                      </p>
                    </div>
                    
                    {message.created_at && (
                      <div style={{
                        fontSize: '12px',
                        color: '#9ca3af',
                        marginTop: '4px',
                        textAlign: isOwnMessage ? 'right' : 'left',
                        marginRight: isOwnMessage ? '8px' : '0',
                        marginLeft: isOwnMessage ? '0' : '8px'
                      }}>
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

      {/* 輸入區域 */}
      <div style={{
        padding: '16px',
        borderTop: '1px solid #e5e7eb',
        backgroundColor: 'white',
        flexShrink: 0
      }}>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={connected ? "Type a message..." : "Connecting..."}
            disabled={!connected || loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '14px',
              outline: 'none',
              backgroundColor: (!connected || loading) ? '#f3f4f6' : 'white',
              color: '#111827'
            }}
            autoFocus
          />
          <button
            type="submit"
            disabled={!connected || loading || !newMessage.trim()}
            style={{
              padding: '12px 24px',
              backgroundColor: (!connected || loading || !newMessage.trim()) ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              cursor: (!connected || loading || !newMessage.trim()) ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}