'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/providers/AuthProvider'


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

export default function UserProfile() {
  const router = useRouter()
  const { user, token, logout } = useAuth()  
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
  
  useEffect(() => {
  
    fetchProfile()
  }, [])  
  
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
  
  // 更新基本資料
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
  
  // 上傳頭像
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // 檢查檔案大小
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
        const data = await response.json()
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
  
  // 更新設定
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
        
        if (settings.theme === 'dark') {
          document.documentElement.classList.add('dark')
        } else {
          document.documentElement.classList.remove('dark')
        }
      } else {
        throw new Error('Update failed')
      }
    } catch (error) {
      showMessage('error', '更新失敗')
    }
  }
  
  // 更改密碼
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
  
  // 刪除帳號
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
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </div>
    )
  }
  
  if (!profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 頭部 */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">會員中心</h1>
            <button
              onClick={() => router.push('/chat')}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
          
          {/* 使用者簡介 */}
          <div className="flex items-center gap-6">
            <div className="relative">
              <img
                src={profile.avatar_url ? `http://localhost:3001${profile.avatar_url}` : `https://ui-avatars.com/api/?name=${profile.username}&background=6366f1&color=fff&size=128`}
                alt={profile.username}
                className="w-24 h-24 rounded-full object-cover border-4 border-gray-100"
              />
              {uploading && (
                <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
                </div>
              )}
              <label className="absolute bottom-0 right-0 bg-primary-600 hover:bg-primary-700 text-white p-2 rounded-full cursor-pointer shadow-lg transition-colors">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
            
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">{profile.username}</h2>
              <p className="text-gray-500">{profile.email}</p>
              <div className="flex gap-6 mt-3 text-sm">
                <div>
                  <span className="text-gray-500">訊息數：</span>
                  <span className="font-semibold text-gray-900 ml-1">{profile.total_messages}</span>
                </div>
                <div>
                  <span className="text-gray-500">加入房間：</span>
                  <span className="font-semibold text-gray-900 ml-1">{profile.total_rooms_joined}</span>
                </div>
                <div>
                  <span className="text-gray-500">建立房間：</span>
                  <span className="font-semibold text-gray-900 ml-1">{profile.total_rooms_created}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 訊息提示 */}
        {message.text && (
          <div className={`mb-6 p-4 rounded-xl shadow-lg ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}
        
        {/* 標籤頁 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              {['profile', 'settings', 'security'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-6 py-4 text-center font-semibold transition-colors ${
                    activeTab === tab
                      ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {tab === 'profile' && '個人資料'}
                  {tab === 'settings' && '偏好設定'}
                  {tab === 'security' && '帳號安全'}
                </button>
              ))}
            </div>
          </div>
          
          <div className="p-8">
            {/* 個人資料標籤 */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile}>
                <div className="space-y-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-gray-900">基本資料</h3>
                    {!editing ? (
                      <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                      >
                        編輯資料
                      </button>
                    ) : (
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditing(false)
                            fetchProfile()
                          }}
                          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-semibold transition-colors"
                        >
                          取消
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                        >
                          儲存變更
                        </button>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        用戶名稱
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        性別
                      </label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                      >
                        <option value="prefer_not_to_say">不願透露</option>
                        <option value="male">男性</option>
                        <option value="female">女性</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        電話號碼
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="09xx-xxx-xxx"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        生日
                      </label>
                      <input
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        所在地
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="台北市"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        個人網站
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        disabled={!editing}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      自我介紹
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      disabled={!editing}
                      rows={4}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none"
                      placeholder="介紹一下自己..."
                    />
                  </div>
                </div>
              </form>
            )}
            
            {/* 偏好設定標籤 */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900 mb-6">偏好設定</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">電子郵件通知</p>
                      <p className="text-sm text-gray-500">接收重要更新和通知</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.email_notifications}
                        onChange={(e) => setSettings({ ...settings, email_notifications: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">推播通知</p>
                      <p className="text-sm text-gray-500">在瀏覽器中接收即時通知</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.push_notifications}
                        onChange={(e) => setSettings({ ...settings, push_notifications: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">顯示線上狀態</p>
                      <p className="text-sm text-gray-500">讓其他人知道您是否在線</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.show_online_status}
                        onChange={(e) => setSettings({ ...settings, show_online_status: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-900">允許私人訊息</p>
                      <p className="text-sm text-gray-500">接收來自其他用戶的私人訊息</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.allow_private_messages}
                        onChange={(e) => setSettings({ ...settings, allow_private_messages: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <label className="block font-semibold text-gray-900 mb-2">主題</label>
                    <select
                      value={settings.theme}
                      onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="light">淺色模式</option>
                      <option value="dark">深色模式</option>
                      <option value="auto">跟隨系統</option>
                    </select>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <label className="block font-semibold text-gray-900 mb-2">語言</label>
                    <select
                      value={settings.language}
                      onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="zh-TW">繁體中文</option>
                      <option value="zh-CN">简体中文</option>
                      <option value="en">English</option>
                      <option value="ja">日本語</option>
                    </select>
                  </div>
                </div>
                
                <div className="pt-6">
                  <button
                    onClick={handleUpdateSettings}
                    className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                  >
                    儲存設定
                  </button>
                </div>
              </div>
            )}
            
            {/* 帳號安全標籤 */}
            {activeTab === 'security' && (
              <div className="space-y-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-6">更改密碼</h3>
                  <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        當前密碼
                      </label>
                      <input
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        新密碼
                      </label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        確認新密碼
                      </label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                        required
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      更新密碼
                    </button>
                  </form>
                </div>
                
                <div className="pt-8 border-t border-gray-200">
                  <h3 className="text-xl font-bold text-red-600 mb-4">危險區域</h3>
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-gray-700 mb-4">
                      刪除帳號後，您的所有資料將被永久刪除，此操作無法復原。
                    </p>
                    <button
                      onClick={handleDeleteAccount}
                      className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors"
                    >
                      永久刪除帳號
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}