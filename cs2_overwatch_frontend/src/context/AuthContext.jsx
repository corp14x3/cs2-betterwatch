import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const tryAutoLogin = async () => {
      try {
        // Önce mevcut session'ı dene
        const res = await api.get('/auth/me')
        setUser(res.data)
      } catch {
        // Session yoksa kayıtlı credentials ile otomatik login dene
        try {
          const creds = window.electron
            ? await window.electron.getCredentials()
            : JSON.parse(localStorage.getItem('creds') || 'null')

          if (creds?.email && creds?.password) {
            const res = await api.post('/auth/login', {
              email: creds.email,
              password: creds.password,
              remember_me: true,
            })
            setUser(res.data)
          }
        } catch {
          setUser(null)
        }
      } finally {
        setLoading(false)
      }
    }

    tryAutoLogin()
  }, [])

  const login = async (email, password, rememberMe) => {
    const res = await api.post('/auth/login', { email, password, remember_me: rememberMe })
    setUser(res.data)
    if (rememberMe) {
      if (window.electron) {
        await window.electron.saveCredentials(email, password)
      } else {
        localStorage.setItem('creds', JSON.stringify({ email, password }))
      }
    }
    return res.data
  }

  const register = async (email, nick, password) => {
    const res = await api.post('/auth/register', { email, nick, password })
    return res.data
  }

  const logout = async () => {
    await api.post('/auth/logout')
    if (window.electron) {
      await window.electron.clearCredentials()
    } else {
      localStorage.removeItem('creds')
    }
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