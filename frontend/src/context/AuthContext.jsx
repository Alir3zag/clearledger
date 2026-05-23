import { createContext, useContext, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'))
  const [user, setUser] = useState(null)
  const navigate = useNavigate()

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const t = res.data.access_token
    localStorage.setItem('token', t)
    setToken(t)
    navigate('/dashboard')
  }

  const register = async (username, email, password) => {
    const res = await api.post('/auth/register', { username, email, password })
    const t = res.data.access_token
    localStorage.setItem('token', t)
    setToken(t)
    navigate('/dashboard')
  }

  const logout = () => {
      localStorage.removeItem('token')
      setToken(null)
      setUser(null)
      window.location.href = '/login'
    }

  return (
    <AuthContext.Provider value={{ token, user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)