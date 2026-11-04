import { apiClient } from './client'

export interface Settings {
  id: number
  eggs_per_crate: number
  currency: string
}

export interface UpdateSettingsPayload {
  eggs_per_crate?: number
  currency?: string
}

export const settingsApi = {
  getSettings: () => apiClient.get<Settings>('/settings').then((r) => r.data),

  updateSettings: (payload: UpdateSettingsPayload) =>
    apiClient.patch<Settings>('/settings', payload).then((r) => r.data),
}

