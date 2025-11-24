'use client'

import { useState } from 'react'
import { useAuth } from '@/providers/AuthProvider'
import { useSocket } from '@/providers/SocketProvider'

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <aside className="w-20 min-h-screen bg-gradient-to-b from-gray-800 to-gray-900 flex flex-col items-center py-6 border-r border-gray-700 relative">
      <button
        type="button"
        aria-label="Home"
        className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg flex items-center justify-center text-2xl mb-8 transform transition-transform duration-300 hover:scale-110 hover:shadow-2xl"
      >
        💬
      </button>

      <div className="flex-1" />

      <div className="mb-6 text-center">
        <div
          className={`w-2 h-2 rounded-full mx-auto mb-2 ${
            connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
          }`}
        />
        <div className={`text-[10px] font-extrabold ${connected ? 'text-emerald-500' : 'text-red-500'}`}>
          {connected ? 'ON' : 'OFF'}
        </div>
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu((s) => !s)}
          className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-600 shadow-md flex items-center justify-center text-white font-bold text-xl relative transition-transform duration-300 hover:scale-110 hover:shadow-2xl"
        >
          {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}

          {connected && (
            <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full ring-2 ring-gray-900" />
          )}
        </button>

        {showMenu && (
          <>
            <div
              onClick={() => setShowMenu(false)}
              className="fixed inset-0 z-40"
            />

            <div
              className="absolute bottom-full left-full ml-4 mb-2 w-60 bg-gray-800 rounded-xl shadow-2xl border border-gray-700 z-50 overflow-hidden"
              role="dialog"
              aria-modal="true"
            >
              {/* header */}
              <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center text-lg font-bold text-white">
                    {user?.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-sm truncate">
                      {user?.username ?? 'Unknown'}
                    </div>
                    <div className="text-xs text-white/80 truncate">
                      {user?.email ?? '—'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false)
                    logout()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 font-semibold hover:bg-red-500/10 transition-colors"
                >
                  <span className="text-lg">🚪</span>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
