import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Kaydedilmiş kullanıcıyı kontrol et
    const saved = localStorage.getItem('user')
    if (saved) {
      setUser(JSON.parse(saved))
    }
    
    api.get('/auth/me')
      .then(res => {
        setUser(res.data)
        if (localStorage.getItem('rememberMe') === 'true') {
          localStorage.setItem('user', JSON.stringify(res.data))
        }
      })
      .catch(() => {
        localStorage.removeItem('user')
        localStorage.removeItem('rememberMe')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = async (email, password, rememberMe) => {
    const res = await api.post('/auth/login', { email, password, remember_me: rememberMe })
    setUser(res.data)
    if (rememberMe) {
      localStorage.setItem('user', JSON.stringify(res.data))
      localStorage.setItem('rememberMe', 'true')
    }
    return res.data
  }

  const register = async (email, nick, password) => {
    const res = await api.post('/auth/register', { email, nick, password })
    return res.data
  }

  const logout = async () => {
    await api.post('/auth/logout')
    localStorage.removeItem('user')
    localStorage.removeItem('rememberMe')
    setUser(null)
  }

  if (loading) return null

  return (
    <AuthContext.Provider value={{ user, login, register, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)