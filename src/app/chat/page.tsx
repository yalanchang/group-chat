'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useSocket } from '@/providers/SocketProvider'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import ChatArea from '@/components/ChatArea'
import RoomList from '@/components/RoomList'

export default function ChatPage() {
  const { user, loading } = useAuth()
  const { connected } = useSocket()
  const router = useRouter()
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push('/')
    }
  }, [user, loading, router, mounted])

  // 選擇房間時在手機上自動關閉側邊欄
  const handleSelectRoom = (roomId: string | null) => {
    setSelectedRoom(roomId)
    setShowMobileSidebar(false)
  }

  // 手機版返回房間列表
  const handleBackToRooms = () => {
    setSelectedRoom(null)
  }

  if (!mounted) {
    return null
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="relative">
            <div className="w-20 h-20 border-4 border-primary-200 rounded-full animate-pulse"></div>
            <div className="w-20 h-20 border-4 border-primary-600 border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
          </div>
          <p className="mt-6 text-white text-lg font-semibold animate-pulse">Loading your chats...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg font-semibold">Redirecting...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      {/* 手機版 Overlay */}
      {showMobileSidebar && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setShowMobileSidebar(false)}
        />
      )}

      {/* Sidebar - 桌面版固定顯示，手機版滑出 */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50
        transform transition-transform duration-300 ease-in-out
        ${showMobileSidebar ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar onClose={() => setShowMobileSidebar(false)} />
      </div>

      {/* RoomList - 桌面版固定顯示，手機版當沒選擇房間時顯示 */}
      <div className={`
        flex-shrink-0 w-full sm:w-80 lg:w-80
        ${selectedRoom ? 'hidden lg:block' : 'block'}
      `}>
        <RoomList 
          selectedRoom={selectedRoom} 
          onSelectRoom={handleSelectRoom}
          onMenuClick={() => setShowMobileSidebar(true)}
        />
      </div>

      {/* ChatArea - 桌面版固定顯示，手機版當選擇房間時顯示 */}
      <div className={`
        flex-1 flex flex-col min-w-0
        ${selectedRoom ? 'block' : 'hidden lg:flex'}
      `}>
        {selectedRoom ? (
          <ChatArea 
            roomId={selectedRoom} 
            onBack={handleBackToRooms}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 relative overflow-hidden">
            <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
              <div className="mb-8 relative">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 cursor-pointer">
                  <span className="text-6xl animate-bounce">💬</span>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-4 border-primary-200 rounded-full animate-ping opacity-20"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary-100 rounded-full animate-pulse"></div>
              </div>

              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                Welcome to ChatApp
              </h1>

              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                選擇左側的聊天室開始對話<br/>
                或創建一個新的聊天室與朋友交流
              </p>

              <div className="mt-12 flex items-center justify-center gap-3 text-primary-600 animate-bounce">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-semibold text-lg">選擇聊天室開始</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}