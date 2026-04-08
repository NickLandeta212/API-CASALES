import axios from 'axios'

function resolveWebApiBaseUrl() {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname

    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3000'
    }

    // In production web deployments, default to same-origin API routing.
    return window.location.origin
  }

  return 'http://localhost:3000'
}

const api = axios.create({
  baseURL: resolveWebApiBaseUrl(),
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
