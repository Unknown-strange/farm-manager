import { apiClient } from './client'

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
  login: (username: string, password: string) =>
    apiClient
      .post<LoginResponse>('/auth/login', { username, password })
      .then((r) => r.data),

  me: () => apiClient.get<MeResponse>('/auth/me').then((r) => r.data),

  changePassword: (current_password: string, new_password: string) =>
    apiClient
      .post<{ detail: string }>('/auth/change-password', {
        current_password,
        new_password,
      })
      .then((r) => r.data),
}
