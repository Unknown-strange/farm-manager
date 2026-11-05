import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Lock,
  Unlock,
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
  Sliders,
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

  // Reconciliation actual inputs
  const [countedEggsOverride, setCountedEggsOverride] = useState<number | null>(null)
  const [actualRevenueInput, setActualRevenueInput] = useState<string>('')
  const [actualExpensesInput, setActualExpensesInput] = useState<string>('')
  const [actualSoldEggsOverride, setActualSoldEggsOverride] = useState<number | null>(null)

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false)

  // Reset local override inputs on date change
  useEffect(() => {
    setCountedEggsOverride(null)
    setActualRevenueInput('')
    setActualExpensesInput('')
    setActualSoldEggsOverride(null)
  }, [selectedDate])

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

  const { data: dailyBook } = useQuery({
    queryKey: ['daily-book', selectedDate],
    queryFn: () => summaryApi.getDailyBook(selectedDate),
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

  // Recorded values from system entries
  const recordedClosing = closing?.closing_eggs ?? dailyBook?.computed_closing ?? dailyBook?.closing ?? 0
  const recordedRevenue = Number(closing?.recorded_revenue ?? dailyBook?.recorded_revenue ?? dailyBook?.revenue ?? 0)
  const recordedExpenses = Number(closing?.recorded_expenses ?? dailyBook?.recorded_expenses ?? dailyBook?.total_expenses ?? 0)
  const recordedSold = closing?.recorded_sold_eggs ?? dailyBook?.recorded_sold ?? dailyBook?.sold ?? 0

  // Effective actual values with manual overrides
  const countedEggs = countedEggsOverride ?? closing?.counted_eggs ?? recordedClosing
  const actualRevenue = actualRevenueInput !== ''
    ? Number(actualRevenueInput)
    : (closing?.actual_revenue != null ? Number(closing.actual_revenue) : recordedRevenue)
  const actualExpenses = actualExpensesInput !== ''
    ? Number(actualExpensesInput)
    : (closing?.actual_expenses != null ? Number(closing.actual_expenses) : recordedExpenses)
  const actualSoldEggs = actualSoldEggsOverride ?? closing?.actual_sold_eggs ?? recordedSold

  const diffEggs = countedEggs - recordedClosing
  const diffRevenue = Number((actualRevenue - recordedRevenue).toFixed(2))
  const diffExpenses = Number((actualExpenses - recordedExpenses).toFixed(2))
  const diffSold = actualSoldEggs - recordedSold

  const closeMutation = useMutation({
    mutationFn: () =>
      closingsApi.closeDay(selectedDate, {
        counted_eggs: countedEggs,
        actual_revenue: actualRevenue,
        actual_expenses: actualExpenses,
        actual_sold_eggs: actualSoldEggs,
      }),
    onSuccess: () => {
      toast('Day closed and locked with actual figures', 'success')
      setConfirmOpen(false)
      setCountedEggsOverride(null)
      setActualRevenueInput('')
      setActualExpensesInput('')
      setActualSoldEggsOverride(null)
      queryClient.invalidateQueries({ queryKey: ['closing', selectedDate] })
      queryClient.invalidateQueries({ queryKey: ['daily-book', selectedDate] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to close day'
      toast(msg, 'error')
      setConfirmOpen(false)
    },
  })

  const unlockMutation = useMutation({
    mutationFn: () => closingsApi.unlockDay(selectedDate),
    onSuccess: () => {
      toast('Day unlocked. You can now re-adjust numbers or entries.', 'success')
      setUnlockConfirmOpen(false)
      queryClient.invalidateQueries({ queryKey: ['closing', selectedDate] })
      queryClient.invalidateQueries({ queryKey: ['daily-book', selectedDate] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to unlock day'
      toast(msg, 'error')
      setUnlockConfirmOpen(false)
    },
  })

  const allBorrowedSales = periodSummary?.borrowed_sales ?? []
  const unpaidBorrowedSales = allBorrowedSales.filter((e) => !e.paid)
  const unpaidListSum = unpaidBorrowedSales.reduce(
    (sum, ev) => sum + Number(ev.amount ?? 0),
    0,
  )

  const cashRevenue = Number(periodSummary?.cash_revenue ?? 0)
  const borrowedUnpaid = Math.max(
    Number(periodSummary?.borrowed_unpaid_amount ?? 0),
    Number(unpaidListSum.toFixed(2)),
  )
  const totalSalesAmount = Math.max(
    Number(periodSummary?.total_sales_amount ?? 0),
    Number((cashRevenue + borrowedUnpaid).toFixed(2)),
  )
  const feedExpenses = Number(periodSummary?.feed_expenses ?? 0)
  const otherExpenses = Number(periodSummary?.other_expenses ?? 0)
  const totalExpenses = Number(periodSummary?.total_expenses ?? 0)
  const moneyLeftPresent = Number(periodSummary?.money_left_present ?? 0)
  const moneyLeftWithBorrowed = Number((moneyLeftPresent + borrowedUnpaid).toFixed(2))

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
    { label: 'All Time', value: 'all' },
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
                    <span>Present ({formatMoney(moneyLeftPresent)}) + Borrowed Owed ({formatMoney(borrowedUnpaid)})</span>
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

          {/* ==================== 5. DAILY RECONCILIATION & LOCK ==================== */}
          {!isClosingLoading && closing && (
            <div className="card overflow-hidden">
              <div className="px-6 py-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-canvas/40">
                <div>
                  <h2 className="text-title-section text-ink flex items-center gap-2">
                    <Sliders size={18} className="text-brand" />
                    Reconcile &amp; Close Day · {formatDate(selectedDate)}
                  </h2>
                  <p className="text-helper-xs text-muted mt-0.5">
                    Enter physical storeroom counts and actual financial figures. Locking updates the real system values for this day and anchors stock forward.
                  </p>
                </div>
                {closing.locked ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-bg text-success border border-success-border self-start sm:self-auto">
                    <Lock size={12} />
                    Locked &amp; Reconciled
                  </span>
                ) : (
                  <span className="badge-neutral self-start sm:self-auto">Open for Reconciliation</span>
                )}
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Field 1: Physical Storeroom Closing Stock */}
                  <div className="p-5 rounded-lg border border-border bg-canvas/30 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                          <Package size={15} className="text-brand" />
                          1. Physical Eggs in Storeroom
                        </span>
                        <p className="text-helper-xs text-muted mt-0.5">
                          Recorded closing stock: <strong className="text-ink">{formatEggs(recordedClosing, perCrate)}</strong> ({recordedClosing} eggs)
                        </p>
                      </div>
                      <span className="text-xs font-mono text-muted bg-canvas px-2 py-0.5 rounded border border-border">
                        Storeroom Count
                      </span>
                    </div>

                    <EggQuantityInput
                      value={countedEggs}
                      onChange={setCountedEggsOverride}
                      perCrate={perCrate}
                      disabled={closing.locked}
                    />

                    {diffEggs === 0 ? (
                      <div className="p-2.5 rounded bg-success-bg border border-success/30 flex items-center gap-2 text-xs text-success">
                        <CheckCircle2 size={15} className="flex-shrink-0" />
                        <span>Matches recorded system stock ({recordedClosing} eggs).</span>
                      </div>
                    ) : diffEggs < 0 ? (
                      <div className="p-2.5 rounded bg-danger-bg border border-danger/30 flex items-center gap-2 text-xs text-danger font-medium">
                        <XCircle size={15} className="flex-shrink-0" />
                        <span>Short by {formatEggs(Math.abs(diffEggs), perCrate)} ({Math.abs(diffEggs)} eggs vs recorded)</span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded bg-warn-bg border border-warn/30 flex items-center gap-2 text-xs text-warn font-medium">
                        <AlertTriangle size={15} className="flex-shrink-0" />
                        <span>Over by +{formatEggs(diffEggs, perCrate)} (+{diffEggs} eggs vs recorded)</span>
                      </div>
                    )}
                  </div>

                  {/* Field 2: Actual Total Cash Gotten */}
                  <div className="p-5 rounded-lg border border-border bg-canvas/30 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                          <Banknote size={15} className="text-success" />
                          2. Actual Cash Gotten (Revenue)
                        </span>
                        <p className="text-helper-xs text-muted mt-0.5">
                          Recorded cash revenue: <strong className="text-ink">{formatMoney(recordedRevenue)}</strong>
                        </p>
                      </div>
                      <span className="text-xs font-mono text-muted bg-canvas px-2 py-0.5 rounded border border-border">
                        Cash Till
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                        GH₵
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={closing.locked}
                        value={
                          actualRevenueInput !== ''
                            ? actualRevenueInput
                            : closing.locked
                            ? (closing.actual_revenue != null ? String(closing.actual_revenue) : String(recordedRevenue))
                            : (closing?.actual_revenue != null ? String(closing.actual_revenue) : (actualRevenueInput !== '' ? actualRevenueInput : ''))
                        }
                        onChange={(e) => setActualRevenueInput(e.target.value)}
                        placeholder={String(recordedRevenue)}
                        className="input-field pl-12 font-bold tabular-nums w-full"
                      />
                    </div>

                    {diffRevenue === 0 ? (
                      <div className="p-2.5 rounded bg-success-bg border border-success/30 flex items-center gap-2 text-xs text-success">
                        <CheckCircle2 size={15} className="flex-shrink-0" />
                        <span>Matches recorded cash revenue ({formatMoney(recordedRevenue)}).</span>
                      </div>
                    ) : diffRevenue > 0 ? (
                      <div className="p-2.5 rounded bg-success-bg border border-success/30 flex items-center gap-2 text-xs text-success font-medium">
                        <CheckCircle2 size={15} className="flex-shrink-0" />
                        <span>Extra cash: +{formatMoney(diffRevenue)} above recorded sales</span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded bg-danger-bg border border-danger/30 flex items-center gap-2 text-xs text-danger font-medium">
                        <XCircle size={15} className="flex-shrink-0" />
                        <span>Short by {formatMoney(Math.abs(diffRevenue))} below recorded sales</span>
                      </div>
                    )}
                  </div>

                  {/* Field 3: Actual Total Expenses Made */}
                  <div className="p-5 rounded-lg border border-border bg-canvas/30 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                          <Wallet size={15} className="text-danger" />
                          3. Actual Expenses Made
                        </span>
                        <p className="text-helper-xs text-muted mt-0.5">
                          Recorded expenses: <strong className="text-ink">{formatMoney(recordedExpenses)}</strong>
                        </p>
                      </div>
                      <span className="text-xs font-mono text-muted bg-canvas px-2 py-0.5 rounded border border-border">
                        Total Spent
                      </span>
                    </div>

                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">
                        GH₵
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={closing.locked}
                        value={
                          actualExpensesInput !== ''
                            ? actualExpensesInput
                            : closing.locked
                            ? (closing.actual_expenses != null ? String(closing.actual_expenses) : String(recordedExpenses))
                            : (closing?.actual_expenses != null ? String(closing.actual_expenses) : (actualExpensesInput !== '' ? actualExpensesInput : ''))
                        }
                        onChange={(e) => setActualExpensesInput(e.target.value)}
                        placeholder={String(recordedExpenses)}
                        className="input-field pl-12 font-bold tabular-nums w-full"
                      />
                    </div>

                    {diffExpenses === 0 ? (
                      <div className="p-2.5 rounded bg-success-bg border border-success/30 flex items-center gap-2 text-xs text-success">
                        <CheckCircle2 size={15} className="flex-shrink-0" />
                        <span>Matches recorded expenses ({formatMoney(recordedExpenses)}).</span>
                      </div>
                    ) : diffExpenses > 0 ? (
                      <div className="p-2.5 rounded bg-warn-bg border border-warn/30 flex items-center gap-2 text-xs text-warn font-medium">
                        <AlertTriangle size={15} className="flex-shrink-0" />
                        <span>Extra expenses: +{formatMoney(diffExpenses)} above recorded</span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded bg-success-bg border border-success/30 flex items-center gap-2 text-xs text-success font-medium">
                        <CheckCircle2 size={15} className="flex-shrink-0" />
                        <span>Lower expenses: −{formatMoney(Math.abs(diffExpenses))} vs recorded</span>
                      </div>
                    )}
                  </div>

                  {/* Field 4: Actual Total Eggs Sold */}
                  <div className="p-5 rounded-lg border border-border bg-canvas/30 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                          <Package size={15} className="text-brand" />
                          4. Actual Eggs Sold Today
                        </span>
                        <p className="text-helper-xs text-muted mt-0.5">
                          Recorded eggs sold: <strong className="text-ink">{formatEggs(recordedSold, perCrate)}</strong> ({recordedSold} eggs)
                        </p>
                      </div>
                      <span className="text-xs font-mono text-muted bg-canvas px-2 py-0.5 rounded border border-border">
                        Sold Eggs
                      </span>
                    </div>

                    <EggQuantityInput
                      value={actualSoldEggs}
                      onChange={setActualSoldEggsOverride}
                      perCrate={perCrate}
                      disabled={closing.locked}
                    />

                    {diffSold === 0 ? (
                      <div className="p-2.5 rounded bg-success-bg border border-success/30 flex items-center gap-2 text-xs text-success">
                        <CheckCircle2 size={15} className="flex-shrink-0" />
                        <span>Matches recorded sold eggs ({recordedSold} eggs).</span>
                      </div>
                    ) : diffSold > 0 ? (
                      <div className="p-2.5 rounded bg-success-bg border border-success/30 flex items-center gap-2 text-xs text-success font-medium">
                        <CheckCircle2 size={15} className="flex-shrink-0" />
                        <span>Extra sold: +{formatEggs(diffSold, perCrate)} (+{diffSold} eggs vs recorded)</span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded bg-warn-bg border border-warn/30 flex items-center gap-2 text-xs text-warn font-medium">
                        <AlertTriangle size={15} className="flex-shrink-0" />
                        <span>Fewer sold: −{formatEggs(Math.abs(diffSold), perCrate)} ({diffSold} eggs vs recorded)</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Action Footer */}
                <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {closing.locked ? (
                    <>
                      <div className="text-xs text-muted flex items-center gap-2">
                        <Lock size={16} className="text-success flex-shrink-0" />
                        <span>
                          This day is locked with reconciled actuals. Physical stock anchors future opening stock, and cash differences flow into Money We Have.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setUnlockConfirmOpen(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-warn text-warn hover:bg-warn-bg font-semibold text-xs transition-colors whitespace-nowrap self-end sm:self-auto"
                      >
                        <Unlock size={14} />
                        Re-adjust / Unlock Day
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="text-xs text-muted">
                        Review the 4 actual values above. Locking will override this day&apos;s figures in the Daily Book and anchor future storeroom stock.
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirmOpen(true)}
                        className="btn-primary whitespace-nowrap self-end sm:self-auto"
                      >
                        <Lock size={16} />
                        Close &amp; Lock Day with Actuals
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialog 1: Confirm Lock with Actuals */}
      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => closeMutation.mutate()}
        title="Lock Day with Reconciled Actuals"
        message={
          <div className="space-y-3 text-sm text-left">
            <p className="text-muted">
              Locking <strong>{formatDate(selectedDate)}</strong> will record the following authoritative actuals:
            </p>
            <div className="p-3 bg-canvas rounded border border-border space-y-1.5 font-medium text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Physical Storeroom Closing:</span>
                <span className="font-bold text-ink">{formatEggs(countedEggs, perCrate)} ({countedEggs} eggs)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Actual Cash Gotten:</span>
                <span className="font-bold text-success">{formatMoney(actualRevenue)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Actual Expenses Made:</span>
                <span className="font-bold text-danger">{formatMoney(actualExpenses)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Actual Eggs Sold:</span>
                <span className="font-bold text-brand">{formatEggs(actualSoldEggs, perCrate)} ({actualSoldEggs} eggs)</span>
              </div>
            </div>
            <p className="text-helper-xs text-muted">
              Staff will no longer be able to record or edit entries for this date. You can unlock and re-adjust at any time if needed.
            </p>
          </div>
        }
        confirmLabel="Lock Day with Actuals"
        isLoading={closeMutation.isPending}
      />

      {/* Dialog 2: Confirm Unlock / Re-adjust */}
      <ConfirmDialog
        isOpen={unlockConfirmOpen}
        onClose={() => setUnlockConfirmOpen(false)}
        onConfirm={() => unlockMutation.mutate()}
        title="Unlock Day for Re-adjustment"
        message={
          <div className="space-y-2 text-sm text-left">
            <p>
              Are you sure you want to unlock <strong>{formatDate(selectedDate)}</strong>?
            </p>
            <p className="text-xs text-muted">
              This will re-open the day so you can modify actual figures or allow staff to adjust entries. Remember to lock again when finished.
            </p>
          </div>
        }
        confirmLabel="Unlock Day"
        isLoading={unlockMutation.isPending}
      />
    </>
  )
}
