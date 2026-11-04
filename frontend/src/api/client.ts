import axios from 'axios'

const rawApiUrl = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:8000'
export const API_URL = rawApiUrl.replace(/\/+$/, '')

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

// ── Request interceptor: attach JWT ───────────────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── Response interceptor: handle 401 / 403 ───────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to /login on 401 if it's an authenticated session expiring,
    // NOT when submitting credentials on the login endpoint itself.
    const isLoginRequest = error.config?.url?.includes('/auth/login')
    if (error.response?.status === 401 && !isLoginRequest) {
      sessionStorage.removeItem('token')
      if (window.location.pathname !== '/login') {
        window.location.replace('/login')
      }
    }
    // 403 is handled per-call with a toast — see useToast
    return Promise.reject(error)
  },
)

