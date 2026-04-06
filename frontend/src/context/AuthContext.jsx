import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      const token = localStorage.getItem('token')

      if (!token) {
        if (isMounted) {
          setLoading(false)
        }
        return
      }

      try {
        const { data } = await api.get('/auth/me')

        if (isMounted) {
          setUser(data.user)
        }
      } catch {
        localStorage.removeItem('token')
        if (isMounted) {
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    bootstrap()

    return () => {
      isMounted = false
    }
  }, [])

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('token', data.token)
    setUser(data.user)
    return data.user
  }

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
