import { apiClient } from './client'
import type { EggEvent } from './events'
import type { Expense, ExpenseCategory } from './expenses'

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
  crates?: string | number
  other: string | number
  borrowed_expenses_paid?: string | number
  borrowed_expenses_unpaid?: string | number
  unpaid_borrowed_expenses_all_time?: string | number
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

export interface DailyFinancialSummaryItem {
  date: string
  day_name: string
  opening_money: string | number
  cash_revenue: string | number
  borrowed_amount: string | number
  total_sales_value: string | number
  feed_expenses: string | number
  crates_expenses?: string | number
  other_expenses: string | number
  borrowed_expenses_paid?: string | number
  borrowed_expenses_unpaid?: string | number
  total_expenses: string | number
  net_cash_flow: string | number
  closing_money: string | number
  logged_by: string[]
  sales_count: number
  expenses_count: number
}

export interface PeriodExpenseItem {
  id: number
  business_date: string
  category: ExpenseCategory
  name: string
  quantity?: string | null
  amount: string | number
  is_borrowed?: boolean
  paid?: boolean
  paid_by?: number | null
  paid_at?: string | null
  created_by_name: string
  created_at: string
}

export interface FinancialTransactionItem {
  id: string
  kind:
  | 'sale_cash'
  | 'sale_borrowed'
  | 'expense_feed'
  | 'expense_crates'
  | 'expense_other'
  | 'expense_borrowed'
  | 'settlement'
  business_date: string
  occurred_at: string
  title: string
  description?: string | null
  amount: string | number
  is_cash_in: boolean
  user_name: string
  crates?: number | null
  eggs?: number | null
  paid: boolean
}

export interface DailyEggStockItem {
  date: string
  day_name: string
  opening_eggs: number
  received_eggs: number
  sold_eggs: number
  cracked_eggs: number
  adjustment_eggs: number
  closing_eggs: number
  locked: boolean
}

export interface PeriodSummary {
  period: SummaryPeriod
  start_date: string
  end_date: string
  opening_eggs: number
  gotten_eggs: number
  cracked_eggs: number
  sold_eggs: number
  closing_eggs: number
  stock_adjustment_eggs?: number
  beginning_money?: string | number
  cash_revenue: string | number
  borrowed_unpaid_amount: string | number
  borrowed_paid_amount: string | number
  total_sales_amount: string | number
  unpaid_borrowed_all_time?: string | number
  unpaid_borrowed_outside_period?: string | number
  feed_expenses: string | number
  crates_expenses?: string | number
  other_expenses: string | number
  borrowed_expenses_paid?: string | number
  borrowed_expenses_unpaid?: string | number
  unpaid_borrowed_expenses_all_time?: string | number
  total_expenses: string | number
  money_left_present: string | number
  money_left_with_borrowed: string | number
  borrowed_sales: EggEvent[]
  borrowed_expenses?: Expense[]
  daily_financials?: DailyFinancialSummaryItem[]
  daily_egg_stock?: DailyEggStockItem[]
  expenses?: PeriodExpenseItem[]
  financial_transactions?: FinancialTransactionItem[]
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
