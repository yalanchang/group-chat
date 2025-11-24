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

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && !loading && !user) {
      router.push('/')
    }
  }, [user, loading, router, mounted])

  if (!mounted) {
    return null
  }

  // Loading 狀態 - 更現代
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

  // 主界面
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-100">
      {/* 左側邊欄 */}
      <div className="flex-shrink-0">
        <Sidebar />
      </div>

      {/* 房間列表 */}
      <div className="flex-shrink-0">
        <RoomList 
          selectedRoom={selectedRoom} 
          onSelectRoom={setSelectedRoom} 
        />
      </div>

      {/* 主聊天區域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedRoom ? (
          <ChatArea roomId={selectedRoom} />
        ) : (
          <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 relative overflow-hidden">
            {/* 背景裝飾 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-gradient-to-br from-primary-100/20 to-purple-100/20 rounded-full blur-3xl"></div>
              <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-gradient-to-tr from-blue-100/20 to-indigo-100/20 rounded-full blur-3xl"></div>
            </div>

            {/* 主要內容 */}
            <div className="relative z-10 text-center px-6 max-w-2xl mx-auto">
              {/* 動畫圖標 */}
              <div className="mb-8 relative">
                <div className="w-32 h-32 mx-auto bg-gradient-to-br from-primary-500 to-purple-600 rounded-3xl flex items-center justify-center shadow-2xl transform hover:scale-110 transition-all duration-300 cursor-pointer">
                  <span className="text-6xl animate-bounce">💬</span>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 border-4 border-primary-200 rounded-full animate-ping opacity-20"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-primary-100 rounded-full animate-pulse"></div>
              </div>

              {/* 標題 */}
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                Welcome to ChatApp
              </h1>

              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                選擇左側的聊天室開始對話<br/>
                或創建一個新的聊天室與朋友交流
              </p>

              {/* 功能卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-12">
                <FeatureCard
                  icon="🚀"
                  title="即時通訊"
                  description="實時發送和接收訊息"
                />
                <FeatureCard
                  icon="🔒"
                  title="安全私密"
                  description="端對端加密保護"
                />
                <FeatureCard
                  icon="🌐"
                  title="跨平台"
                  description="隨時隨地保持連接"
                />
              </div>

              {/* 提示箭頭 */}
              <div className="mt-12 flex items-center justify-center gap-3 text-primary-600 animate-bounce">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span className="font-semibold text-lg">選擇聊天室開始</span>
              </div>

              {/* 連接狀態 */}
              <div className="mt-8 inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg border border-gray-200">
                <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} ${connected ? 'animate-pulse' : ''}`}></div>
                <span className={`text-sm font-medium ${connected ? 'text-green-600' : 'text-red-600'}`}>
                  {connected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {!connected && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in">
          <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 backdrop-blur-sm">
            <div className="relative">
              <div className="w-4 h-4 bg-white rounded-full animate-ping absolute"></div>
              <div className="w-4 h-4 bg-white rounded-full"></div>
            </div>
            <div>
              <p className="font-bold text-sm">Connection Lost</p>
              <p className="text-xs text-red-100">Reconnecting to server...</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-in {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .animate-slide-in {
          animation: slide-in 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}

function FeatureCard({ 
  icon, 
  title, 
  description 
}: { 
  icon: string
  title: string
  description: string
}) {
  return (
    <div className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-2xl hover:border-primary-300 transition-all duration-300 hover:-translate-y-2 cursor-pointer">
      <div className="text-4xl mb-3 transform group-hover:scale-110 transition-transform duration-300">
        {icon}
      </div>
      <h3 className="font-bold text-gray-900 mb-2 text-lg">
        {title}
      </h3>
      <p className="text-sm text-gray-600 leading-relaxed">
        {description}
      </p>
    </div>
  )
}