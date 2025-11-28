'use client'

import { useEffect, useRef, useState } from 'react'
import { useSocket } from '@/providers/SocketProvider'
import heic2any from 'heic2any'


interface MessageInputProps {
  onSendMessage: (content: string, type?: string, file?: File) => void
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
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isConverting, setIsConverting] = useState(false)  
  const { startTyping, stopTyping } = useSocket()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const typingTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (editingContent) {
      setMessage(editingContent)
      inputRef.current?.focus()
    }
  }, [editingContent])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (selectedFile) {
      const fileType = selectedFile.type.startsWith('image/') ? 'image' : 'file'
      onSendMessage('', fileType, selectedFile)
      handleClearFile()
    } else if (message.trim()) {
      onSendMessage(message.trim())
      setMessage('')
    }

    handleStopTyping()
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

  const handleFileSelect =async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 20 * 1024 * 1024) {
      alert('檔案大小不能超過 20MB')
      return
    }

    setShowAttachMenu(false)
    e.target.value = ''

    const ext = file.name.toLowerCase().split('.').pop()
    const isHeic = ext === 'heic' || ext === 'heif'

    if (isHeic) {
      try {
        setIsConverting(true)
        setSelectedFile(file)
        
        const convertedBlob = await heic2any({
          blob: file,
          toType: 'image/jpeg',
          quality: 0.9
        })

        const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        
      } catch (error) {
        console.error('HEIC 轉換失敗:', error)
        alert('圖片預覽失敗，但仍可上傳')
        setPreviewUrl(null)
      } finally {
        setIsConverting(false)
      }
    } else if (file.type.startsWith('image/')) {
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    } else {
      setSelectedFile(file)
      setPreviewUrl(null)
    }
  
  }

  const handleClearFile = () => {
    setSelectedFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }
  return (
    <div className="px-6 py-4 border-t border-gray-200 bg-white">
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
            <span className="text-sm text-primary-700">編輯訊息</span>
          </div>
          <button
            onClick={handleCancelEdit}
            className="text-sm text-primary-600 hover:text-primary-700"
          >
            取消</button>
        </div>
      )}
   {selectedFile && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            {isConverting ? (
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex flex-col items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
                <span className="text-xs text-gray-500 mt-2">轉換中...</span>
              </div>
            ) : previewUrl ? (
              <div className="relative">
                <img src={previewUrl} alt="預覽" className="w-20 h-20 object-cover rounded-lg" />
              </div>
            ) : (
              <div className="w-12 h-12 bg-gray-200 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            )}

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
              <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
            </div>

            <button
              onClick={handleClearFile}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="flex items-end space-x-2">
        <div className="flex-1 relative">
          <textarea
            ref={inputRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={selectedFile ? "新增說明文字（選填）..." : "輸入訊息..."}
            rows={1}
            className="w-full px-4 py-3 bg-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 max-h-32"
            style={{
              minHeight: '48px',
              height: message.split('\n').length > 1 ? 'auto' : '48px',
            }}
          />

          <button type="button" className="absolute right-3 bottom-3 text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>


        {/* 附件按鈕 */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setShowAttachMenu(!showAttachMenu)}
            className={`p-3 rounded-full transition-colors ${showAttachMenu ? 'bg-primary-100 text-primary-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>

          {/* 附件選單 */}
          {showAttachMenu && (
            <div className="absolute bottom-full right-0 mb-2 bg-white rounded-xl shadow-lg border border-gray-200 py-2 min-w-[160px] z-10">
              {/* 照片 */}
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <span>照片</span>
              </button>

              {/* 檔案 */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span>檔案</span>
              </button>
            </div>
          )}

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>

        <button
          type="submit"
          disabled={!message.trim()}
          className={`p-3 rounded-full transition ${message.trim()
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