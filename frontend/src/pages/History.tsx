import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { Download, Loader2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { DatePicker } from '@/components/DatePicker'
import { useToast } from '@/components/Toast'
import { reportsApi } from '@/api/reports'
import { settingsApi } from '@/api/settings'
import { formatEggs } from '@/lib/eggs'
import { formatMoney } from '@/lib/money'
import { todayString, formatDate } from '@/lib/dates'

function sevenDaysAgoString(today: string): string {
  const d = new Date(`${today}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 6)
  return d.toISOString().slice(0, 10)
}

export function History() {
  const navigate = useNavigate()
  const toast = useToast()
  const today = todayString()

  const [fromDate, setFromDate] = useState(() => sevenDaysAgoString(today))
  const [toDate, setToDate] = useState(today)
  const [exporting, setExporting] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  })
  const perCrate = settings?.eggs_per_crate ?? 30

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['reports', fromDate, toDate],
    queryFn: () => reportsApi.getReports(fromDate, toDate),
  })

  const handleExportCsv = async () => {
    try {
      setExporting(true)
      await reportsApi.exportCsv(fromDate, toDate)
      toast('CSV report downloaded', 'success')
    } catch {
      toast('Failed to export CSV report', 'error')
    } finally {
      setExporting(false)
    }
  }

  const chartData = rows.map((r) => ({
    date: r.business_date.slice(5),
    Revenue: Number(r.revenue),
    Expenses: Number(r.total_expenses),
    NetMargin: Number(r.net_margin),
  }))

  return (
    <>
      <TopBar
        title="History"
        right={
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <DatePicker label="From:" value={fromDate} onChange={setFromDate} max={toDate} />
            <DatePicker label="To:" value={toDate} onChange={setToDate} />
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={exporting}
              className="btn-outline h-9 sm:h-10 px-3 sm:px-3.5 text-xs"
            >
              <Download size={15} />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-page mx-auto space-y-5 sm:space-y-6">
          {/* Bar Chart */}
          <div className="card p-4 sm:p-6">
            <div className="mb-4">
              <h2 className="text-title-section text-ink">Sales Revenue vs. Total Expenses</h2>
              <p className="text-xs text-muted">
                Daily financial performance across the selected date range
              </p>
            </div>

            {isLoading ? (
              <div className="h-64 flex items-center justify-center text-muted gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading chart...</span>
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted">
                No data for selected range.
              </div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E8E4DC" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#6F6A61' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#6F6A61' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#1F7A4C" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#B91C1C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Daily Summary Table */}
          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-title-section text-ink">Daily Ledger History</h2>
                <p className="text-xs text-muted">
                  Click any row to open that day&apos;s full Daily Book on the Dashboard
                </p>
              </div>
              <span className="badge-neutral">{rows.length} days</span>
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center text-muted gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading daily summaries...</span>
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-muted">No daily records in range.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-canvas border-b border-border">
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Date
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Logged By
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Opening
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Gotten
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Cracked
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Sold
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Closing
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Revenue
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Spent
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Net Cash
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {[...rows].reverse().map((row) => (
                      <tr
                        key={row.business_date}
                        onClick={() => navigate(`/dashboard?date=${row.business_date}`)}
                        className="hover:bg-canvas/70 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-semibold text-brand whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{formatDate(row.business_date)}</span>
                            {row.reconciled && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-success-bg text-success border border-success-border">
                                Reconciled
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {row.logged_by && row.logged_by.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5 max-w-[220px]">
                              {row.logged_by.map((name) => (
                                <span
                                  key={name}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-canvas border border-border text-ink whitespace-nowrap shadow-xs"
                                >
                                  {name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-ink tabular-nums whitespace-nowrap">
                          {formatEggs(row.opening, perCrate)}
                        </td>
                        <td className="py-3.5 px-4 text-intake tabular-nums whitespace-nowrap">
                          +{formatEggs(row.gotten, perCrate)}
                        </td>
                        <td className="py-3.5 px-4 text-danger tabular-nums whitespace-nowrap">
                          {formatEggs(row.cracked, perCrate)}
                        </td>
                        <td className="py-3.5 px-4 text-success tabular-nums whitespace-nowrap">
                          -{formatEggs(row.sold, perCrate)}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-ink tabular-nums whitespace-nowrap">
                          {formatEggs(row.closing, perCrate)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-success tabular-nums whitespace-nowrap">
                          {formatMoney(Number(row.revenue))}
                        </td>
                        <td className="py-3.5 px-4 text-right font-medium text-danger tabular-nums whitespace-nowrap">
                          {formatMoney(Number(row.total_expenses))}
                        </td>
                        <td
                          className={`py-3.5 px-4 text-right font-bold tabular-nums whitespace-nowrap ${Number(row.net_margin) >= 0 ? 'text-success' : 'text-danger'
                            }`}
                        >
                          {formatMoney(Number(row.net_margin))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

