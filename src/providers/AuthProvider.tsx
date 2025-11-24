// providers/AuthProvider.tsx
'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  username: string
  email: string
  avatar?: string
}

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (token: string, userData: User) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    console.log('🔐 AuthProvider: useEffect START')
    
    // 使用 setTimeout 確保在客戶端執行
    const checkAuth = () => {
      try {
        console.log('🔐 Checking localStorage...')
        
        const token = localStorage.getItem('token')
        const savedUser = localStorage.getItem('user')

        console.log('🔐 Token:', token ? 'EXISTS' : 'NULL')
        console.log('🔐 SavedUser:', savedUser ? 'EXISTS' : 'NULL')

        if (token && savedUser) {
          try {
            const userData = JSON.parse(savedUser)
            console.log('✅ User data parsed:', userData)
            setUser(userData)
          } catch (parseError) {
            console.error('❌ Error parsing user data:', parseError)
            localStorage.removeItem('token')
            localStorage.removeItem('user')
            setUser(null)
          }
        } else {
          console.log('⚠️ No token or user found')
          setUser(null)
        }
      } catch (error) {
        console.error('❌ Auth check error:', error)
        setUser(null)
      } finally {
        console.log('🔐 Setting loading to FALSE')
        setLoading(false)
      }
    }

    if (typeof window !== 'undefined') {
      checkAuth()
    } else {
      console.log('⚠️ Not on client side yet')
      setLoading(false)
    }
  }, [])

  const login = (token: string, userData: User) => {
    console.log('🔐 AuthProvider.login called:', userData)
    try {
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(userData))
      setUser(userData)
      console.log('✅ Login successful, user set')
    } catch (error) {
      console.error('❌ Login error:', error)
    }
  }

  const logout = () => {
    console.log('🔐 AuthProvider.logout called')
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    router.push('/')
  }

  console.log('🔐 AuthProvider render:', { 
    user: user?.username || 'null', 
    loading 
  })

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}