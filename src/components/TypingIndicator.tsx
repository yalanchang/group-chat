'use client'

interface TypingIndicatorProps {
  username: string
}

export default function TypingIndicator({ username }: TypingIndicatorProps) {
  return (
    <div className="flex items-center space-x-2 text-gray-500 text-sm">
      <span>{username} is typing</span>
      <div className="flex space-x-1">
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
        <span className="typing-dot"></span>
      </div>
    </div>
  )
}