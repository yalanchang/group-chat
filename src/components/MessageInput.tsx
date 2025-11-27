'use client'

import { useEffect, useRef, useState } from 'react'
import { useSocket } from '@/providers/SocketProvider'

interface MessageInputProps {
  onSendMessage: (content: string) => void
  roomId: string
  editingMessage: string | null
  editingContent?: string
  onCancelEdit: () => void
}

export default function MessageInput({
  onSendMessage,
  roomId,
  editingMessage,
  editingContent,
  onCancelEdit,
}: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const { startTyping, stopTyping } = useSocket()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (editingContent) {
      setMessage(editingContent)
      inputRef.current?.focus()
    }
  }, [editingContent])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    
    if (message.trim()) {
      onSendMessage(message.trim())
      setMessage('')
      handleStopTyping()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleTyping = () => {
    if (!isTyping) {
      setIsTyping(true)
      startTyping(roomId)
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping()
    }, 2000)
  }

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false)
      stopTyping(roomId)
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    handleTyping()
  }

  const handleCancelEdit = () => {
    setMessage('')
    onCancelEdit()
  }

  return (
    <div className="px-6 py-4 border-t border-gray-200">
      {editingMessage && (
        <div className="flex items-center justify-between mb-2 px-3 py-2 bg-primary-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <svg
              className="w-4 h-4 text-primary-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span className="text-sm text-primary-700">Editing message</span>
          </div>
          <button
            onClick={handleCancelEdit}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            Cancel
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="w-full px-4 py-3 bg-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 max-h-32"
            style={{
              minHeight: '48px',
              height: message.split('\n').length > 1 ? 'auto' : '48px',
            }}
          />

          <button
            type="button"
            className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>

        {/* Attachment button */}
        <button
          type="button"
          className="p-3 text-gray-400 hover:text-gray-600"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
        </button>

        {/* Send button */}
        <button
          type="submit"
          disabled={!message.trim()}
          className={`p-3 rounded-full transition ${
            message.trim()
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>
    </div>
  )
}