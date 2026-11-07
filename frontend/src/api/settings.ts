import { apiClient } from './client'

export interface Settings {
  id: number
  eggs_per_crate: number
  currency: string
  beginning_eggs?: number
  beginning_money?: string | number
}

export interface UpdateSettingsPayload {
  eggs_per_crate?: number
  currency?: string
  beginning_eggs?: number
  target_present_eggs?: number
  target_opening_eggs?: number
  target_opening_date?: string
  beginning_money?: number | string
  target_present_money?: number | string
}

export const settingsApi = {
  getSettings: () => apiClient.get<Settings>('/settings').then((r) => r.data),

  updateSettings: (payload: UpdateSettingsPayload) =>
    apiClient.patch<Settings>('/settings', payload).then((r) => r.data),
}

