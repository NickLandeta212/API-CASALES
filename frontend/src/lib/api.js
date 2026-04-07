import axios from 'axios'

const runtimeDesktopApiBaseUrl =
  typeof window !== 'undefined' ? window.desktopInfo?.apiBaseUrl : undefined

const api = axios.create({
  baseURL: runtimeDesktopApiBaseUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default api
