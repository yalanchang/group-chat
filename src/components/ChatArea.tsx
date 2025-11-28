'use client'
import { useEffect, useState, useRef } from 'react'
import { useSocket } from '@/providers/SocketProvider'
import { useAuth } from '@/providers/AuthProvider'
import MessageInput from './MessageInput'

interface Message {
  id: number
  room_id: number
  user_id: number
  username: string
  avatar?: string
  content: string
  type: string
  file_url?: string
  file_name?: string
  file_size?: number
  created_at: string
  is_recalled?: boolean
  is_edited?: boolean
}

interface TypingUser {
  userId: number
  username: string
}

interface ChatAreaProps {
  roomId: string
  onBack?: () => void
}

export default function ChatArea({ roomId, onBack }: ChatAreaProps) {
  const { socket, connected } = useSocket()
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [roomInfo, setRoomInfo] = useState<any>(null)
  const [activeMenu, setActiveMenu] = useState<number | null>(null)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])

  const [editingMessage, setEditingMessage] = useState<Message | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
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

    const handleMessageRecalled = ({ messageId }: { messageId: number }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, is_recalled: true, content: '' } : msg
        )
      )
    }

    const handleMessageDeleted = ({ messageId }: { messageId: number }) => {
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    }

    const handleMessageEdited = ({ messageId, content }: { messageId: number; content: string }) => {

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, content, is_edited: true } : msg
        )
      )
    }
    const handleUserTyping = (data: { userId: number; username: string; roomId: string; isTyping: boolean }) => {
      if (data.userId === user?.id) return

      if (data.isTyping) {
        setTypingUsers((prev) => {
          if (prev.find(u => u.userId === data.userId)) return prev
          return [...prev, { userId: data.userId, username: data.username }]
        })
      } else {
        setTypingUsers((prev) => prev.filter(u => u.userId !== data.userId))
      }
    }

    const handleError = (error: any) => {
      console.error('❌ Socket error:', error)
    }

    socket.on('new-message', handleNewMessage)
    socket.on('message-recalled', handleMessageRecalled)
    socket.on('message-deleted', handleMessageDeleted)
    socket.on('message-edited', handleMessageEdited)
    socket.on('user-typing', handleUserTyping)
    socket.on('error', handleError)

    return () => {
      socket.emit('leave-room', parseInt(roomId))
      socket.off('new-message', handleNewMessage)
      socket.off('message-recalled', handleMessageRecalled)
      socket.off('message-deleted', handleMessageDeleted)
      socket.off('message-edited', handleMessageEdited)
      socket.off('user-typing', handleUserTyping)
      socket.off('error', handleError)
    }
  }, [socket, roomId, user?.id])

  const handleSendMessage = async (content: string, type?: string, file?: File) => {
    if (!socket || !connected) return
  
    if (editingMessage) {
      socket.emit('edit-message', {
        roomId: parseInt(roomId),
        messageId: editingMessage.id,
        content
      })
      setEditingMessage(null)
    } else if (file) {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('roomId', roomId)
      formData.append('type', type || 'file')
      if (content) formData.append('content', content)
  
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('http://localhost:3001/api/messages/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        })
  
        if (!response.ok) {
          throw new Error('上傳失敗')
        }
      } catch (error) {
        console.error('上傳錯誤:', error)
        alert('檔案上傳失敗')
      }
    } else {
      socket.emit('send-message', {
        roomId: parseInt(roomId),
        content,
        type: 'text'
      })
    }
  }

  // 開始編輯訊息
  const handleStartEdit = (message: Message) => {
    setEditingMessage(message)
    setActiveMenu(null)
  }

  // 取消編輯
  const handleCancelEdit = () => {
    setEditingMessage(null)
  }

  // 收回訊息
  const handleRecallMessage = async (messageId: number) => {
    if (!socket || !connected) return

    socket.emit('recall-message', {
      roomId: parseInt(roomId),
      messageId
    })
    setActiveMenu(null)
  }

  // 刪除訊息
  const handleDeleteMessage = async (messageId: number) => {
    if (!socket || !connected) return

    socket.emit('delete-message', {
      roomId: parseInt(roomId),
      messageId
    })
    setMessages((prev) => prev.filter((msg) => msg.id !== messageId))
    setActiveMenu(null)
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

  // 檢查訊息是否可以編輯（5分鐘內）
  const canEditMessage = (message: Message) => {
    if (message.user_id !== user?.id) return false
    if (message.is_recalled) return false

    const messageTime = new Date(message.created_at).getTime()
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    return now - messageTime < fiveMinutes
  }

  const getTypingText = () => {
    if (typingUsers.length === 0) return null
    if (typingUsers.length === 1) {
      return `${typingUsers[0].username} 正在輸入...`
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].username} 和 ${typingUsers[1].username} 正在輸入...`
    }
    return `${typingUsers.length} 人正在輸入...`
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* 頭部 */}
      <div className="px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="lg:hidden p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">
              {roomInfo?.name || 'Loading...'}
            </h2>
            {roomInfo?.description && (
              <p className="text-sm text-gray-500 mt-0.5">{roomInfo.description}</p>
            )}
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${connected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            {connected ? '已連線' : '連線中...'}
          </div>
        </div>
      </div>

      {/* 訊息區 */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-lg font-medium">尚未有聊天訊息</p>
            <p className="text-sm">開始聊天吧</p>
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
      ? 'bg-gray-200 text-gray-500 italic'
      : isOwnMessage
        ? 'bg-blue-500 text-white rounded-br-md'
        : 'bg-white text-gray-900 rounded-bl-md shadow-sm border border-gray-100'
  }`}
