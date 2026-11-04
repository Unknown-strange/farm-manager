import axios from 'axios'

declare const __BUILD_API_URL__: string | undefined

function normalizeBackendUrl(raw: string): string {
  let normalized = raw.trim().replace(/\/+$/, '')
  if (!normalized) return ''

  // If protocol was omitted (e.g. "my-api.onrender.com"), prepend https://
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = `https://${normalized}`
  }

  // Prevent mixed-content blocks on Safari/Chrome/Mobile when frontend is HTTPS
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    normalized.startsWith('http://') &&
    !/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.|10\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(normalized)
  ) {
    normalized = normalized.replace(/^http:\/\//i, 'https://')
  }

  return normalized
}

export function resolveApiUrl(): string {
  // 1. Check build-time & Vite env variables
  const buildUrl = typeof __BUILD_API_URL__ !== 'undefined' ? __BUILD_API_URL__ : ''
  let rawEnv = (
    buildUrl ||
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    import.meta.env.VITE_API ||
    ''
  ).trim()

  // 2. Scan all VITE_* variables in import.meta.env in case a different VITE_* key name was used
  if (!rawEnv || rawEnv === 'http://localhost:8000') {
    const metaEntries = Object.entries(import.meta.env || {})
    for (const [key, val] of metaEntries) {
      if (
        key.startsWith('VITE_') &&
        typeof val === 'string' &&
        val.trim() &&
        val.trim() !== 'http://localhost:8000' &&
        (/^https?:\/\//i.test(val.trim()) || /\.(onrender\.com|railway\.app|fly\.dev|koyeb\.app)/i.test(val.trim()))
      ) {
        rawEnv = val.trim()
        break
      }
    }
  }

  if (rawEnv && rawEnv !== 'http://localhost:8000' && rawEnv !== 'http://127.0.0.1:8000') {
    return normalizeBackendUrl(rawEnv)
  }

  // 3. If opened over LAN on mobile (e.g. http://192.168.1.x:5173), use same LAN host on port 8000
  if (typeof window !== 'undefined' && window.location.protocol === 'http:') {
    const host = window.location.hostname
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:8000`
    }
  }

  // 4. Default fallback so requests never POST to the static frontend origin (which causes 405)
  return 'http://localhost:8000'
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
