'use client'

import { useState } from 'react'

interface MessageProps {
  message: {
    id: string
    content: string
    userId: string
    createdAt: string
    editedAt?: string
    user: {
      id: string
      username: string
      avatar?: string
    }
  }
  isOwn: boolean
  onEdit: (messageId: string) => void
  onDelete: (messageId: string) => void
  isEditing: boolean
}

export default function Message({ message, isOwn, onEdit, onDelete, isEditing }: MessageProps) {
  const [showActions, setShowActions] = useState(false)

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-4 message-enter`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex max-w-xs lg:max-w-md ${isOwn ? 'flex-row-reverse' : 'flex-row'} items-end space-x-2`}>
        {/* Avatar */}
        {!isOwn && (
          <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
            <span className="text-gray-600 text-sm">
              {message.user.username.charAt(0).toUpperCase()}
            </span>
          </div>
        )}

        {/* Message bubble */}
        <div className={`relative group ${isEditing ? 'ring-2 ring-primary-500' : ''}`}>
          <div
            className={`px-4 py-2 rounded-2xl ${
              isOwn
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-900'
            }`}
          >
            {!isOwn && (
              <p className="text-xs font-medium mb-1 opacity-75">
                {message.user.username}
              </p>
            )}
            <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            <div className={`text-xs mt-1 ${isOwn ? 'text-primary-100' : 'text-gray-500'}`}>
              {formatTime(message.createdAt)}
              {message.editedAt && ' (edited)'}
            </div>
          </div>

          {/* Actions menu */}
          {showActions && isOwn && !isEditing && (
            <div className="absolute -left-20 top-0 flex items-center space-x-1">
              <button
                onClick={() => onEdit(message.id)}
                className="p-1 hover:bg-gray-200 rounded transition"
                title="Edit"
              >
                <svg
                  className="w-4 h-4 text-gray-600"
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
              </button>
              <button
                onClick={() => onDelete(message.id)}
                className="p-1 hover:bg-gray-200 rounded transition"
                title="Delete"
              >
                <svg
                  className="w-4 h-4 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}