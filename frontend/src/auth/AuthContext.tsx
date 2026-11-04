import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { authApi, type MeResponse } from '@/api/auth'

interface AuthContextValue {
  user: MeResponse | null
  permissions: string[]
  isLoading: boolean
  login: (username: string, password: string) => Promise<MeResponse>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<MeResponse | null>(null)
  const [isLoading, setIsLoading] = useState(() => Boolean(sessionStorage.getItem('token')))

  // On mount: try to restore session from sessionStorage
  useEffect(() => {
    const token = sessionStorage.getItem('token')
    if (!token) {
      return
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => sessionStorage.removeItem('token'))
      .finally(() => setIsLoading(false))
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    const { access_token } = await authApi.login(username, password)
    sessionStorage.setItem('token', access_token)
    const me = await authApi.me()
    setUser(me)
    return me
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem('token')
    setUser(null)
    queryClient.clear()
  }, [queryClient])

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions: user?.permissions ?? [],
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
