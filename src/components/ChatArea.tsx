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
  is_recalled?: boolean
  is_deleted?: boolean
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
  const [activeMenu, setActiveMenu] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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

    // 處理訊息收回
    const handleMessageRecalled = ({ messageId }: { messageId: number }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, is_recalled: true, content: '' } : msg
        )
      )
    }

    // 處理訊息刪除
    const handleMessageDeleted = ({ messageId }: { messageId: number }) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    }

    const handleError = (error: any) => {
      console.error('❌ Socket error:', error)
    }

    socket.on('new-message', handleNewMessage)
    socket.on('message-recalled', handleMessageRecalled)
    socket.on('message-deleted', handleMessageDeleted)
    socket.on('error', handleError)

    return () => {
      socket.emit('leave-room', parseInt(roomId))
      socket.off('new-message', handleNewMessage)
      socket.off('message-recalled', handleMessageRecalled)
      socket.off('message-deleted', handleMessageDeleted)
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

  // 收回訊息 - 所有人都會看到「訊息已收回」
  const handleRecallMessage = async (messageId: number) => {
    if (!socket || !connected) return
    
    try {
      socket.emit('recall-message', {
        roomId: parseInt(roomId),
        messageId
      })
      setActiveMenu(null)
    } catch (error) {
      console.error('❌ Error recalling message:', error)
    }
  }

  // 刪除訊息 - 僅自己看不到
  const handleDeleteMessage = async (messageId: number) => {
    if (!socket || !connected) return
    
    try {
      socket.emit('delete-message', {
        roomId: parseInt(roomId),
        messageId
      })
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
      setActiveMenu(null)
    } catch (error) {
      console.error('❌ Error deleting message:', error)
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

  // 檢查訊息是否可以收回（2分鐘內）
  const canRecallMessage = (message: Message) => {
    if (message.user_id !== user?.id) return false
    if (message.is_recalled) return false
    
    const messageTime = new Date(message.created_at).getTime()
    const now = Date.now()
    const twoMinutes = 2 * 60 * 1000
    
    return now - messageTime < twoMinutes
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {roomInfo?.name || 'Loading...'}
            </h2>
            {roomInfo?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{roomInfo.description}</p>
            )}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
            connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            {connected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">尚未有聊天訊息</p>
            <p className="text-sm">開啟聊天吧</p>
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
                  <div className={`flex items-end gap-2 max-w-[70%] ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                    {!isOwnMessage && (
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-medium">
                          {message.username.charAt(0).toUpperCase()}
                        </div>
                      </div>
                    )}

                    <div className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                      {!isOwnMessage && (
                        <span className="text-xs text-gray-500 mb-1 ml-1">{message.username}</span>
                      )}

                      <div className="relative group">
                        {/* 訊息內容 */}
                        <div
                          className={`px-4 py-2.5 rounded-2xl ${
                            message.is_recalled
                              ? 'bg-gray-200 text-gray-700 '
                              : isOwnMessage
                                ? 'bg-blue-500 text-white rounded-br-md'
                                : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
                          }`}
                        >
                          {message.is_recalled ? '訊息已收回' : message.content}
                        </div>

                        {/* 操作按鈕 - 只有自己的訊息且未被收回才顯示 */}
                        {isOwnMessage && !message.is_recalled && (
                          <div className="absolute top-1/2 -translate-y-1/2 right-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setActiveMenu(activeMenu === message.id ? null : message.id)}
                              className="p-1.5 rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                              </svg>
                            </button>

                            {/* 下拉選單 */}
                            {activeMenu === message.id && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] z-10"
                              >
                                {canRecallMessage(message) && (
                                  <button
                                    onClick={() => handleRecallMessage(message.id)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                                    </svg>
                                    收回訊息
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteMessage(message.id)}
                                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  刪除訊息
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {message.created_at && (
                        <span className="text-xs text-gray-400 mt-1 mx-1">
                          {formatTime(message.created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 輸入區域 */}
      <form onSubmit={handleSendMessage} className="px-6 py-4 bg-white border-t border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
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
            className="px-6 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>
    </div>
  )
}