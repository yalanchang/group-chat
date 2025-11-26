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
  token: string | null
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    
    const checkAuth = () => {
      try {
        
        const savedToken = localStorage.getItem('token')
        const savedUser = localStorage.getItem('user')
        
        
        if (savedToken && savedUser) {
          try {
            const userData = JSON.parse(savedUser)
            setUser(userData)
            setToken(savedToken)
          } catch (parseError) {
            console.error('❌ Error parsing user data:', parseError)
            localStorage.removeItem('token')
            localStorage.removeItem('user')
          }
        }
      } catch (error) {
        console.error('❌ Auth check error:', error)
      } finally {
        setLoading(false)
      }
    }
    checkAuth()
  }, [])

  const login = (token: string, userData: User) => {
    localStorage.setItem('token', token)
    localStorage.setItem('user', JSON.stringify(userData))
    
    setUser(userData)
    setToken(token)
    
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setToken(null)
    router.push('/')
  }



  return (
    <AuthContext.Provider value={{ user, loading, login, logout, token }}>
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