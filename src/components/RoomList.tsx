'use client'

import { useEffect, useState } from 'react'
import CreateRoomModal from './CreateRoomModal'

interface Room {
  id: number
  name: string
  description?: string
  is_private: boolean
  is_member: boolean
  creator_name?: string
}

interface RoomListProps {
  selectedRoom: string | null
  onSelectRoom: (roomId: string | null) => void
  onMenuClick?: () => void  
}

export default function RoomList({ selectedRoom, onSelectRoom, onMenuClick }: RoomListProps) {
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [joiningRoomId, setJoiningRoomId] = useState<number | null>(null)

  useEffect(() => {
    fetchRooms()
  }, [])

  const fetchRooms = async () => {
    try {
      const token = localStorage.getItem('token')
      
      const response = await fetch('http://localhost:3001/api/rooms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        
        if (Array.isArray(data)) {
          setRooms(data)
        } else if (data.rooms && Array.isArray(data.rooms)) {
          setRooms(data.rooms)
        } else {
          setRooms([])
        }
        setError('')
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to load rooms')
        setRooms([])
      }
    } catch (error) {
      console.error('Error fetching rooms:', error)
      setError('Network error')
      setRooms([])
    } finally {
      setLoading(false)
    }
  }

  const handleJoinRoom = async (roomId: number, e: React.MouseEvent) => {
    e.stopPropagation()

    try {
      setJoiningRoomId(roomId)
      const token = localStorage.getItem('token')

      const response = await fetch(`http://localhost:3001/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        await fetchRooms()
        onSelectRoom(roomId.toString())
      } else {
        const errorData = await response.json()
        alert(errorData.message || 'Failed to join room')
      }
    } catch (error) {
      console.error('Error joining room:', error)
      alert('Failed to join room')
    } finally {
      setJoiningRoomId(null)
    }
  }

  const handleRoomCreated = () => {
    fetchRooms()
  }

  const handleSelectRoom = (room: Room) => {
    if (!room.is_member) {
      const confirmJoin = confirm(`Join "${room.name}"?`)
      if (confirmJoin) {
        handleJoinRoom(room.id, { stopPropagation: () => {} } as any)
      }
    } else {
      onSelectRoom(room.id.toString())
    }
  }

  return (
    <>
    <div className="w-full h-full bg-white border-r border-gray-200 flex flex-col">
    <div className="p-5 border-b border-gray-200 bg-white">
    <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
    {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        )}
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
聊天室            </h2>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {rooms.length} 間房間可加入
          </p>
        </div>

        {/* 房間列表 */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="relative">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-200"></div>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent absolute top-0 left-0"></div>
              </div>
              <p className="mt-4 text-sm text-gray-500 font-medium">Loading rooms...</p>
            </div>
          ) : error ? (
            <div className="p-4">
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-center">
                <div className="text-3xl mb-2">😔</div>
                <p className="text-sm text-red-700 font-medium mb-2">{error}</p>
                <button
                  onClick={fetchRooms}
                  className="text-sm text-red-600 hover:text-red-800 font-semibold underline"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-100 to-primary-200 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🚀</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">No rooms yet</h3>
              <p className="text-sm text-gray-500 text-center mb-4">
                Be the first to create a room and start chatting!
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="text-sm text-primary-600 hover:text-primary-700 font-semibold"
              >
                Create one now →
              </button>
            </div>
          ) : (
            <div className="space-y-2 ">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={`group  relative rounded-xl transition-all duration-200 ${
                    selectedRoom === room.id.toString()
                      ? 'bg-gradient-to-r from-primary-500 to-primary-600 shadow-lg scale-[1.02]'
                      : 'bg-white hover:bg-gray-50 hover:shadow-md border border-gray-200'
                  }`}
                >
                  <button
                    onClick={() => handleSelectRoom(room)}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0 pr-3">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className={`font-bold text-base truncate ${
                            selectedRoom === room.id.toString()
                              ? 'text-white'
                              : 'text-gray-900'
                          }`}>
                            {room.name}
                          </h3>
                          
                          {room.is_private && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                              selectedRoom === room.id.toString()
                                ? 'bg-white/20 text-white'
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              🔒
                            </div>
                          )}
                        </div>

                        {room.description && (
                          <p className={`text-xs truncate mb-2 ${
                            selectedRoom === room.id.toString()
                              ? 'text-white/80'
                              : 'text-gray-500'
                          }`}>
                            {room.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          {room.is_member ? (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
                              selectedRoom === room.id.toString()
                                ? 'bg-white/20 text-white'
                                : 'bg-green-100 text-green-700'
                            }`}>
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                              </svg>
                              已加入
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"/>
                              </svg>
                              公開
                            </span>
                          )}

                          {room.creator_name && (
                            <span className={`text-xs ${
                              selectedRoom === room.id.toString()
                                ? 'text-white/60'
                                : 'text-gray-400'
                            }`}>
                              by {room.creator_name}
                            </span>
                          )}
                        </div>
                      </div>

                      {selectedRoom === room.id.toString() ? (
                        <div className="flex-shrink-0 text-white">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd"/>
                          </svg>
                        </div>
                      ) : (
                        <div className="flex-shrink-0 text-gray-400 group-hover:text-gray-600 transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  </button>

                  {!room.is_member && selectedRoom !== room.id.toString() && (
                    <div className="absolute top-2 right-2">
                      <button
                        onClick={(e) => handleJoinRoom(room.id, e)}
                        disabled={joiningRoomId === room.id}
                        className="bg-primary-600 hover:bg-primary-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {joiningRoomId === room.id ? (
                          <>
                            <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Joining...
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"/>
                            </svg>
                            Join
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-white">
          <button
            onClick={() => setShowCreateModal(true)}
            className="w-full bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white py-3 px-4 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 group"
          >
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/>
            </svg>
          </button>
        </div>
      </div>

      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onRoomCreated={handleRoomCreated}
        />
      )}
    </>
  )
}