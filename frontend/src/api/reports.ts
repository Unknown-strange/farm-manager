import { apiClient } from './client'

export interface ReportRow {
  business_date: string
  opening: number
  gotten: number
  cracked: number
  sold: number
  closing: number
  revenue: string | number
  feed: string | number
  other: string | number
  total_expenses: string | number
  net_margin: string | number
  logged_by?: string[]
  reconciled?: boolean
}

export const reportsApi = {
  getReports: (from?: string, to?: string) => {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    return apiClient.get<ReportRow[]>('/reports', { params }).then((r) => r.data)
  },

  exportCsv: async (from?: string, to?: string) => {
    const params: Record<string, string> = {}
    if (from) params.from = from
    if (to) params.to = to
    const response = await apiClient.get<Blob>('/reports/export', {
      params,
      responseType: 'blob',
    })
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `eggbook_report_${from || 'start'}_to_${to || 'end'}.csv`)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}

