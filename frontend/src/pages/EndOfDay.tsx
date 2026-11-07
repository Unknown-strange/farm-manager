import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Lock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Wallet,
  TrendingUp,
  Clock,
  Banknote,
  Package,
  Calendar,
  Check,
  Sliders,
  UserCheck,
  ArrowDownRight,
  ArrowUpRight,
  ListFilter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { DatePicker } from '@/components/DatePicker'
import { UnifiedCard } from '@/components/UnifiedCard'
import { useToast } from '@/components/Toast'
import { closingsApi } from '@/api/closings'
import { summaryApi, type SummaryPeriod } from '@/api/summary'
import { eventsApi } from '@/api/events'
import { expensesApi } from '@/api/expenses'
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
  const [borrowedExpenseTab, setBorrowedExpenseTab] = useState<'unpaid' | 'paid' | 'all'>('unpaid')
  const [financialTab, setFinancialTab] = useState<'daily' | 'expenses' | 'transactions'>('daily')
  const [txFilter, setTxFilter] = useState<'all' | 'sales' | 'expenses' | 'credit'>('all')
  const [isOtherExpensesOpen, setIsOtherExpensesOpen] = useState(false)
  const [isFeedExpensesOpen, setIsFeedExpensesOpen] = useState(false)
  const [isCratesExpensesOpen, setIsCratesExpensesOpen] = useState(false)
  const [isDailyEggStockOpen, setIsDailyEggStockOpen] = useState(false)

  const [expenseFilterTab, setExpenseFilterTab] = useState<'all' | 'feed' | 'crates' | 'other' | 'borrowed'>('all')

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

  const { data: closing } = useQuery({
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

  const markExpensePaidMutation = useMutation({
    mutationFn: (expenseId: number) => expensesApi.markPaid(expenseId),
    onSuccess: (updated) => {
      toast(
        `Borrowed expense (${formatMoney(Number(updated.amount ?? 0))}) marked as Paid and deducted from Money We Have!`,
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: () => toast('Failed to mark borrowed expense as paid', 'error'),
  })

  const markExpenseUnpaidMutation = useMutation({
    mutationFn: (expenseId: number) => expensesApi.markUnpaid(expenseId),
    onSuccess: () => {
      toast('Borrowed expense reverted to Unpaid (restored to Money We Have).', 'info')
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: () => toast('Failed to update borrowed expense status', 'error'),
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
  const cratesExpenses = Number(periodSummary?.crates_expenses ?? 0)
  const otherExpenses = Number(periodSummary?.other_expenses ?? 0)
  const borrowedExpensesPaid = Number(periodSummary?.borrowed_expenses_paid ?? 0)
  const borrowedExpensesUnpaid = Number(periodSummary?.borrowed_expenses_unpaid ?? 0)
  const totalExpenses = Number(periodSummary?.total_expenses ?? 0)
  const moneyLeftPresent = Number(periodSummary?.money_left_present ?? 0)
  const moneyLeftWithBorrowed = Number((moneyLeftPresent + borrowedUnpaid).toFixed(2))

  const getNormExpCat = (e: { category: string; name?: string }): 'feed' | 'crates' | 'other' => {
    if (e.category === 'feed') return 'feed'
    if (e.category === 'crates') return 'crates'
    if (e.category === 'borrowed') {
      const nl = (e.name || '').toLowerCase()
      if (nl.includes('feed')) return 'feed'
      if (nl.includes('crate')) return 'crates'
    }
    return 'other'
  }

  const allPeriodExpenses = periodSummary?.expenses ?? []
  const feedExpenseItems = allPeriodExpenses.filter((e) => getNormExpCat(e) === 'feed')
  const cratesExpenseItems = allPeriodExpenses.filter((e) => getNormExpCat(e) === 'crates')
  const otherExpenseItems = allPeriodExpenses.filter((e) => getNormExpCat(e) === 'other')

  const feedPaid = Number(periodSummary?.feed_paid ?? feedExpenseItems.filter((e) => e.paid !== false).reduce((s, e) => s + Number(e.amount), 0))
  const feedBorrowed = Number(periodSummary?.feed_borrowed ?? feedExpenseItems.filter((e) => e.paid === false).reduce((s, e) => s + Number(e.amount), 0))

  const cratesPaid = Number(periodSummary?.crates_paid ?? cratesExpenseItems.filter((e) => e.paid !== false).reduce((s, e) => s + Number(e.amount), 0))
  const cratesBorrowed = Number(periodSummary?.crates_borrowed ?? cratesExpenseItems.filter((e) => e.paid === false).reduce((s, e) => s + Number(e.amount), 0))

  const otherPaid = Number(periodSummary?.other_paid ?? otherExpenseItems.filter((e) => e.paid !== false).reduce((s, e) => s + Number(e.amount), 0))
  const otherBorrowed = Number(periodSummary?.other_borrowed ?? otherExpenseItems.filter((e) => e.paid === false).reduce((s, e) => s + Number(e.amount), 0))

  const cashSpent = Number(periodSummary?.cash_spent ?? (feedPaid + cratesPaid + otherPaid))
  const unpaidBorrowedOutside = Number(periodSummary?.unpaid_borrowed_outside_period ?? 0)
  const stockAdjustmentEggs = Number(periodSummary?.stock_adjustment_eggs ?? 0)

  const allBorrowedExpenses = periodSummary?.borrowed_expenses ?? []
  const filteredBorrowedExpenses = allBorrowedExpenses.filter((exp) => {
    if (borrowedExpenseTab === 'unpaid') return exp.paid === false
    if (borrowedExpenseTab === 'paid') return exp.paid === true
    return true
  })

  const filteredBorrowedSales = allBorrowedSales.filter((ev) => {
    if (borrowedTab === 'unpaid') return !ev.paid
    if (borrowedTab === 'paid') return !!ev.paid
    return true
  })

  const parseQty = (q?: string | null) => {
    if (!q) return 0
    const m = q.match(/(\d+(\.\d+)?)/)
    return m ? parseFloat(m[1]) : 0
  }

  const feedBagsTotal = feedExpenseItems.reduce((acc, it) => acc + parseQty(it.quantity), 0)
  const cratesUnitsTotal = cratesExpenseItems.reduce((acc, it) => acc + parseQty(it.quantity), 0)

  const displayedExpenses = allPeriodExpenses.filter((exp) => {
    if (expenseFilterTab === 'feed') return getNormExpCat(exp) === 'feed'
    if (expenseFilterTab === 'crates') return getNormExpCat(exp) === 'crates'
    if (expenseFilterTab === 'other') return getNormExpCat(exp) === 'other'
    if (expenseFilterTab === 'borrowed') return exp.category === 'borrowed' || exp.is_borrowed || exp.paid === false
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
              onChange={(d) => setSearchParams({ date: d })}
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
                <UnifiedCard
                  variant="success"
                  icon={<Wallet size={20} />}
                  label={`Total Amount of Money Left (Present) · ${period.toUpperCase()}`}
                  value={formatMoney(moneyLeftPresent)}
                  helper={
                    <div className="flex items-center justify-between">
                      <span>Cash on hand at end of {formatDate(periodSummary.end_date)}</span>
                      <span className="font-semibold text-success">Cash on Hand</span>
                    </div>
                  }
                />

                {/* Card B: Total Money To Be Had (If Borrowed is Paid) */}
                <UnifiedCard
                  variant="brand"
                  icon={<TrendingUp size={20} />}
                  label="Money Left If Borrowed Is Paid"
                  value={formatMoney(moneyLeftWithBorrowed)}
                  helper={
                    <div className="flex items-center justify-between">
                      <span>
                        {borrowedUnpaid > 0
                          ? `Present (${formatMoney(moneyLeftPresent)}) + Borrowed (${formatMoney(borrowedUnpaid)})`
                          : 'No unpaid credit in this period'}
                      </span>
                      <span className="font-semibold text-brand">Projected Total</span>
                    </div>
                  }
                />

                {/* Card C: Borrowed / Unpaid Balance Owed */}
                <UnifiedCard
                  variant="warn"
                  icon={<Clock size={20} />}
                  label={`Borrowed Unpaid (${period.toUpperCase()})`}
                  value={formatMoney(borrowedUnpaid)}
                  helper={
                    <div className="flex items-center justify-between">
                      <span>
                        {allBorrowedSales.filter((e) => !e.paid).length} unpaid credit sale(s)
                        {unpaidBorrowedOutside > 0 && (
                          <span className="block text-[11px] text-warn font-medium mt-0.5">
                            + {formatMoney(unpaidBorrowedOutside)} owed from earlier
                          </span>
                        )}
                      </span>
                      <span className="font-semibold text-warn">Credit Pending</span>
                    </div>
                  }
                />
              </div>

              {/* ==================== 2B. EXPENSE SUMMARY (BY CATEGORY & PERIOD) ==================== */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-title-section text-ink flex items-center gap-2">
                      <Wallet size={18} className="text-danger" />
                      Expense Summary · {period.toUpperCase()}
                    </h2>
                    <p className="text-xs text-muted">
                      Number of feed, crates, and other items bought during this {period === 'day' ? 'day' : period === 'week' ? 'week' : period === 'month' ? 'month' : 'selected period'} with total amounts.
                    </p>
                  </div>
                </div>

                {/* 4 Unified Cards for Expense Categories */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Feed Category */}
                  <UnifiedCard
                    variant="brand"
                    icon={<Package size={18} />}
                    label={`Feed Expenses (${period.toUpperCase()})`}
                    value={`− ${formatMoney(feedExpenses)}`}
                    helper={
                      <span>
                        <strong className="text-ink font-semibold">
                          {feedBagsTotal > 0 ? `${feedBagsTotal} bag${feedBagsTotal !== 1 ? 's' : ''}` : '0 bags'}
                        </strong>{' '}
                        · Paid: {formatMoney(feedPaid)} · Borrowed: {formatMoney(feedBorrowed)}
                      </span>
                    }
                  />

                  {/* Crates Category */}
                  <UnifiedCard
                    variant="intake"
                    icon={<Package size={18} />}
                    label={`Crates Expenses (${period.toUpperCase()})`}
                    value={`− ${formatMoney(cratesExpenses)}`}
                    helper={
                      <span>
                        <strong className="text-ink font-semibold">
                          {cratesUnitsTotal > 0 ? `${cratesUnitsTotal} crate${cratesUnitsTotal !== 1 ? 's' : ''}` : '0 crates'}
                        </strong>{' '}
                        · Paid: {formatMoney(cratesPaid)} · Borrowed: {formatMoney(cratesBorrowed)}
                      </span>
                    }
                  />

                  {/* Others Category */}
                  <UnifiedCard
                    variant="neutral"
                    icon={<Wallet size={18} />}
                    label={`Other Expenses (${period.toUpperCase()})`}
                    value={`− ${formatMoney(otherExpenses)}`}
                    helper={
                      <span>
                        <strong className="text-ink font-semibold">
                          {otherExpenseItems.length} item{otherExpenseItems.length !== 1 ? 's' : ''}
                        </strong>{' '}
                        · Paid: {formatMoney(otherPaid)} · Borrowed: {formatMoney(otherBorrowed)}
                      </span>
                    }
                  />

                  {/* Total Period Expenses */}
                  <UnifiedCard
                    variant="danger"
                    icon={<Banknote size={18} />}
                    label={`Total Spent (${period.toUpperCase()})`}
                    value={`− ${formatMoney(totalExpenses)}`}
                    helper={
                      <span>
                        Total Incurred: {formatMoney(totalExpenses)} · Cash Deducted: {formatMoney(cashSpent)}
                      </span>
                    }
                  />
                </div>

                {/* Itemized Category Breakdown & Entries Table */}
                <div className="card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border bg-canvas/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink flex items-center gap-1.5">
                      <ListFilter size={15} className="text-brand" />
                      {period.toUpperCase()} Expense Entries Breakdown
                    </span>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {(
                        [
                          { key: 'all', label: `All (${allPeriodExpenses.length})` },
                          { key: 'feed', label: `Feed (${feedExpenseItems.length})` },
                          { key: 'crates', label: `Crates (${cratesExpenseItems.length})` },
                          { key: 'other', label: `Other (${otherExpenseItems.length})` },
                          { key: 'borrowed', label: `Borrowed (${allPeriodExpenses.filter((e) => e.paid === false).length})` },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setExpenseFilterTab(tab.key)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                            expenseFilterTab === tab.key
                              ? 'bg-brand text-white shadow-sm'
                              : 'bg-card text-muted hover:text-ink border border-border'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {displayedExpenses.length === 0 ? (
                    <div className="py-8 text-center text-muted text-sm">
                      No {expenseFilterTab === 'all' ? '' : expenseFilterTab} expenses recorded for this {period}.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-canvas border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                            <th className="py-3 px-6">Date</th>
                            <th className="py-3 px-6">Category</th>
                            <th className="py-3 px-6">Name / Details</th>
                            <th className="py-3 px-6">Quantity</th>
                            <th className="py-3 px-6">Logged By</th>
                            <th className="py-3 px-6 text-right">Amount (GH₵)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border text-sm">
                          {displayedExpenses.map((exp) => (
                            <tr key={exp.id} className="hover:bg-canvas/50 transition-colors">
                              <td className="py-3 px-6 whitespace-nowrap text-muted tabular-nums">
                                {formatDate(exp.business_date)}
                              </td>
                              <td className="py-3 px-6 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                      getNormExpCat(exp) === 'feed'
                                        ? 'bg-brand/10 text-brand border border-brand/20'
                                        : getNormExpCat(exp) === 'crates'
                                          ? 'bg-intake-bg text-intake border border-intake/30'
                                          : 'bg-canvas text-ink border border-border'
                                    }`}
                                  >
                                    {getNormExpCat(exp) === 'feed'
                                      ? 'Feed'
                                      : getNormExpCat(exp) === 'crates'
                                        ? 'Crates'
                                        : 'Other'}
                                  </span>
                                  {exp.paid === false ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warn-bg text-warn border border-warn/30">
                                      Borrowed (Unpaid)
                                    </span>
                                  ) : (exp.is_borrowed || exp.category === 'borrowed') ? (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success-bg text-success border border-success/30">
                                      Paid Borrowed
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                              <td className="py-3 px-6 font-semibold text-ink">
                                {exp.name}
                              </td>
                              <td className="py-3 px-6 text-ink font-medium">
                                {exp.quantity || '—'}
                              </td>
                              <td className="py-3 px-6 whitespace-nowrap text-xs text-muted">
                                <span className="inline-flex items-center gap-1">
                                  <UserCheck size={12} className="text-brand" />
                                  {exp.created_by_name}
                                </span>
                              </td>
                              <td className="py-3 px-6 text-right font-bold text-danger tabular-nums whitespace-nowrap">
                                − {formatMoney(Number(exp.amount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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

                    {/* Feed Expenses (Collapsible Dropdown) */}
                    <div className="py-2.5">
                      <button
                        type="button"
                        onClick={() => setIsFeedExpensesOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between text-left py-1.5 px-2 -mx-2 rounded-lg hover:bg-canvas transition-colors group cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/40"
                        aria-expanded={isFeedExpensesOpen}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink group-hover:text-brand transition-colors">
                            Feed Expenses
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20">
                            {feedExpenseItems.length} {feedExpenseItems.length === 1 ? 'item' : 'items'}
                            {isFeedExpensesOpen ? (
                              <ChevronUp size={13} className="text-brand" />
                            ) : (
                              <ChevronDown size={13} className="text-brand" />
                            )}
                          </span>
                        </div>
                        <span className="font-semibold text-danger tabular-nums">
                          − {formatMoney(feedExpenses)}
                        </span>
                      </button>

                      {isFeedExpensesOpen && (
                        <div className="mt-2.5 p-3 rounded-lg bg-canvas border border-border/80 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted border-b border-border/60 pb-1.5">
                            <span>Feed Item</span>
                            <span>Amount</span>
                          </div>
                          {feedExpenseItems.length === 0 ? (
                            <p className="text-xs text-muted italic py-1 text-center">
                              No feed expenses recorded for this period.
                            </p>
                          ) : (
                            <div className="divide-y divide-border/50 text-xs">
                              {feedExpenseItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="py-2 first:pt-0.5 last:pb-0.5 flex items-start justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-ink capitalize text-sm">
                                        {item.name}
                                      </span>
                                      {item.quantity && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-card border border-border text-muted">
                                          Qty: {item.quantity}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                                      <span>{formatDate(item.business_date)}</span>
                                      <span>•</span>
                                      <span>Logged by {item.created_by_name}</span>
                                    </div>
                                  </div>
                                  <div className="font-bold text-danger tabular-nums whitespace-nowrap pt-0.5 text-sm">
                                    − {formatMoney(Number(item.amount))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Crates Expenses (Collapsible Dropdown) */}
                    <div className="py-2.5">
                      <button
                        type="button"
                        onClick={() => setIsCratesExpensesOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between text-left py-1.5 px-2 -mx-2 rounded-lg hover:bg-canvas transition-colors group cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/40"
                        aria-expanded={isCratesExpensesOpen}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink group-hover:text-brand transition-colors">
                            Crates Expenses
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20">
                            {cratesExpenseItems.length} {cratesExpenseItems.length === 1 ? 'item' : 'items'}
                            {isCratesExpensesOpen ? (
                              <ChevronUp size={13} className="text-brand" />
                            ) : (
                              <ChevronDown size={13} className="text-brand" />
                            )}
                          </span>
                        </div>
                        <span className="font-semibold text-danger tabular-nums">
                          − {formatMoney(cratesExpenses)}
                        </span>
                      </button>

                      {isCratesExpensesOpen && (
                        <div className="mt-2.5 p-3 rounded-lg bg-canvas border border-border/80 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted border-b border-border/60 pb-1.5">
                            <span>Crates Item</span>
                            <span>Amount</span>
                          </div>
                          {cratesExpenseItems.length === 0 ? (
                            <p className="text-xs text-muted italic py-1 text-center">
                              No crates expenses recorded for this period.
                            </p>
                          ) : (
                            <div className="divide-y divide-border/50 text-xs">
                              {cratesExpenseItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="py-2 first:pt-0.5 last:pb-0.5 flex items-start justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-ink capitalize text-sm">
                                        {item.name}
                                      </span>
                                      {item.quantity && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-card border border-border text-muted">
                                          Qty: {item.quantity}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                                      <span>{formatDate(item.business_date)}</span>
                                      <span>•</span>
                                      <span>Logged by {item.created_by_name}</span>
                                    </div>
                                  </div>
                                  <div className="font-bold text-danger tabular-nums whitespace-nowrap pt-0.5 text-sm">
                                    − {formatMoney(Number(item.amount))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Other Expenses (Collapsible Dropdown showing names like Food) */}
                    <div className="py-2.5">
                      <button
                        type="button"
                        onClick={() => setIsOtherExpensesOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between text-left py-1.5 px-2 -mx-2 rounded-lg hover:bg-canvas transition-colors group cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand/40"
                        aria-expanded={isOtherExpensesOpen}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink group-hover:text-brand transition-colors">
                            Other Expenses
                          </span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-danger-bg text-danger border border-danger-border">
                            {otherExpenseItems.length} {otherExpenseItems.length === 1 ? 'item' : 'items'}
                            {isOtherExpensesOpen ? (
                              <ChevronUp size={13} className="text-danger" />
                            ) : (
                              <ChevronDown size={13} className="text-danger" />
                            )}
                          </span>
                        </div>
                        <span className="font-semibold text-danger tabular-nums">
                          − {formatMoney(otherExpenses)}
                        </span>
                      </button>

                      {isOtherExpensesOpen && (
                        <div className="mt-2.5 p-3 rounded-lg bg-canvas border border-border/80 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted border-b border-border/60 pb-1.5">
                            <span>Other Expense Name</span>
                            <span>Amount</span>
                          </div>
                          {otherExpenseItems.length === 0 ? (
                            <p className="text-xs text-muted italic py-1 text-center">
                              No other expenses recorded for this period.
                            </p>
                          ) : (
                            <div className="divide-y divide-border/50 text-xs">
                              {otherExpenseItems.map((item) => (
                                <div
                                  key={item.id}
                                  className="py-2 first:pt-0.5 last:pb-0.5 flex items-start justify-between gap-3"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-ink capitalize text-sm">
                                        {item.name}
                                      </span>
                                      {item.quantity && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-card border border-border text-muted">
                                          Qty: {item.quantity}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-muted flex items-center gap-2 mt-0.5">
                                      <span>{formatDate(item.business_date)}</span>
                                      <span>•</span>
                                      <span>Logged by {item.created_by_name}</span>
                                    </div>
                                  </div>
                                  <div className="font-bold text-danger tabular-nums whitespace-nowrap pt-0.5 text-sm">
                                    − {formatMoney(Number(item.amount))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {borrowedExpensesPaid > 0 && (
                      <div className="py-3 flex items-center justify-between">
                        <span className="font-medium text-ink">Borrowed Expenses (Paid &amp; Deducted)</span>
                        <span className="font-semibold text-danger tabular-nums">
                          − {formatMoney(borrowedExpensesPaid)}
                        </span>
                      </div>
                    )}

                    <div className="py-3 flex items-center justify-between">
                      <span className="font-semibold text-ink">Total Expenses (Paid)</span>
                      <span className="font-bold text-danger tabular-nums">
                        − {formatMoney(totalExpenses)}
                      </span>
                    </div>

                    {borrowedExpensesUnpaid > 0 && (
                      <div className="py-3 flex items-center justify-between bg-warn-bg/30 px-3 -mx-3 rounded-lg border border-warn/30">
                        <div>
                          <span className="font-semibold text-warn block">
                            Borrowed Expenses (Unpaid — Not Deducted)
                          </span>
                          <span className="text-xs text-muted">
                            Sits here until marked as Paid below
                          </span>
                        </div>
                        <span className="font-bold text-warn tabular-nums">
                          {formatMoney(borrowedExpensesUnpaid)}
                        </span>
                      </div>
                    )}

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
                <div className="lg:col-span-5 card overflow-hidden flex flex-col justify-between">
                  <div>
                    <div className="px-6 py-4 border-b border-border bg-canvas/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package size={18} className="text-brand" />
                        <h2 className="text-title-section text-ink">Egg Stock Summary ({period.toUpperCase()})</h2>
                      </div>
                      <span className="text-xs text-muted font-mono">{perCrate} eggs/crate</span>
                    </div>

                    <div className="p-6 divide-y divide-border text-sm">
                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <span className="font-medium text-ink">Opening Stock</span>
                          <p className="text-xs text-muted">Stock at start of {formatDate(periodSummary.start_date)}</p>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="font-semibold text-ink block">
                            {formatEggs(periodSummary.opening_eggs, perCrate)}
                          </span>
                          <span className="text-xs text-muted">{periodSummary.opening_eggs} eggs</span>
                        </div>
                      </div>

                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <span className="text-muted">+ Total Eggs Added (Received)</span>
                          <p className="text-xs text-muted">Whole {period} intake</p>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="font-semibold text-intake block">
                            +{formatEggs(periodSummary.gotten_eggs, perCrate)}
                          </span>
                          <span className="text-xs text-muted">{periodSummary.gotten_eggs} eggs</span>
                        </div>
                      </div>

                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <span className="text-muted">− Total Eggs Sold (Paid &amp; Borrowed)</span>
                          <p className="text-xs text-muted">Whole {period} sales</p>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="font-semibold text-success block">
                            −{formatEggs(periodSummary.sold_eggs, perCrate)}
                          </span>
                          <span className="text-xs text-muted">{periodSummary.sold_eggs} eggs</span>
                        </div>
                      </div>

                      <div className="py-3 flex items-center justify-between">
                        <div>
                          <span className="text-muted">Cracked Eggs (Recorded)</span>
                          <p className="text-xs text-muted">Whole {period} cracked/broken (tracked only)</p>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="font-semibold text-danger block">
                            {formatEggs(periodSummary.cracked_eggs, perCrate)}
                          </span>
                          <span className="text-xs text-muted">{periodSummary.cracked_eggs} eggs</span>
                        </div>
                      </div>

                      {stockAdjustmentEggs !== 0 && (
                        <div className="py-3 flex items-center justify-between bg-canvas/60 px-3 -mx-3 rounded-lg border border-border/60">
                          <div>
                            <span className="font-medium text-warn flex items-center gap-1.5">
                              <AlertTriangle size={14} />
                              Physical Count Adjustment
                            </span>
                            <p className="text-xs text-muted">Correction from locked day physical counts</p>
                          </div>
                          <div className="text-right tabular-nums">
                            <span className={`font-semibold block ${stockAdjustmentEggs > 0 ? 'text-intake' : 'text-danger'}`}>
                              {stockAdjustmentEggs > 0 ? '+' : ''}{formatEggs(stockAdjustmentEggs, perCrate)}
                            </span>
                            <span className="text-xs text-muted">
                              {stockAdjustmentEggs > 0 ? '+' : ''}{stockAdjustmentEggs} eggs
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="pt-4 flex items-center justify-between">
                        <div>
                          <span className="text-base font-bold text-ink">Total Remaining (Closing Stock)</span>
                          <p className="text-xs text-muted">At end of {formatDate(periodSummary.end_date)}</p>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="text-display-stat-sm font-extrabold text-brand block">
                            {formatEggs(periodSummary.closing_eggs, perCrate)}
                          </span>
                          <span className="text-xs text-muted">
                            = {periodSummary.closing_eggs} total eggs
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Day-by-Day Egg Stock Collapsible Dropdown */}
                  {periodSummary.daily_egg_stock && periodSummary.daily_egg_stock.length > 0 && (
                    <div className="p-4 border-t border-border bg-canvas/30">
                      <button
                        type="button"
                        onClick={() => setIsDailyEggStockOpen((prev) => !prev)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-card border border-border hover:bg-canvas transition-colors group cursor-pointer"
                        aria-expanded={isDailyEggStockOpen}
                      >
                        <div className="flex items-center gap-2">
                          <Calendar size={15} className="text-brand" />
                          <span className="text-xs font-semibold text-ink group-hover:text-brand transition-colors">
                            Day-by-Day Egg Stock ({periodSummary.daily_egg_stock.length} days)
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20">
                          {isDailyEggStockOpen ? 'Hide daily table' : 'View daily table'}
                          {isDailyEggStockOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </span>
                      </button>

                      {isDailyEggStockOpen && (
                        <div className="mt-3 overflow-x-auto rounded-lg border border-border bg-card animate-in fade-in duration-150">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-canvas border-b border-border font-semibold uppercase tracking-wider text-muted">
                                <th className="py-2.5 px-3">Day</th>
                                <th className="py-2.5 px-3 text-right">Opening</th>
                                <th className="py-2.5 px-3 text-right text-intake">+ Added</th>
                                <th className="py-2.5 px-3 text-right text-success">− Sold</th>
                                <th className="py-2.5 px-3 text-right text-danger">Cracked</th>
                                <th className="py-2.5 px-3 text-right font-bold text-ink">Remaining</th>
                                <th className="py-2.5 px-2 text-center">Lock</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {periodSummary.daily_egg_stock.map((row) => (
                                <tr key={row.date} className="hover:bg-canvas/40 transition-colors">
                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <span className="font-semibold text-ink block">{row.day_name}</span>
                                    <span className="text-[10px] text-muted">{formatDate(row.date)}</span>
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-muted whitespace-nowrap">
                                    {formatEggs(row.opening_eggs, perCrate)}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-intake whitespace-nowrap font-medium">
                                    {row.received_eggs > 0 ? `+${formatEggs(row.received_eggs, perCrate)}` : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-success whitespace-nowrap font-medium">
                                    {row.sold_eggs > 0 ? `−${formatEggs(row.sold_eggs, perCrate)}` : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums text-danger whitespace-nowrap font-medium">
                                    {row.cracked_eggs > 0 ? formatEggs(row.cracked_eggs, perCrate) : '—'}
                                  </td>
                                  <td className="py-2.5 px-3 text-right tabular-nums font-bold text-ink whitespace-nowrap bg-canvas/30">
                                    {formatEggs(row.closing_eggs, perCrate)}
                                    {row.adjustment_eggs !== 0 && (
                                      <span className="block text-[10px] font-normal text-warn">
                                        ({row.adjustment_eggs > 0 ? '+' : ''}{row.adjustment_eggs} count adj)
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-2 text-center whitespace-nowrap">
                                    {row.locked ? (
                                      <span className="inline-flex p-1 rounded bg-brand/10 text-brand" title="Day locked">
                                        <Lock size={12} />
                                      </span>
                                    ) : (
                                      <span className="text-muted/40">—</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-canvas/80 font-bold border-t-2 border-border text-xs">
                                <td className="py-2.5 px-3 text-ink">TOTAL ({period.toUpperCase()})</td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-muted">
                                  {formatEggs(periodSummary.opening_eggs, perCrate)}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-intake">
                                  +{formatEggs(periodSummary.gotten_eggs, perCrate)}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-success">
                                  −{formatEggs(periodSummary.sold_eggs, perCrate)}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-danger">
                                  {formatEggs(periodSummary.cracked_eggs, perCrate)}
                                </td>
                                <td className="py-2.5 px-3 text-right tabular-nums text-brand font-extrabold bg-canvas/60">
                                  {formatEggs(periodSummary.closing_eggs, perCrate)}
                                </td>
                                <td className="py-2.5 px-2"></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* ==================== 3B. COMPLETE WEEK FINANCIAL BREAKDOWN & ACTIVITY LEDGER ==================== */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-canvas/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-title-section text-ink flex items-center gap-2">
                      <Banknote size={18} className="text-success" />
                      Weekly Financial Activity &amp; Daily Breakdown
                    </h2>
                    <p className="text-xs text-muted">
                      Full breakdown of daily money, named expenses, and all financial entries recorded by Admin &amp; Staff for {period === 'week' ? 'this week' : `the selected ${period}`}.
                    </p>
                  </div>

                  {/* Sub-tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-card rounded-lg border border-border">
                    <button
                      type="button"
                      onClick={() => setFinancialTab('daily')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        financialTab === 'daily'
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      📅 Daily Money on Hand
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancialTab('expenses')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        financialTab === 'expenses'
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      🧾 Named Expenses ({periodSummary.expenses?.length ?? 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFinancialTab('transactions')}
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                        financialTab === 'transactions'
                          ? 'bg-brand text-white shadow-sm'
                          : 'text-muted hover:text-ink'
                      }`}
                    >
                      📑 All Financial Activity ({periodSummary.financial_transactions?.length ?? 0})
                    </button>
                  </div>
                </div>

                {/* TAB 1: DAILY FINANCIAL BREAKDOWN (MON-SUN) */}
                {financialTab === 'daily' && (
                  <div>
                    {!periodSummary.daily_financials || periodSummary.daily_financials.length === 0 ? (
                      <div className="py-10 text-center text-muted text-sm">
                        No financial records found for this period.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-canvas border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                              <th className="py-3 px-4">Day &amp; Date</th>
                              <th className="py-3 px-4 text-right">Money We Had (Opening)</th>
                              <th className="py-3 px-4 text-right">Cash Gained (Sales)</th>
                              <th className="py-3 px-4 text-right">Credit (Borrowed)</th>
                              <th className="py-3 px-4 text-right">Feed Expenses</th>
                              <th className="py-3 px-4 text-right">Other Expenses</th>
                              <th className="py-3 px-4 text-right">Day Net Flow</th>
                              <th className="py-3 px-4 text-right font-bold text-ink">Money Left (Closing)</th>
                              <th className="py-3 px-4">Logged By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-sm">
                            {periodSummary.daily_financials.map((d) => (
                              <tr key={d.date} className="hover:bg-canvas/60 transition-colors">
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  <span className="font-semibold text-ink block">{d.day_name}</span>
                                  <span className="text-xs text-muted">{formatDate(d.date)}</span>
                                </td>
                                <td className="py-3.5 px-4 text-right tabular-nums text-muted font-medium whitespace-nowrap">
                                  {formatMoney(Number(d.opening_money))}
                                </td>
                                <td className="py-3.5 px-4 text-right tabular-nums text-success font-semibold whitespace-nowrap">
                                  {Number(d.cash_revenue) > 0 ? `+ ${formatMoney(Number(d.cash_revenue))}` : '—'}
                                </td>
                                <td className="py-3.5 px-4 text-right tabular-nums text-warn whitespace-nowrap">
                                  {Number(d.borrowed_amount) > 0 ? formatMoney(Number(d.borrowed_amount)) : '—'}
                                </td>
                                <td className="py-3.5 px-4 text-right tabular-nums text-danger whitespace-nowrap">
                                  {Number(d.feed_expenses) > 0 ? (
                                    <div>
                                      <span>− {formatMoney(Number(d.feed_expenses))}</span>
                                      {(() => {
                                        const dayFeed = (periodSummary.expenses ?? []).filter(
                                          (e) => e.category === 'feed' && String(e.business_date) === String(d.date),
                                        )
                                        if (dayFeed.length === 0) return null
                                        return (
                                          <span className="text-[11px] text-muted block font-normal capitalize">
                                            {dayFeed.map((e) => e.name).join(', ')}
                                          </span>
                                        )
                                      })()}
                                    </div>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right tabular-nums text-danger whitespace-nowrap">
                                  {Number(d.other_expenses) > 0 ? (
                                    <div>
                                      <span>− {formatMoney(Number(d.other_expenses))}</span>
                                      {(() => {
                                        const dayOther = (periodSummary.expenses ?? []).filter(
                                          (e) => e.category === 'other' && String(e.business_date) === String(d.date),
                                        )
                                        if (dayOther.length === 0) return null
                                        return (
                                          <span className="text-[11px] text-muted block font-normal capitalize">
                                            {dayOther.map((e) => e.name).join(', ')}
                                          </span>
                                        )
                                      })()}
                                    </div>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="py-3.5 px-4 text-right tabular-nums font-semibold whitespace-nowrap">
                                  <span className={Number(d.net_cash_flow) >= 0 ? 'text-success' : 'text-danger'}>
                                    {Number(d.net_cash_flow) >= 0 ? '+' : ''}
                                    {formatMoney(Number(d.net_cash_flow))}
                                  </span>
                                </td>
                                <td className="py-3.5 px-4 text-right tabular-nums font-bold text-ink whitespace-nowrap bg-canvas/30">
                                  {formatMoney(Number(d.closing_money))}
                                </td>
                                <td className="py-3.5 px-4 whitespace-nowrap">
                                  {d.logged_by && d.logged_by.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                      {d.logged_by.map((user) => (
                                        <span
                                          key={user}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-canvas border border-border text-ink"
                                        >
                                          <UserCheck size={11} className="text-brand" />
                                          {user}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted">No entries</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-canvas/80 font-bold border-t-2 border-border text-sm">
                              <td className="py-3 px-4 text-ink">TOTAL ({period.toUpperCase()})</td>
                              <td className="py-3 px-4 text-right tabular-nums text-muted">
                                {formatMoney(Number(periodSummary.daily_financials[0]?.opening_money ?? 0))}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-success">
                                + {formatMoney(cashRevenue)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-warn">
                                {formatMoney(borrowedUnpaid)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-danger">
                                − {formatMoney(feedExpenses)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-danger">
                                − {formatMoney(otherExpenses)}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums">
                                <span className={cashRevenue - totalExpenses >= 0 ? 'text-success' : 'text-danger'}>
                                  {cashRevenue - totalExpenses >= 0 ? '+' : ''}
                                  {formatMoney(cashRevenue - totalExpenses)}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums text-brand font-extrabold text-base bg-canvas">
                                {formatMoney(moneyLeftPresent)}
                              </td>
                              <td className="py-3 px-4 text-xs text-muted">
                                Total Present Cash
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: ITEMIZED NAMED EXPENSES */}
                {financialTab === 'expenses' && (
                  <div>
                    {!periodSummary.expenses || periodSummary.expenses.length === 0 ? (
                      <div className="py-10 text-center text-muted text-sm">
                        No expenses recorded for this period.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-canvas border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                              <th className="py-3 px-6">Date</th>
                              <th className="py-3 px-6">Category</th>
                              <th className="py-3 px-6">Expense Name</th>
                              <th className="py-3 px-6">Quantity / Details</th>
                              <th className="py-3 px-6">Entered By (Admin / Staff)</th>
                              <th className="py-3 px-6 text-right">Amount (GH₵)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border text-sm">
                            {periodSummary.expenses.map((exp) => (
                              <tr key={exp.id} className="hover:bg-canvas/60 transition-colors">
                                <td className="py-3.5 px-6 whitespace-nowrap text-muted tabular-nums">
                                  <span className="font-medium text-ink">{formatDate(exp.business_date)}</span>
                                </td>
                                <td className="py-3.5 px-6 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                      exp.category === 'feed'
                                        ? 'bg-brand/10 text-brand border border-brand/20'
                                        : 'bg-warn-bg text-warn border border-warn/30'
                                    }`}
                                  >
                                    {exp.category === 'feed' ? 'Feed' : 'Other Expense'}
                                  </span>
                                </td>
                                <td className="py-3.5 px-6 font-semibold text-ink">
                                  {exp.name}
                                </td>
                                <td className="py-3.5 px-6 text-muted">
                                  {exp.quantity || '—'}
                                </td>
                                <td className="py-3.5 px-6 whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium bg-canvas border border-border text-ink">
                                    <UserCheck size={12} className="text-brand" />
                                    {exp.created_by_name}
                                  </span>
                                </td>
                                <td className="py-3.5 px-6 text-right font-bold text-danger tabular-nums whitespace-nowrap">
                                  − {formatMoney(Number(exp.amount))}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: ALL FINANCIAL ACTIVITY (EVERYTHING ENTERED BY ADMIN OR STAFF) */}
                {financialTab === 'transactions' && (
                  <div>
                    {/* Filter bar */}
                    <div className="px-6 py-3 bg-canvas/30 border-b border-border flex items-center justify-between gap-3">
                      <span className="text-xs text-muted font-medium flex items-center gap-1.5">
                        <ListFilter size={14} /> Filter Activity:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {(
                          [
                            { label: 'All Entries', value: 'all' },
                            { label: 'Sales Only', value: 'sales' },
                            { label: 'Expenses Only', value: 'expenses' },
                            { label: 'Credit (Borrowed)', value: 'credit' },
                          ] as const
                        ).map((tab) => (
                          <button
                            key={tab.value}
                            type="button"
                            onClick={() => setTxFilter(tab.value)}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                              txFilter === tab.value
                                ? 'bg-brand text-white font-semibold'
                                : 'bg-card text-muted hover:text-ink border border-border'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const list = (periodSummary.financial_transactions ?? []).filter((tx) => {
                        if (txFilter === 'sales') return tx.kind.startsWith('sale_')
                        if (txFilter === 'expenses') return tx.kind.startsWith('expense_')
                        if (txFilter === 'credit') return tx.kind === 'sale_borrowed'
                        return true
                      })

                      if (list.length === 0) {
                        return (
                          <div className="py-10 text-center text-muted text-sm">
                            No financial activity found for this filter.
                          </div>
                        )
                      }

                      return (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-canvas border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                                <th className="py-3 px-6">Date &amp; Time</th>
                                <th className="py-3 px-6">Entry Type</th>
                                <th className="py-3 px-6">Details / Name / Customer</th>
                                <th className="py-3 px-6">Quantity</th>
                                <th className="py-3 px-6">Entered By (Admin / Staff)</th>
                                <th className="py-3 px-6 text-right">Amount (GH₵)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border text-sm">
                              {list.map((tx) => (
                                <tr key={tx.id} className="hover:bg-canvas/60 transition-colors">
                                  <td className="py-3.5 px-6 whitespace-nowrap text-muted tabular-nums">
                                    <span className="font-medium text-ink">{formatDate(tx.business_date)}</span>{' '}
                                    <span className="text-xs">· {formatTime(tx.occurred_at)}</span>
                                  </td>
                                  <td className="py-3.5 px-6 whitespace-nowrap">
                                    {tx.kind === 'sale_cash' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success border border-success-border">
                                        <ArrowDownRight size={13} /> Paid Sale
                                      </span>
                                    )}
                                    {tx.kind === 'sale_borrowed' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warn-bg text-warn border border-warn/40">
                                        <Clock size={13} /> Credit (Borrowed)
                                      </span>
                                    )}
                                    {tx.kind === 'expense_feed' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand/10 text-brand border border-brand/20">
                                        <ArrowUpRight size={13} /> Feed Expense
                                      </span>
                                    )}
                                    {tx.kind === 'expense_crates' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-intake-bg text-intake border border-intake/30">
                                        <ArrowUpRight size={13} /> Crates Expense
                                      </span>
                                    )}
                                    {tx.kind === 'expense_other' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-danger-bg text-danger border border-danger-border">
                                        <ArrowUpRight size={13} /> Other Expense
                                      </span>
                                    )}
                                    {tx.kind === 'expense_borrowed' && (
                                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warn-bg text-warn border border-warn/40">
                                        <Clock size={13} /> Borrowed Expense
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-6 font-semibold text-ink">
                                    {tx.title}
                                    {tx.description && tx.description !== tx.title && (
                                      <span className="block text-xs font-normal text-muted mt-0.5">
                                        {tx.description}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-6 text-ink whitespace-nowrap tabular-nums">
                                    {tx.eggs != null ? formatEggs(tx.eggs, perCrate) : (tx.description || '—')}
                                  </td>
                                  <td className="py-3.5 px-6 whitespace-nowrap">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-canvas border border-border text-ink">
                                      <UserCheck size={12} className="text-brand" />
                                      {tx.user_name}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-6 text-right font-bold tabular-nums whitespace-nowrap">
                                    {tx.kind === 'sale_cash' && (
                                      <span className="text-success">+ {formatMoney(Number(tx.amount))}</span>
                                    )}
                                    {tx.kind === 'sale_borrowed' && (
                                      <span className="text-warn">{formatMoney(Number(tx.amount))} (Pending)</span>
                                    )}
                                    {tx.kind.startsWith('expense_') && tx.paid && (
                                      <span className="text-danger">− {formatMoney(Number(tx.amount))}</span>
                                    )}
                                    {tx.kind.startsWith('expense_') && !tx.paid && (
                                      <span className="text-warn">{formatMoney(Number(tx.amount))} (Unpaid)</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>

              {/* ==================== 4. ADMIN SECTION: BORROWED / UNPAID SALES MANAGEMENT ==================== */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-warn-bg/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-title-section text-ink flex items-center gap-2">
                      <Clock size={18} className="text-warn" />
                      Borrowed Sales Management (Admin Only) · {period.toUpperCase()}
                    </h2>
                    <p className="text-xs text-muted">
                      Credit sales recorded during {period === 'week' ? 'this week' : `the selected ${period}`}. Mark them as Paid once settled.
                    </p>
                    {unpaidBorrowedOutside > 0 && (
                      <div className="mt-2 text-xs text-warn bg-warn-bg/70 px-3 py-1.5 rounded-md border border-warn/30 inline-flex items-center gap-1.5 font-medium">
                        <AlertTriangle size={14} className="flex-shrink-0" />
                        <span>
                          Notice: There is an additional <strong>{formatMoney(unpaidBorrowedOutside)}</strong> in unpaid credit from earlier periods. Switch view period to <em>"All Time"</em> to view and settle all debts.
                        </span>
                      </div>
                    )}
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

              {/* ==================== 4B. ADMIN SECTION: BORROWED EXPENSES MANAGEMENT ==================== */}
              <div className="card overflow-hidden">
                <div className="px-6 py-4 border-b border-border bg-warn-bg/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-title-section text-ink flex items-center gap-2">
                      <Clock size={18} className="text-warn" />
                      Borrowed Expenses Management (Admin Only) · {period.toUpperCase()}
                    </h2>
                    <p className="text-xs text-muted">
                      Borrowed expenses sit here and are <strong>not subtracted</strong> from Money We Have until you click <strong>Mark as Paid</strong>.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {(
                      [
                        { label: 'Unpaid (Not Deducted)', value: 'unpaid' },
                        { label: 'Paid (Deducted)', value: 'paid' },
                        { label: 'All Borrowed Expenses', value: 'all' },
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.value}
                        type="button"
                        onClick={() => setBorrowedExpenseTab(tab.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                          borrowedExpenseTab === tab.value
                            ? 'bg-brand text-white'
                            : 'bg-card text-muted hover:text-ink border border-border'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {filteredBorrowedExpenses.length === 0 ? (
                  <div className="py-10 text-center text-muted text-sm">
                    {borrowedExpenseTab === 'unpaid'
                      ? 'No unpaid borrowed expenses for this period!'
                      : 'No borrowed expenses found for this filter.'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-canvas border-b border-border">
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                            Date
                          </th>
                          <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                            Item / Description
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
                        {filteredBorrowedExpenses.map((exp) => (
                          <tr key={exp.id} className="hover:bg-canvas/60 transition-colors">
                            <td className="py-3.5 px-6 text-muted tabular-nums whitespace-nowrap">
                              <span className="font-medium text-ink">{formatDate(exp.business_date)}</span>
                            </td>
                            <td className="py-3.5 px-6 font-semibold text-ink">
                              {exp.name}
                            </td>
                            <td className="py-3.5 px-6 text-muted whitespace-nowrap">
                              {exp.created_by_name || `User #${exp.created_by}`}
                            </td>
                            <td className="py-3.5 px-6 text-ink tabular-nums whitespace-nowrap">
                              {exp.quantity || '—'}
                            </td>
                            <td className="py-3.5 px-6 text-right font-bold text-ink tabular-nums whitespace-nowrap">
                              {formatMoney(Number(exp.amount))}
                            </td>
                            <td className="py-3.5 px-6 whitespace-nowrap">
                              {exp.paid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success border border-success-border">
                                  <Check size={12} />
                                  Paid (Deducted)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warn-bg text-warn border border-warn/40">
                                  <Clock size={12} />
                                  Borrowed (Unpaid)
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-6 text-right whitespace-nowrap">
                              {!exp.paid ? (
                                <button
                                  type="button"
                                  disabled={markExpensePaidMutation.isPending}
                                  onClick={() => markExpensePaidMutation.mutate(exp.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-success text-white hover:opacity-90 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} />
                                  Mark as Paid
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={markExpenseUnpaidMutation.isPending}
                                  onClick={() => markExpenseUnpaidMutation.mutate(exp.id)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-card border border-border text-muted hover:text-ink text-xs font-semibold transition-all disabled:opacity-50"
                                >
                                  Revert Unpaid
                                </button>
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

          {/* ==================== 5. DAILY RECONCILIATION & LOCK NOTICE ==================== */}
          <div className="card p-6 border-2 border-brand/30 bg-brand-tint/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Sliders size={20} className="text-brand" />
                <h3 className="text-body-medium font-bold text-ink">
                  Daily Reconciliation &amp; Lock · {formatDate(selectedDate)}
                </h3>
                {closing?.locked ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success border border-success-border">
                    <Lock size={12} /> Locked &amp; Reconciled
                  </span>
                ) : (
                  <span className="badge-neutral">Open for Reconciliation</span>
                )}
              </div>
              <p className="text-xs text-muted max-w-xl">
                Daily reconciliation has moved to <strong>Manual Entry</strong>. Go to Manual Entry to record physical storeroom eggs, actual cash, actual expenses, and lock or unlock the day.
              </p>
            </div>
            <Link
              to={`/beginning-entry?date=${selectedDate}`}
              className="btn-primary whitespace-nowrap self-start sm:self-auto inline-flex items-center gap-2"
            >
              <Sliders size={16} />
              Reconcile &amp; Lock in Manual Entry
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
