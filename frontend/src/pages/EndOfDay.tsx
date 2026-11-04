import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Wallet,
  TrendingUp,
  Clock,
  Banknote,
  Package,
  Calendar,
  Check,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { DatePicker } from '@/components/DatePicker'
import { EggQuantityInput } from '@/components/EggQuantityInput'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useToast } from '@/components/Toast'
import { closingsApi } from '@/api/closings'
import { summaryApi, type SummaryPeriod } from '@/api/summary'
import { eventsApi } from '@/api/events'
import { settingsApi } from '@/api/settings'
import { formatEggs } from '@/lib/eggs'
import { formatMoney } from '@/lib/money'
import { todayString, formatDate, formatTime } from '@/lib/dates'

export function EndOfDay() {
  const [searchParams, setSearchParams] = useSearchParams()
  const today = todayString()
  const selectedDate = searchParams.get('date') || today
  const toast = useToast()
  const queryClient = useQueryClient()

  // Period filter state: 'day' | 'week' | 'month' | 'year' | 'custom'
  const [period, setPeriod] = useState<SummaryPeriod>('week')
  const [customFrom, setCustomFrom] = useState<string>(today)
  const [customTo, setCustomTo] = useState<string>(today)
  const [borrowedTab, setBorrowedTab] = useState<'unpaid' | 'paid' | 'all'>('unpaid')

  const [countedEggsOverride, setCountedEggsOverride] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  })
  const perCrate = settings?.eggs_per_crate ?? 30

  const { data: periodSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['period-summary', period, selectedDate, customFrom, customTo],
    queryFn: () =>
      summaryApi.getPeriodSummary({
        period,
        date: selectedDate,
        from: period === 'custom' ? customFrom : undefined,
        to: period === 'custom' ? customTo : undefined,
      }),
  })

  const { data: closing, isLoading: isClosingLoading } = useQuery({
    queryKey: ['closing', selectedDate],
    queryFn: () => closingsApi.getClosing(selectedDate),
  })

  const markPaidMutation = useMutation({
    mutationFn: (eventId: number) => eventsApi.markPaid(eventId),
    onSuccess: (updated) => {
      toast(
        `Borrowed sale (${formatMoney(Number(updated.amount ?? 0))}) marked as Paid!`,
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['my-summary'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to mark borrowed sale as paid'
      toast(msg, 'error')
    },
  })

  const countedEggs =
    countedEggsOverride ?? closing?.counted_eggs ?? closing?.closing_eggs ?? 0

  const closeMutation = useMutation({
    mutationFn: () =>
      closingsApi.closeDay(selectedDate, {
        counted_eggs: countedEggs,
      }),
    onSuccess: () => {
      toast('Day closed and locked', 'success')
      setConfirmOpen(false)
      setCountedEggsOverride(null)
      queryClient.invalidateQueries({ queryKey: ['closing', selectedDate] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to close day'
      toast(msg, 'error')
      setConfirmOpen(false)
    },
  })

  const computedClosing = closing?.closing_eggs ?? 0
  const diff = countedEggs - computedClosing

  const cashRevenue = Number(periodSummary?.cash_revenue ?? 0)
  const borrowedUnpaid = Number(periodSummary?.borrowed_unpaid_amount ?? 0)
  const totalSalesAmount = Number(periodSummary?.total_sales_amount ?? 0)
  const feedExpenses = Number(periodSummary?.feed_expenses ?? 0)
  const otherExpenses = Number(periodSummary?.other_expenses ?? 0)
  const totalExpenses = Number(periodSummary?.total_expenses ?? 0)
  const moneyLeftPresent = Number(periodSummary?.money_left_present ?? 0)
  const moneyLeftWithBorrowed = Number(periodSummary?.money_left_with_borrowed ?? 0)

  const allBorrowedSales = periodSummary?.borrowed_sales ?? []
  const filteredBorrowedSales = allBorrowedSales.filter((ev) => {
    if (borrowedTab === 'unpaid') return !ev.paid
    if (borrowedTab === 'paid') return !!ev.paid
    return true
  })

  const periodOptions: { label: string; value: SummaryPeriod }[] = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Year', value: 'year' },
    { label: 'Custom', value: 'custom' },
  ]

  return (
    <>
      <TopBar
        title="Summary"
        right={
          <div className="flex items-center gap-3">
            <DatePicker
              label="Reference Date:"
              value={selectedDate}
              onChange={(d) => {
                setCountedEggsOverride(null)
                setSearchParams({ date: d })
              }}
            />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-page mx-auto space-y-5 sm:space-y-6">
          {/* ==================== 1. FILTER BAR (DAY / WEEK / MONTH / YEAR) ==================== */}
          <div className="card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-label-sm font-semibold text-ink mr-1 flex items-center gap-1.5">
                <Calendar size={16} className="text-brand" />
                View Period:
              </span>
              {periodOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriod(opt.value)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                    period === opt.value
                      ? 'bg-brand text-white shadow-sm'
                      : 'bg-canvas text-muted hover:text-ink border border-border'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {period === 'custom' ? (
              <div className="flex flex-wrap items-center gap-3">
                <DatePicker label="From:" value={customFrom} onChange={setCustomFrom} />
                <DatePicker label="To:" value={customTo} onChange={setCustomTo} />
              </div>
            ) : (
              periodSummary && (
                <div className="text-xs font-medium text-muted bg-canvas px-3 py-1.5 rounded border border-border">
                  Showing:{' '}
                  <span className="font-semibold text-ink">
                    {formatDate(periodSummary.start_date)}
                  </span>{' '}
                  to{' '}
                  <span className="font-semibold text-ink">
                    {formatDate(periodSummary.end_date)}
                  </span>
                </div>
              )
            )}
          </div>

          {isSummaryLoading || !periodSummary ? (
            <div className="py-16 flex items-center justify-center text-muted gap-2">
              <Loader2 size={20} className="animate-spin" />
              <span>Calculating period summary...</span>
            </div>
          ) : (
            <>
              {/* ==================== 2. TOP-MOST HERO: TOTAL AMOUNT OF MONEY LEFT ==================== */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Card A: Total Money Left (Present Cash) */}
                <div className="card p-6 border-2 border-success bg-success-bg/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-success">
                        Total Amount of Money Left (Present)
                      </span>
                      <div className="w-9 h-9 rounded-lg bg-success-bg text-success flex items-center justify-center">
                        <Wallet size={20} />
                      </div>
                    </div>
                    <div
                      className={`text-display-stat-lg font-extrabold tabular-nums ${
                        moneyLeftPresent >= 0 ? 'text-ink' : 'text-danger'
                      }`}
                    >
                      {formatMoney(moneyLeftPresent)}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-success-border/60 text-xs text-muted flex items-center justify-between">
                    <span>Cash Gained ({formatMoney(cashRevenue)}) − Expenses ({formatMoney(totalExpenses)})</span>
                    <span className="font-semibold text-success">Cash on Hand</span>
                  </div>
                </div>

                {/* Card B: Total Money To Be Had (If Borrowed is Paid) */}
                <div className="card p-6 border-2 border-brand/60 bg-brand-tint/20 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-brand">
                        Money Left If Borrowed Is Paid
                      </span>
                      <div className="w-9 h-9 rounded-lg bg-brand-tint text-brand flex items-center justify-center">
                        <TrendingUp size={20} />
                      </div>
                    </div>
                    <div
                      className={`text-display-stat-lg font-extrabold tabular-nums ${
                        moneyLeftWithBorrowed >= 0 ? 'text-ink' : 'text-danger'
                      }`}
                    >
                      {formatMoney(moneyLeftWithBorrowed)}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-border text-xs text-muted flex items-center justify-between">
                    <span>All Sales ({formatMoney(totalSalesAmount)}) − Expenses ({formatMoney(totalExpenses)})</span>
                    <span className="font-semibold text-brand">Projected Total</span>
                  </div>
                </div>

                {/* Card C: Borrowed / Unpaid Balance Owed */}
                <div className="card p-6 border border-warn/50 bg-warn-bg/30 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-warn">
                        Borrowed (Unpaid Money Owed)
                      </span>
                      <div className="w-9 h-9 rounded-lg bg-warn-bg text-warn flex items-center justify-center">
                        <Clock size={20} />
                      </div>
                    </div>
                    <div className="text-display-stat-lg font-extrabold text-warn tabular-nums">
                      {formatMoney(borrowedUnpaid)}
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-warn/30 text-xs text-muted flex items-center justify-between">
                    <span>
                      {allBorrowedSales.filter((e) => !e.paid).length} unpaid credit sale(s)
                    </span>
                    <span className="font-semibold text-warn">Awaiting Admin Settlement</span>
                  </div>
                </div>
              </div>

              {/* ==================== 3. DETAILED PERIOD BREAKDOWN (FINANCIALS & EGG STOCK) ==================== */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Financial Ledger Breakdown (7 cols) */}
                <div className="lg:col-span-7 card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Banknote size={18} className="text-success" />
                      <h2 className="text-title-section text-ink">
                        Financial Breakdown ({period.toUpperCase()})
                      </h2>
                    </div>
                    <span className="text-xs text-muted">
                      {formatDate(periodSummary.start_date)} – {formatDate(periodSummary.end_date)}
                    </span>
                  </div>

                  <div className="p-6 divide-y divide-border text-sm">
                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-ink">Cash Gained (Paid Sales)</span>
                        <p className="text-xs text-muted">Money currently present from paid sales</p>
                      </div>
                      <span className="font-bold text-success tabular-nums">
                        {formatMoney(cashRevenue)}
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-medium text-ink">Borrowed Sales (Not Paid Yet)</span>
                        <p className="text-xs text-muted">Credit sales pending payment</p>
                      </div>
                      <span className="font-bold text-warn tabular-nums">
                        {formatMoney(borrowedUnpaid)}
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between bg-canvas/40 px-3 rounded">
                      <div>
                        <span className="font-semibold text-ink">Total Sales Value (Paid + Borrowed)</span>
                        <p className="text-xs text-muted">Total revenue once all borrowed sales are paid</p>
                      </div>
                      <span className="font-bold text-ink tabular-nums">
                        {formatMoney(totalSalesAmount)}
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <span className="text-muted">Feed Expenses</span>
                      <span className="font-medium text-danger tabular-nums">
                        − {formatMoney(feedExpenses)}
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <span className="text-muted">Other Expenses</span>
                      <span className="font-medium text-danger tabular-nums">
                        − {formatMoney(otherExpenses)}
                      </span>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <span className="font-semibold text-ink">Total Expenses</span>
                      <span className="font-bold text-danger tabular-nums">
                        − {formatMoney(totalExpenses)}
                      </span>
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                      <div>
                        <span className="text-base font-bold text-ink">
                          Total Money Left (Present Now)
                        </span>
                        <p className="text-xs text-muted">
                          If borrowed is paid: <strong className="text-ink">{formatMoney(moneyLeftWithBorrowed)}</strong>
                        </p>
                      </div>
                      <span
                        className={`text-xl font-extrabold tabular-nums ${
                          moneyLeftPresent >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {formatMoney(moneyLeftPresent)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Egg Stock Breakdown (5 cols) */}
                <div className="lg:col-span-5 card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Package size={18} className="text-brand" />
                      <h2 className="text-title-section text-ink">Egg Stock Summary</h2>
                    </div>
                    <span className="text-xs text-muted font-mono">{perCrate} eggs/crate</span>
                  </div>

                  <div className="p-6 divide-y divide-border text-sm">
                    <div className="py-3 flex items-center justify-between">
                      <span className="text-muted">Opening Stock (Start of Period)</span>
                      <div className="text-right tabular-nums">
                        <span className="font-semibold text-ink block">
                          {formatEggs(periodSummary.opening_eggs, perCrate)}
                        </span>
                        <span className="text-xs text-muted">{periodSummary.opening_eggs} eggs</span>
                      </div>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <span className="text-muted">+ Total Eggs Gotten (Received)</span>
                      <div className="text-right tabular-nums">
                        <span className="font-semibold text-intake block">
                          +{formatEggs(periodSummary.gotten_eggs, perCrate)}
                        </span>
                        <span className="text-xs text-muted">{periodSummary.gotten_eggs} eggs</span>
                      </div>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <span className="text-muted">− Total Eggs Sold (Paid &amp; Borrowed)</span>
                      <div className="text-right tabular-nums">
                        <span className="font-semibold text-success block">
                          −{formatEggs(periodSummary.sold_eggs, perCrate)}
                        </span>
                        <span className="text-xs text-muted">{periodSummary.sold_eggs} eggs</span>
                      </div>
                    </div>

                    <div className="py-3 flex items-center justify-between">
                      <span className="text-muted">− Total Cracked Eggs</span>
                      <div className="text-right tabular-nums">
                        <span className="font-semibold text-danger block">
                          −{formatEggs(periodSummary.cracked_eggs, perCrate)}
                        </span>
                        <span className="text-xs text-muted">{periodSummary.cracked_eggs} eggs</span>
                      </div>
                    </div>

                    <div className="pt-4 flex items-center justify-between">
                      <span className="text-base font-bold text-ink">Closing Stock Remaining</span>
                      <div className="text-right tabular-nums">
                        <span className="text-lg font-extrabold text-brand block">
                          {formatEggs(periodSummary.closing_eggs, perCrate)}
                        </span>
                        <span className="text-xs text-muted">
                          = {periodSummary.closing_eggs} total eggs
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ==================== 4. ADMIN SECTION: BORROWED / UNPAID SALES MANAGEMENT ==================== */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-warn-bg/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-title-section text-ink flex items-center gap-2">
                      <Clock size={18} className="text-warn" />
                      Borrowed Sales Management (Admin Only)
                    </h2>
                    <p className="text-xs text-muted">
                      Sales recorded as borrowed (not paid yet). Mark them as Paid once the customer settles their balance.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {(
                      [
                        { label: 'Unpaid (Owed)', value: 'unpaid' },
                        { label: 'Paid (Settled)', value: 'paid' },
                        { label: 'All Borrowed', value: 'all' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setBorrowedTab(tab.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          borrowedTab === tab.value
                            ? 'bg-brand text-white'
                            : 'bg-card text-muted hover:text-ink border border-border'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredBorrowedSales.length === 0 ? (
                  <div className="py-10 text-center text-muted text-sm">
                    {borrowedTab === 'unpaid'
                      ? 'No unpaid borrowed sales! All credit sales have been settled.'
                      : 'No borrowed sales found for this filter.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-canvas border-b border-border">
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                            Date &amp; Time
                          </th>
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                            Customer / Note
                          </th>
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                            Recorded By
                          </th>
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                            Quantity
                          </th>
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                            Amount
                          </th>
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                            Status
                          </th>
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                            Admin Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-sm">
                        {filteredBorrowedSales.map((ev) => (
                          <tr key={ev.id} className="hover:bg-canvas/60 transition-colors">
                            <td className="py-3.5 px-6 text-muted tabular-nums whitespace-nowrap">
                              <span className="font-medium text-ink">{formatDate(ev.business_date)}</span>{' '}
                              <span className="text-xs">· {formatTime(ev.occurred_at)}</span>
                            </td>
                            <td className="py-3.5 px-6 font-semibold text-ink">
                              {ev.note || 'Unnamed Customer'}
                            </td>
                            <td className="py-3.5 px-6 text-muted whitespace-nowrap">
                              {ev.user_name || `User #${ev.user_id}`}
                            </td>
                            <td className="py-3.5 px-6 text-ink tabular-nums whitespace-nowrap">
                              {formatEggs(ev.eggs, perCrate)}{' '}
                              <span className="text-xs text-muted">({ev.eggs} eggs)</span>
                            </td>
                            <td className="py-3.5 px-6 text-right font-bold text-ink tabular-nums whitespace-nowrap">
                              {formatMoney(Number(ev.amount ?? 0))}
                            </td>
                            <td className="py-3.5 px-6 whitespace-nowrap">
                              {ev.paid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success border border-success-border">
                                  <Check size={12} />
                                  Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warn-bg text-warn border border-warn/40">
                                  <Clock size={12} />
                                  Borrowed (Unpaid)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-right whitespace-nowrap">
                              {!ev.paid ? (
                                <button
                                  type="button"
                                  disabled={markPaidMutation.isPending}
                                  onClick={() => markPaidMutation.mutate(ev.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-success text-white hover:opacity-90 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} />
                                  Mark as Paid
                                </button>
                              ) : (
                                <span className="text-xs text-muted">Settled</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ==================== 5. DAILY STOCK RECONCILIATION & LOCK ==================== */}
          {!isClosingLoading && closing && (
            <div className="card overflow-hidden">
              <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-canvas/40">
                <div>
                  <h2 className="text-title-section text-ink">
                    Reconcile &amp; Close Day · {formatDate(selectedDate)}
                  </h2>
                  <p className="text-helper-xs text-muted">
                    Compare computed closing stock against the physical egg count in the storeroom
                  </p>
                </div>
                {closing.locked ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-bg text-success">
                    <Lock size={12} />
                    Locked
                  </span>
                ) : (
                  <span className="badge-neutral">Open</span>
                )}
              </div>

              <div className="p-6 space-y-6">
                <div className="p-4 rounded-md bg-canvas border border-border flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-wider text-muted">
                      Computed Closing Stock ({formatDate(selectedDate)})
                    </span>
                    <span className="text-helper-xs text-muted">
                      Opening + Gotten − Cracked − Sold
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block text-lg font-bold text-ink tabular-nums">
                      {formatEggs(computedClosing, perCrate)}
                    </span>
                    <span className="text-xs text-muted tabular-nums">
                      = {computedClosing} total eggs
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-label-sm text-ink mb-2">
                    Physical Stock Counted in Storeroom
                  </label>
                  <EggQuantityInput
                    value={countedEggs}
                    onChange={setCountedEggsOverride}
                    perCrate={perCrate}
                    disabled={closing.locked}
                  />
                </div>

                {diff === 0 ? (
                  <div className="p-4 rounded-md bg-success-bg border border-success/30 flex items-center gap-3">
                    <CheckCircle2 size={20} className="text-success flex-shrink-0" />
                    <div>
                      <p className="text-body-medium text-success">Matches computed stock</p>
                      <p className="text-helper-xs text-muted">
                        Physical count equals computed book balance ({computedClosing} eggs).
                      </p>
                    </div>
                  </div>
                ) : diff < 0 ? (
                  <div className="p-4 rounded-md bg-danger-bg border border-danger/30 flex items-center gap-3">
                    <XCircle size={20} className="text-danger flex-shrink-0" />
                    <div>
                      <p className="text-body-medium text-danger">
                        Short by {formatEggs(Math.abs(diff), perCrate)} ({Math.abs(diff)} eggs)
                      </p>
                      <p className="text-helper-xs text-muted">
                        Physical count is lower than computed book balance.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 rounded-md bg-warn-bg border border-warn/30 flex items-center gap-3">
                    <AlertTriangle size={20} className="text-warn flex-shrink-0" />
                    <div>
                      <p className="text-body-medium text-warn">
                        Over by {formatEggs(diff, perCrate)} (+{diff} eggs)
                      </p>
                      <p className="text-helper-xs text-muted">
                        Physical count is higher than computed book balance.
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end">
                  {closing.locked ? (
                    <div className="text-xs text-muted flex items-center gap-1.5">
                      <Lock size={14} className="text-success" />
                      This day is locked. No further staff entries can be added.
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      className="btn-primary"
                    >
                      <Lock size={16} />
                      Close &amp; Lock Day
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Close & Lock Day"
        message={`Close and lock ${formatDate(selectedDate)} with a physical count of ${formatEggs(
          countedEggs,
          perCrate,
        )}? Staff will no longer be able to add or edit entries for this date.`}
        confirmLabel="Lock Day"
        isLoading={closeMutation.isPending}
      />
    </>
  )
}