>
  {message.is_recalled ? (
    '訊息已收回'
  ) : message.type === 'image' && message.file_url ? (
    // 圖片訊息
    <div>
      <img
        src={`http://localhost:3001${message.file_url}`}
        alt={message.file_name || '圖片'}
        className="max-w-[240px] max-h-[240px] rounded-lg cursor-pointer"
        onClick={() => window.open(`http://localhost:3001${message.file_url}`, '_blank')}
      />
      {message.content && (
        <p className="mt-2">{message.content}</p>
      )}
    </div>
  ) : message.type === 'file' && message.file_url ? (
    // 檔案訊息
    <a
      href={`http://localhost:3001${message.file_url}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-2 rounded-lg ${
        isOwnMessage ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-100 hover:bg-gray-200'
      } transition-colors`}
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
        isOwnMessage ? 'bg-blue-400' : 'bg-gray-300'
      }`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{message.file_name || '檔案'}</p>
        {message.file_size != null && (
          <p className={`text-xs ${isOwnMessage ? 'text-blue-200' : 'text-gray-500'}`}>
            {formatFileSize(message.file_size)}
          </p>
        )}
      </div>
      <svg className={`w-5 h-5 ${isOwnMessage ? 'text-blue-200' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
    </a>
  ) : (
    // 文字訊息
    <>
      {message.content}
      {message.is_edited && (
        <span className={`text-xs ml-2 ${isOwnMessage ? 'text-blue-200' : 'text-gray-400'}`}>
          (已編輯)
        </span>
      )}
    </>
  )}
</div>


                        {/* 操作選單 */}
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

                            {activeMenu === message.id && (
                              <div
                                ref={menuRef}
                                className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] z-10"
                              >
                                {/* 編輯按鈕 */}
                                {canEditMessage(message) && (
                                  <button
                                    onClick={() => handleStartEdit(message)}
                                    className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    編輯訊息
                                  </button>
                                )}

                                {/* 收回按鈕 */}
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

                                {/* 刪除按鈕 */}
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

      {/* 正在輸入提示 */}
      {typingUsers.length > 0 && (
        <div className="px-6 py-2 bg-gray-50 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <span>{getTypingText()}</span>
          </div>
        </div>
      )}

      {/* 輸入區 */}
      <MessageInput
        onSendMessage={handleSendMessage}
        roomId={roomId}
        editingMessage={editingMessage ? editingMessage.id.toString() : null}
        editingContent={editingMessage?.content}
        onCancelEdit={handleCancelEdit}
      />
    </div>
  )
}