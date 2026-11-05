import { apiClient } from './client'

export interface DailyClosing {
  business_date: string
  opening_override?: number | null
  closing_eggs?: number | null
  counted_eggs?: number | null
  difference_eggs?: number | null
  actual_revenue?: string | number | null
  actual_expenses?: string | number | null
  actual_sold_eggs?: number | null
  recorded_revenue?: string | number | null
  recorded_expenses?: string | number | null
  recorded_sold_eggs?: number | null
  locked: boolean
  closed_by?: number | null
  closed_at?: string | null
}

export interface CloseDayPayload {
  counted_eggs: number
  opening_override?: number | null
  actual_revenue?: number | null
  actual_expenses?: number | null
  actual_sold_eggs?: number | null
}

export const closingsApi = {
  getClosing: (date: string) =>
    apiClient.get<DailyClosing>(`/closings/${date}`).then((r) => r.data),

  closeDay: (date: string, payload: CloseDayPayload) =>
    apiClient.post<DailyClosing>(`/closings/${date}`, payload).then((r) => r.data),

  unlockDay: (date: string) =>
    apiClient.post<DailyClosing>(`/closings/${date}/unlock`).then((r) => r.data),
}

