import axios from 'axios'

declare const __BUILD_API_URL__: string | undefined

function resolveApiUrl(): string {
  const buildUrl = typeof __BUILD_API_URL__ !== 'undefined' ? __BUILD_API_URL__ : ''
  const rawEnv = (
    buildUrl ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    ''
  ).trim()

  if (!rawEnv) {
    return ''
  }

  let normalized = rawEnv.replace(/\/+$/, '')

  // If protocol was omitted (e.g. "my-api.onrender.com"), prepend https://
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`
  }

  // Prevent mixed-content blocks on mobile/Chrome/Safari when frontend is HTTPS
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    normalized.startsWith('http://') &&
    !/^http:\/\/(localhost|127\.0\.0\.1)/i.test(normalized)
  ) {
    normalized = normalized.replace(/^http:\/\//i, 'https://')
  }

  return normalized
}

export const API_URL = resolveApiUrl()

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
