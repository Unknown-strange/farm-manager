import { apiClient } from './client'

export type ExpenseCategory = 'feed' | 'other'

export interface Expense {
  id: number
  category: ExpenseCategory
  name: string
  quantity?: string | null
  amount: string | number
  business_date: string
  created_by: number
  created_by_name?: string | null
  voided: boolean
  voided_by?: number | null
  voided_at?: string | null
  created_at: string
}

export interface CreateExpensePayload {
  category: ExpenseCategory
  name?: string
  quantity?: string
  amount: number
  business_date?: string
}

export interface CreateExpenseResponse {
  id: number
  created_at: string
  undo_until: string
}

export interface UpdateExpensePayload {
  category?: ExpenseCategory
  name?: string
  quantity?: string
  amount?: number
}

export interface GetExpensesParams {
  date?: string
  category?: ExpenseCategory | ''
  user_id?: number
}

export const expensesApi = {
  getExpenses: (params?: GetExpensesParams) => {
    const query: Record<string, string | number> = {}
    if (params?.date) query.date = params.date
    if (params?.category) query.category = params.category
    if (params?.user_id) query.user_id = params.user_id
    return apiClient.get<Expense[]>('/expenses', { params: query }).then((r) => r.data)
  },

  createExpense: (payload: CreateExpensePayload) =>
    apiClient.post<CreateExpenseResponse>('/expenses', payload).then((r) => r.data),

  undoExpense: (id: number) =>
    apiClient.post<{ status: string; id: number }>(`/expenses/${id}/undo`).then((r) => r.data),

  updateExpense: (id: number, payload: UpdateExpensePayload) =>
    apiClient.patch<Expense>(`/expenses/${id}`, payload).then((r) => r.data),

  voidExpense: (id: number) =>
    apiClient.post<Expense>(`/expenses/${id}/void`).then((r) => r.data),
}

