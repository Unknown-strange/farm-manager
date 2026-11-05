import { apiClient } from './client'
import type { EggEvent } from './events'

export interface WorkerSalesSummary {
  user_id: number
  user_name: string
  sold_eggs: number
  sold_amount: string | number
  borrowed_amount?: string | number
}

export interface DailyBookSummary {
  business_date: string
  opening: number
  gotten: number
  cracked: number
  sold: number
  closing: number
  revenue: string | number
  borrowed_amount?: string | number
  total_sales_amount?: string | number
  feed: string | number
  other: string | number
  total_expenses: string | number
  net_margin: string | number
  projected_net_margin?: string | number
  locked: boolean
  counted_eggs?: number | null
  actual_revenue?: string | number | null
  actual_expenses?: string | number | null
  actual_sold_eggs?: number | null
  recorded_revenue?: string | number | null
  recorded_expenses?: string | number | null
  recorded_sold?: number | null
  computed_closing?: number | null
  reconciled?: boolean
  closed_at?: string | null
  by_worker: WorkerSalesSummary[]
  logged_by?: string[]
  opening_anchor_date?: string | null
  opening_anchor_eggs?: number | null
}

export type SummaryPeriod = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'

export interface PeriodSummary {
  period: SummaryPeriod
  start_date: string
  end_date: string
  opening_eggs: number
  gotten_eggs: number
  cracked_eggs: number
  sold_eggs: number
  closing_eggs: number
  beginning_money?: string | number
  cash_revenue: string | number
  borrowed_unpaid_amount: string | number
  borrowed_paid_amount: string | number
  total_sales_amount: string | number
  feed_expenses: string | number
  other_expenses: string | number
  total_expenses: string | number
  money_left_present: string | number
  money_left_with_borrowed: string | number
  borrowed_sales: EggEvent[]
}

export interface StaffSummary {
  business_date: string
  sales_count: number
  sales_total: string | number
  borrowed_total?: string | number
}

export interface GetPeriodSummaryParams {
  period: SummaryPeriod
  date?: string
  from?: string
  to?: string
}

export const summaryApi = {
  getDailyBook: (date?: string) =>
    apiClient
      .get<DailyBookSummary>('/summary', { params: date ? { date } : undefined })
      .then((r) => r.data),

  getPeriodSummary: (params: GetPeriodSummaryParams) =>
    apiClient
      .get<PeriodSummary>('/summary/period', { params })
      .then((r) => r.data),

  getMySummary: (date?: string) =>
    apiClient
      .get<StaffSummary>('/summary/mine', { params: date ? { date } : undefined })
      .then((r) => r.data),
}
