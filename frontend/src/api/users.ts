import { apiClient } from './client'

export interface User {
  id: number
  name: string
  username: string
  role: 'admin' | 'staff'
  is_active: boolean
  is_deleted?: boolean
  deleted_at?: string | null
  deleted_by?: number | null
  created_at: string
}

export interface CreateUserPayload {
  name: string
  username: string
  password: string
  role: 'admin' | 'staff'
}

export interface UpdateUserPayload {
  name?: string
  is_active?: boolean
  is_deleted?: boolean
}

export const usersApi = {
  getUsers: () => apiClient.get<User[]>('/users').then((r) => r.data),

  createUser: (payload: CreateUserPayload) =>
    apiClient.post<User>('/users', payload).then((r) => r.data),

  updateUser: (id: number, payload: UpdateUserPayload) =>
    apiClient.patch<User>(`/users/${id}`, payload).then((r) => r.data),

  deleteUser: (id: number) =>
    apiClient.delete<User>(`/users/${id}`).then((r) => r.data),

  resetPassword: (id: number, new_password: string) =>
    apiClient
      .post<{ detail: string }>(`/users/${id}/reset-password`, { new_password })
      .then((r) => r.data),
}

