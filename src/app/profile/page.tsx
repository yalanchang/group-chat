'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'
import { useTheme } from '@/providers/ThemeProvider'


interface UserProfile {
  id: number
  username: string
  email: string
  avatar_url?: string
  bio?: string
  phone?: string
  birthday?: string
  gender?: string
  location?: string
  website?: string
  created_at: string
  updated_at: string
  total_messages: number
  total_rooms_joined: number
  total_rooms_created: number
  last_active: string
  email_notifications: boolean
  push_notifications: boolean
  show_online_status: boolean
  allow_private_messages: boolean
  theme: string
  language: string
}

interface JoinRequest {
  id: number
  room_id: number
  room_name: string
  user_id: number
  message: string | null
  status: string
  created_at: string
  username: string
  avatar_url: string | null
}

interface ManagedRoom {
  id: number
  name: string
  is_private: boolean
  pending_count: number
}

export default function UserProfile() {
  const { theme, setTheme } = useTheme()  
  const router = useRouter()
  const { user, token, logout, loading: authLoading } = useAuth() 
  const [activeTab, setActiveTab] = useState('profile')
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })
  const [formData, setFormData] = useState({
    username: '',
    bio: '',
    phone: '',
    birthday: '',
    gender: '',
    location: '',
    website: ''
  })
  
  const [settings, setSettings] = useState({
    email_notifications: true,
    push_notifications: false,
    show_online_status: true,
    allow_private_messages: true,
    theme: 'light',
    language: 'zh-TW'
  })
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  })

  // 審核管理相關狀態
  const [managedRooms, setManagedRooms] = useState<ManagedRoom[]>([])
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([])
  const [requestsLoading, setRequestsLoading] = useState(false)
  const [processingId, setProcessingId] = useState<number | null>(null)
  
  useEffect(() => {
    if (authLoading) return
    
    if (!token) {
      router.push('/')
      return
    }
    
    fetchProfile()
  }, [authLoading, token])  

  useEffect(() => {
    if (activeTab === 'requests' && token) {
      fetchManagedRooms()
    }
  }, [activeTab, token])

  useEffect(() => {
    if (selectedRoomId) {
      fetchJoinRequests(selectedRoomId)
    }
  }, [selectedRoomId])
  
  const fetchProfile = async () => {
    try {
      if (!token) {
        router.push('/')
        return
      }
      
      const response = await fetch('http://localhost:3001/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        
        setProfile(data)
        setFormData({
          username: data.username || '',
          bio: data.bio || '',
          phone: data.phone || '',
          birthday: data.birthday ? data.birthday.split('T')[0] : '',
          gender: data.gender || '',
          location: data.location || '',
          website: data.website || ''
        })
        setSettings({
          email_notifications: data.email_notifications,
          push_notifications: data.push_notifications,
          show_online_status: data.show_online_status,
          allow_private_messages: data.allow_private_messages,
          theme: data.theme,
          language: data.language
        })
      } else {
        if (response.status === 401) {
          console.error('Token invalid or expired')
          logout()
         
        }
        if (response.status === 401 || response.status === 403) {
          console.error('Token invalid or expired')
          logout()
          return
        }
        throw new Error('Failed to fetch profile')
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
      showMessage('error', '載入資料失敗')
    } finally {
      setLoading(false)
    }
  }

  const fetchManagedRooms = async () => {
    try {
      setRequestsLoading(true)
      const response = await fetch('http://localhost:3001/api/user/managed-rooms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setManagedRooms(data)
        if (data.length > 0 && !selectedRoomId) {
          setSelectedRoomId(data[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching managed rooms:', error)
    } finally {
      setRequestsLoading(false)
    }
  }

  const fetchJoinRequests = async (roomId: number) => {
    try {
      setRequestsLoading(true)
      const response = await fetch(`http://localhost:3001/api/rooms/${roomId}/requests`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setJoinRequests(data)
      } else {
        setJoinRequests([])
      }
    } catch (error) {
      console.error('Error fetching join requests:', error)
      setJoinRequests([])
    } finally {
      setRequestsLoading(false)
    }
  }

  const handleApprove = async (requestId: number) => {
    if (!selectedRoomId) return

    try {
      setProcessingId(requestId)
      const response = await fetch(
        `http://localhost:3001/api/rooms/${selectedRoomId}/requests/${requestId}/approve`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (response.ok) {
        showMessage('success', '已批准加入申請')
        setJoinRequests(joinRequests.filter(r => r.id !== requestId))
        // 更新房間的待審核數量
        setManagedRooms(managedRooms.map(room => 
          room.id === selectedRoomId 
            ? { ...room, pending_count: Math.max(0, room.pending_count - 1) }
            : room
        ))
      } else {
        const errorData = await response.json()
        showMessage('error', errorData.message || '操作失敗')
      }
    } catch (error) {
      console.error('Error approving request:', error)
      showMessage('error', '操作失敗')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (requestId: number) => {
    if (!selectedRoomId) return
    if (!confirm('確定要拒絕此申請嗎？')) return

    try {
      setProcessingId(requestId)
      const response = await fetch(
        `http://localhost:3001/api/rooms/${selectedRoomId}/requests/${requestId}/reject`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      )

      if (response.ok) {
        showMessage('success', '已拒絕加入申請')
        setJoinRequests(joinRequests.filter(r => r.id !== requestId))
        setManagedRooms(managedRooms.map(room => 
          room.id === selectedRoomId 
            ? { ...room, pending_count: Math.max(0, room.pending_count - 1) }
            : room
        ))
      } else {
        const errorData = await response.json()
        showMessage('error', errorData.message || '操作失敗')
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
      showMessage('error', '操作失敗')
    } finally {
      setProcessingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('zh-TW', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getTotalPendingCount = () => {
    return managedRooms.reduce((sum, room) => sum + room.pending_count, 0)
  }
  
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/user/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })
      
      if (response.ok) {
        showMessage('success', '資料更新成功')
        setEditing(false)
        fetchProfile()
      } else {
        const error = await response.json()
        throw new Error(error.message)
      }
    } catch (error: any) {
      showMessage('error', error.message || '更新失敗')
    }
  }
  
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (file.size > 5 * 1024 * 1024) {
      showMessage('error', '檔案大小不能超過 5MB')
      return
    }
    
    setUploading(true)
    const formData = new FormData()
    formData.append('avatar', file)
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/user/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })
      
      if (response.ok) {
        showMessage('success', '頭像上傳成功')
        fetchProfile()
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      showMessage('error', '上傳失敗')
    } finally {
      setUploading(false)
    }
  }
  
  const handleUpdateSettings = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/user/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settings)
      })
      
      if (response.ok) {
        showMessage('success', '設定更新成功')
        setTheme(settings.theme as 'light' | 'dark' | 'auto')
      } else {
        throw new Error('Update failed')
      }
    } catch (error) {
      showMessage('error', '更新失敗')
    }
  }
  
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('error', '新密碼與確認密碼不符')
      return
    }
    
    if (passwordData.newPassword.length < 6) {
      showMessage('error', '密碼至少需要6個字元')
      return
    }
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/user/password', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      })
      
      if (response.ok) {
        showMessage('success', '密碼更新成功')
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
      } else {
        const error = await response.json()
        throw new Error(error.message)
      }
    } catch (error: any) {
      showMessage('error', error.message || '更新失敗')
    }
  }
  
  const handleDeleteAccount = async () => {
    const password = prompt('請輸入密碼以確認刪除帳號：')
    if (!password) return
    
    const confirmDelete = confirm('確定要永久刪除您的帳號嗎？此操作無法復原！')
    if (!confirmDelete) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:3001/api/user/account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })
      
      if (response.ok) {
        localStorage.removeItem('token')
        router.push('/login')
      } else {
        const error = await response.json()
        throw new Error(error.message)
      }
    } catch (error: any) {
      showMessage('error', error.message || '刪除失敗')
    }
  }
  
  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }
  
  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    )
  }
  
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-600 mb-4">載入失敗</p>
          <button
            onClick={() => router.push('/')}
            className="text-primary-600 hover:text-primary-700 font-semibold"
          >
            返回登入
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900 dark:text-white">會員中心</h1>
            <button
              onClick={() => router.push('/chat')}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
            <div className="relative flex-shrink-0">
              <img
                src={profile.avatar_url ? `http://localhost:3001${profile.avatar_url}` : `https://ui-avatars.com/api/?name=${profile.username}&background=6366f1&color=fff&size=128`}
                alt={profile.username}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-gray-100 dark:border-gray-700"
                />
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-2 border-white border-t-transparent"></div>
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-primary-600 hover:bg-primary-700 text-white p-1.5 sm:p-2 rounded-full cursor-pointer shadow-lg transition-colors">
                <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
              </label>
            </div>
            
            <div className="flex-1 text-center sm:text-left ">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{profile.username}</h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base truncate">{profile.email}</p>
              
              <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-6 mt-3 text-xs sm:text-sm">
              <div className="bg-gray-50 dark:bg-gray-700 sm:bg-transparent sm:dark:bg-transparent p-2 sm:p-0 rounded-lg">
              <span className="block sm:inline text-gray-500 dark:text-gray-400">訊息數</span>
              <span className="block sm:inline font-semibold text-gray-900 dark:text-white sm:ml-1">{profile.total_messages}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 sm:bg-transparent sm:dark:bg-transparent p-2 sm:p-0 rounded-lg">
                <span className="block sm:inline text-gray-500 dark:text-gray-400">加入房間</span>
                <span className="block sm:inline font-semibold text-gray-900 dark:text-white sm:ml-1">{profile.total_rooms_joined}</span>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 sm:bg-transparent sm:dark:bg-transparent p-2 sm:p-0 rounded-lg">
                <span className="block sm:inline text-gray-500 dark:text-gray-400">建立房間</span>
                <span className="block sm:inline font-semibold text-gray-900 dark:text-white sm:ml-1">{profile.total_rooms_created}</span>
              </div>
              </div>
            </div>
          </div>
        </div>
        
        {message.text && (
          <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl shadow-lg text-sm sm:text-base ${
            message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            {message.text}
          </div>
        )}
        
        <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-700">
            <div className="flex">
              {['profile', 'settings', 'security', 'requests'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-2 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-base font-semibold transition-colors relative ${
                    activeTab === tab
                      ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab === 'profile' && '個人資料'}
                  {tab === 'settings' && '偏好設定'}
                  {tab === 'security' && '帳號安全'}
                  {tab === 'requests' && (
                    <span className="flex items-center justify-center gap-1">
                      審核管理
                      {getTotalPendingCount() > 0 && (
                        <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full min-w-[20px]">
                          {getTotalPendingCount()}
                        </span>
                      )}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-4 sm:p-8">
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile}>
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">基本資料</h3>
                    {!editing ? (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base"
                      >
                        編輯資料
                      </button>
                    ) : (
                      <div className="flex gap-2 sm:gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(false)
                            fetchProfile()
                          }}
                          className="flex-1 sm:flex-none px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors text-sm sm:text-base"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="flex-1 sm:flex-none px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base"
                        >
                          儲存變更
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                        用戶名稱
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                        />
                    </div>
                    
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                        性別
                      </label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                        >
                        <option value="prefer_not_to_say">不願透露</option>
                        <option value="male">男性</option>
                        <option value="female">女性</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                    
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                        電話號碼
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                        placeholder="09xx-xxx-xxx"
                      />
                    </div>
                    
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                        生日
                      </label>
                      <input
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                        />
                    </div>
                    
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                        所在地
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                        placeholder="台北市"
                      />
                    </div>
                    
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                        個人網站
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                      自我介紹
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      disabled={!editing}
                      rows={3}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 dark:disabled:bg-gray-700 disabled:text-gray-500 dark:disabled:text-gray-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none text-sm sm:text-base"
                      placeholder="介紹一下自己..."
                    />
                  </div>
                </div>
              </form>
            )}
            
            {activeTab === 'settings' && (
              <div className="space-y-4 sm:space-y-6">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">偏好設定</h3>
                
                <div className="space-y-3 sm:space-y-4">
                  {[
                    { key: 'email_notifications', title: '電子郵件通知', desc: '接收重要更新和通知' },
                    { key: 'push_notifications', title: '推播通知', desc: '在瀏覽器中接收即時通知' },
                    { key: 'show_online_status', title: '顯示線上狀態', desc: '讓其他人知道您是否在線' },
                    { key: 'allow_private_messages', title: '允許私人訊息', desc: '接收來自其他用戶的私人訊息' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex-1 min-w-0 mr-3">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">{item.title}</p>
                      <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input
                          type="checkbox"
                          checked={settings[item.key as keyof typeof settings] as boolean}
                          onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                      <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  ))}
                  
                  <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <label className="block font-semibold text-gray-900 dark:text-white mb-2 text-sm sm:text-base">主題</label>
                    <select
                      value={settings.theme}
                      onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm sm:text-base"
                      >
                      <option value="light">淺色模式</option>
                      <option value="dark">深色模式</option>
                    </select>
                  </div>
                  
                  <div className="p-3 sm:p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <label className="block font-semibold text-gray-900 dark:text-white mb-2 text-sm sm:text-base">語言</label>
                    <select
                      value={settings.language}
                      onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-white text-sm sm:text-base"
                      >
                      <option value="zh-TW">繁體中文</option>
                      <option value="zh-CN">简体中文</option>
                      <option value="en">English</option>
                      <option value="ja">日本語</option>
                    </select>
                  </div>
                </div>
                
                <div className="pt-4 sm:pt-6">
                  <button
                    onClick={handleUpdateSettings}
                    className="w-full px-6 py-2.5 sm:py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base"
                  >
                    儲存設定
                  </button>
                </div>
              </div>
            )}
            
            {activeTab === 'security' && (
              <div className="space-y-6 sm:space-y-8">
                <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">更改密碼</h3>
                <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                    當前密碼
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.current ? 'text' : 'password'}
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          className="w-full px-3 sm:px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword({ ...showPassword, current: !showPassword.current })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                          >
                          {showPassword.current ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                    新密碼
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.new ? 'text' : 'password'}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          className="w-full px-3 sm:px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword({ ...showPassword, new: !showPassword.new })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword.new ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2">
                    確認新密碼
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword.confirm ? 'text' : 'password'}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          className="w-full px-3 sm:px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm sm:text-base"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                          {showPassword.confirm ? (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full px-6 py-2.5 sm:py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base"
                    >
                      更新密碼
                    </button>
                  </form>
                </div>
                
                <div className="pt-6 sm:pt-8 border-t border-gray-200 dark:border-gray-700">
                <div className="p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <button
                      onClick={handleDeleteAccount}
                      className="w-full sm:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base"
                    >
                      永久刪除帳號
                    </button>
                    <p className="text-gray-700 dark:text-gray-300 mt-4 text-sm sm:text-base">
                    刪除帳號後，您的所有資料將被永久刪除，此操作無法復原。
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'requests' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
                    審核加入申請
                  </h3>
                  {managedRooms.length > 0 && (
                    <select
                      value={selectedRoomId || ''}
                      onChange={(e) => setSelectedRoomId(Number(e.target.value))}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    >
                      {managedRooms.map((room) => (
                        <option key={room.id} value={room.id}>
                          {room.name} {room.pending_count > 0 && `(${room.pending_count})`}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {requestsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary-600 border-t-transparent"></div>
                  </div>
                ) : managedRooms.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">您沒有管理任何房間</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">創建私密房間後即可在此管理加入申請</p>
                  </div>
                ) : joinRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">目前沒有待審核的申請</p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">所有申請都已處理完畢</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {joinRequests.map((request) => (
                      <div
                        key={request.id}
                        className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-4 sm:p-5"
                      >
                        <div className="flex items-start gap-4">
                          {/* 頭像 */}
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-lg">
                              {request.avatar_url ? (
                                <img
                                  src={`http://localhost:3001${request.avatar_url}`}
                                  alt={request.username}
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                request.username.charAt(0).toUpperCase()
                              )}
                            </div>
                          </div>

                          {/* 資訊 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white text-base">
                                  {request.username}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatDate(request.created_at)}
                                </p>
                              </div>
                            </div>

                            {/* 申請訊息 */}
                            {request.message && (
                              <div className="mt-3 p-3 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500">
                                <p className="text-sm text-gray-600 dark:text-gray-300 italic">
                                  "{request.message}"
                                </p>
                              </div>
                            )}

                            {/* 按鈕 */}
                            <div className="flex gap-3 mt-4">
                              <button
                                onClick={() => handleApprove(request.id)}
                                disabled={processingId === request.id}
                                className="flex-1 sm:flex-none bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                {processingId === request.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    批准
                                  </>
                                )}
                              </button>
                              <button
                                onClick={() => handleReject(request.id)}
                                disabled={processingId === request.id}
                                className="flex-1 sm:flex-none bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                {processingId === request.id ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                ) : (
                                  <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    拒絕
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}