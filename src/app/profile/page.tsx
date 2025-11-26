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
  
  useEffect(() => {
    if (authLoading) return
    
    if (!token) {
      router.push('/')
      return
    }
    
    fetchProfile()
  }, [authLoading, token])  
  
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-4 sm:py-8 px-3 sm:px-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-8 mb-4 sm:mb-6">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">會員中心</h1>
            <button
              onClick={() => router.push('/chat')}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-gray-100"
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
            
            <div className="flex-1 text-center sm:text-left">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">{profile.username}</h2>
              <p className="text-gray-500 text-sm sm:text-base truncate">{profile.email}</p>
              
              <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-6 mt-3 text-xs sm:text-sm">
                <div className="bg-gray-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="block sm:inline text-gray-500">訊息數</span>
                  <span className="block sm:inline font-semibold text-gray-900 sm:ml-1">{profile.total_messages}</span>
                </div>
                <div className="bg-gray-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="block sm:inline text-gray-500">加入房間</span>
                  <span className="block sm:inline font-semibold text-gray-900 sm:ml-1">{profile.total_rooms_joined}</span>
                </div>
                <div className="bg-gray-50 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                  <span className="block sm:inline text-gray-500">建立房間</span>
                  <span className="block sm:inline font-semibold text-gray-900 sm:ml-1">{profile.total_rooms_created}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 訊息提示 */}
        {message.text && (
          <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl shadow-lg text-sm sm:text-base ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.text}
          </div>
        )}
        
        {/* 標籤頁 */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              {['profile', 'settings', 'security'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-2 sm:px-6 py-3 sm:py-4 text-center text-xs sm:text-base font-semibold transition-colors ${
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
          
          <div className="p-4 sm:p-8">
            {/* 個人資料標籤 */}
            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateProfile}>
                <div className="space-y-4 sm:space-y-6">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 sm:mb-6">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-900">基本資料</h3>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        用戶名稱
                      </label>
                      <input
                        type="text"
                        value={formData.username}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500 text-sm sm:text-base"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        性別
                      </label>
                      <select
                        value={formData.gender}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500 text-sm sm:text-base"
                      >
                        <option value="prefer_not_to_say">不願透露</option>
                        <option value="male">男性</option>
                        <option value="female">女性</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        電話號碼
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500 text-sm sm:text-base"
                        placeholder="09xx-xxx-xxx"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        生日
                      </label>
                      <input
                        type="date"
                        value={formData.birthday}
                        onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500 text-sm sm:text-base"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        所在地
                      </label>
                      <input
                        type="text"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500 text-sm sm:text-base"
                        placeholder="台北市"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        個人網站
                      </label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        disabled={!editing}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500 text-sm sm:text-base"
                        placeholder="https://example.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                      自我介紹
                    </label>
                    <textarea
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      disabled={!editing}
                      rows={3}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-500 resize-none text-sm sm:text-base"
                      placeholder="介紹一下自己..."
                    />
                  </div>
                </div>
              </form>
            )}
            
            {/* 偏好設定標籤 */}
            {activeTab === 'settings' && (
              <div className="space-y-4 sm:space-y-6">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">偏好設定</h3>
                
                <div className="space-y-3 sm:space-y-4">
                  {/* 設定項目 */}
                  {[
                    { key: 'email_notifications', title: '電子郵件通知', desc: '接收重要更新和通知' },
                    { key: 'push_notifications', title: '推播通知', desc: '在瀏覽器中接收即時通知' },
                    { key: 'show_online_status', title: '顯示線上狀態', desc: '讓其他人知道您是否在線' },
                    { key: 'allow_private_messages', title: '允許私人訊息', desc: '接收來自其他用戶的私人訊息' },
                  ].map((item) => (
                    <div key={item.key} className="flex items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="font-semibold text-gray-900 text-sm sm:text-base">{item.title}</p>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{item.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                        <input
                          type="checkbox"
                          checked={settings[item.key as keyof typeof settings] as boolean}
                          onChange={(e) => setSettings({ ...settings, [item.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  ))}
                  
                  <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <label className="block font-semibold text-gray-900 mb-2 text-sm sm:text-base">主題</label>
                    <select
                      value={settings.theme}
                      onChange={(e) => setSettings({ ...settings, theme: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                    >
                      <option value="light">淺色模式</option>
                      <option value="dark">深色模式</option>
                      <option value="auto">跟隨系統</option>
                    </select>
                  </div>
                  
                  <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                    <label className="block font-semibold text-gray-900 mb-2 text-sm sm:text-base">語言</label>
                    <select
                      value={settings.language}
                      onChange={(e) => setSettings({ ...settings, language: e.target.value })}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
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
            
            {/* 帳號安全標籤 */}
            {activeTab === 'security' && (
              <div className="space-y-6 sm:space-y-8">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-4 sm:mb-6">更改密碼</h3>
                  <form onSubmit={handleChangePassword} className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        當前密碼
                      </label>
                      <input
                        type="password"
                        value={passwordData.currentPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        新密碼
                      </label>
                      <input
                        type="password"
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                        確認新密碼
                      </label>
                      <input
                        type="password"
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                        className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm sm:text-base"
                        required
                      />
                    </div>
                    
                    <button
                      type="submit"
                      className="w-full px-6 py-2.5 sm:py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base"
                    >
                      更新密碼
                    </button>
                  </form>
                </div>
                
                <div className="pt-6 sm:pt-8 border-t border-gray-200">
                  <h3 className="text-lg sm:text-xl font-bold text-red-600 mb-4">危險區域</h3>
                  <div className="p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-gray-700 mb-4 text-sm sm:text-base">
                      刪除帳號後，您的所有資料將被永久刪除，此操作無法復原。
                    </p>
                    <button
                      onClick={handleDeleteAccount}
                      className="w-full sm:w-auto px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors text-sm sm:text-base"
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