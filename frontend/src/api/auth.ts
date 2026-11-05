import { apiClient } from './client'
import { waitForBackendReady } from './health'

export interface LoginResponse {
  access_token: string
  token_type: string
}

export interface MeResponse {
  id: number
  name: string
  username: string
  role: 'admin' | 'staff'
  permissions: string[]
  is_active: boolean
}

export const authApi = {
  login: async (username: string, password: string) => {
    // 1. Wait for backend health check to succeed (up to 5 minutes)
    await waitForBackendReady(300_000)

    // 2. Execute login request with extended 5-minute timeout
    return apiClient
      .post<LoginResponse>(
        '/auth/login',
        { username, password },
        { timeout: 300_000 },
      )
      .then((r) => r.data)
  },

  me: async () => {
    // Ensure backend is awake before fetching current user profile
    await waitForBackendReady(300_000)
    return apiClient
      .get<MeResponse>('/auth/me', { timeout: 300_000 })
      .then((r) => r.data)
  },

  changePassword: (current_password: string, new_password: string) =>
    apiClient
      .post<{ detail: string }>('/auth/change-password', {
        current_password,
        new_password,
      })
      .then((r) => r.data),
}
