import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  ChevronDown,
  ShoppingBag,
  PackagePlus,
  AlertOctagon,
  Receipt,
  Package,
  Wallet,
  TrendingUp,
  Lock,
  AlertTriangle,
  ArrowRight,
  Loader2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { DatePicker } from '@/components/DatePicker'
import { StatCard } from '@/components/StatCard'
import { summaryApi } from '@/api/summary'
import { settingsApi } from '@/api/settings'
import { formatEggs } from '@/lib/eggs'
import { formatMoney } from '@/lib/money'
import { todayString, formatDate, isPastEightPM } from '@/lib/dates'

export function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const today = todayString()
  const selectedDate = searchParams.get('date') || today

  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const quickAddRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(e.target as Node)) {
        setQuickAddOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  const handleDateChange = (newDate: string) => {
    setSearchParams({ date: newDate })
  }

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  })
  const perCrate = settings?.eggs_per_crate ?? 30

  const { data: book, isLoading } = useQuery({
    queryKey: ['summary', selectedDate],
    queryFn: () => summaryApi.getDailyBook(selectedDate),
  })

  const showShiftBanner =
    book && !book.locked && (selectedDate < today || (selectedDate === today && isPastEightPM()))

  return (
    <>
      <TopBar
        title="Dashboard"
        right={
          <div className="flex items-center gap-3">
            {/* Quick Add Dropdown */}
            <div className="relative" ref={quickAddRef}>
              <button
                type="button"
                onClick={() => setQuickAddOpen(!quickAddOpen)}
                className="btn-primary h-10 px-3.5 text-xs"
              >
                <Plus size={15} />
                Quick add
                <ChevronDown size={14} />
              </button>

              {quickAddOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-card border border-border rounded-lg shadow-modal py-1.5 z-50">
                  <button
                    onClick={() => {
                      setQuickAddOpen(false)
                      navigate('/sale')
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-canvas transition-colors text-left"
                  >
                    <ShoppingBag size={16} className="text-success" />
                    Record Sale
                  </button>
                  <button
                    onClick={() => {
                      setQuickAddOpen(false)
                      navigate('/received')
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-canvas transition-colors text-left"
                  >
                    <PackagePlus size={16} className="text-intake" />
                    Eggs Received
                  </button>
                  <button
                    onClick={() => {
                      setQuickAddOpen(false)
                      navigate('/cracked')
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-canvas transition-colors text-left"
                  >
                    <AlertOctagon size={16} className="text-danger" />
                    Cracked Eggs
                  </button>
                  <button
                    onClick={() => {
                      setQuickAddOpen(false)
                      navigate('/expense')
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-canvas transition-colors text-left border-t border-border mt-1 pt-2"
                  >
                    <Receipt size={16} className="text-brand" />
                    Add Expense
                  </button>
                </div>
              )}
            </div>

            <DatePicker value={selectedDate} onChange={handleDateChange} />
          </div>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-page mx-auto space-y-5 sm:space-y-6">
          {/* Shift / End-of-Day Alert Banner */}
          {showShiftBanner && (
            <div className="bg-warn-bg border border-warn/30 rounded-md px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <AlertTriangle size={20} className="text-warn flex-shrink-0" />
                <div>
                  <p className="text-body-medium text-ink">
                    {formatDate(selectedDate)} is not yet closed &amp; reconciled
                  </p>
                  <p className="text-helper-xs text-muted">
                    Enter the physical closing egg count in Summary to lock this day&apos;s book.
                  </p>
                </div>
              </div>
              <Link to={`/end-of-day?date=${selectedDate}`} className="btn-primary h-9 px-4 text-xs w-full sm:w-auto">
                Close &amp; Lock Day
              </Link>
            </div>
          )}

          {isLoading || !book ? (
            <div className="py-16 flex items-center justify-center text-muted gap-2">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading daily book for {formatDate(selectedDate)}...</span>
            </div>
          ) : (
            <>
              {/* 4 Headline Stat Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                <StatCard
                  label="Remaining after today"
                  value={formatEggs(book.closing, perCrate)}
                  helper={`= ${book.closing} eggs in stock`}
                  icon={<Package size={20} />}
                  variant="neutral"
                />
                <StatCard
                  label="Amount from sales"
                  value={formatMoney(Number(book.revenue))}
                  helper={
                    Number(book.borrowed_amount ?? 0) > 0
                      ? `${formatEggs(book.sold, perCrate)} sold (+${formatMoney(Number(book.borrowed_amount))} borrowed)`
                      : `${formatEggs(book.sold, perCrate)} sold`
                  }
                  icon={<ShoppingBag size={20} />}
                  variant="success"
                />
                <StatCard
                  label="Total spent"
                  value={formatMoney(Number(book.total_expenses))}
                  helper="Feed & other costs"
                  icon={<Wallet size={20} />}
                  variant="danger"
                />
                <StatCard
                  label="Sales minus expenses"
                  value={formatMoney(Number(book.net_margin))}
                  helper={
                    Number(book.borrowed_amount ?? 0) > 0
                      ? `If borrowed paid: ${formatMoney(Number(book.projected_net_margin ?? book.net_margin))}`
                      : 'Net cash for the day'
                  }
                  icon={<TrendingUp size={20} />}
                  variant={Number(book.net_margin) >= 0 ? 'success' : 'danger'}
                />
              </div>

              {/* 12-Col Grid: 8 cols Daily Book + 4 cols Worker Sales & Stock Status */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 8 Cols: The Daily Book Paper Ledger */}
                <div className="lg:col-span-8 card overflow-hidden">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-canvas/40">
                    <div>
                      <h2 className="text-title-section text-ink">The Daily Book</h2>
                      <p className="text-helper-xs text-muted">
                        Official paper-style reconciliation ledger for {formatDate(selectedDate)}
                      </p>
                    </div>
                    {book.locked ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-bg text-success">
                        <Lock size={12} />
                        Day Locked
                      </span>
                    ) : (
                      <span className="badge-neutral">Open Shift</span>
                    )}
                  </div>

                  <div className="divide-y divide-border">
                    {/* Stock Movement Section */}
                    <div className="px-6 py-3 bg-canvas/60 text-xs font-semibold uppercase tracking-wider text-muted">
                      Egg Stock Balance ({perCrate} eggs = 1 crate)
                    </div>

                    <div className="px-6 py-3.5 flex items-center justify-between text-body-default">
                      <span className="text-ink">Remaining from previous day (Opening)</span>
                      <span className="font-semibold text-ink tabular-nums">
                        {formatEggs(book.opening, perCrate)}{' '}
                        <span className="text-xs text-muted font-normal">({book.opening} eggs)</span>
                      </span>
                    </div>

                    <div className="px-6 py-3.5 flex items-center justify-between text-body-default">
                      <span className="text-intake font-medium">(+) Eggs gotten today</span>
                      <span className="font-semibold text-intake tabular-nums">
                        + {formatEggs(book.gotten, perCrate)}{' '}
                        <span className="text-xs text-muted font-normal">({book.gotten} eggs)</span>
                      </span>
                    </div>

                    <div className="px-6 py-3.5 flex items-center justify-between text-body-default">
                      <span className="text-danger font-medium">(-) Eggs cracked</span>
                      <span className="font-semibold text-danger tabular-nums">
                        - {formatEggs(book.cracked, perCrate)}{' '}
                        <span className="text-xs text-muted font-normal">({book.cracked} eggs)</span>
                      </span>
                    </div>

                    <div className="px-6 py-3.5 flex items-center justify-between text-body-default">
                      <span className="text-success font-medium">(-) Eggs sold</span>
                      <span className="font-semibold text-success tabular-nums">
                        - {formatEggs(book.sold, perCrate)}{' '}
                        <span className="text-xs text-muted font-normal">({book.sold} eggs)</span>
                      </span>
                    </div>

                    <div className="px-6 py-4 flex items-center justify-between bg-canvas/40 font-semibold">
                      <span className="text-ink">(=) Remaining after today (Closing Stock)</span>
                      <span className="text-ink tabular-nums">
                        {formatEggs(book.closing, perCrate)} ({book.closing} eggs)
                      </span>
                    </div>

                    {/* Cash Movement Section */}
                    <div className="px-6 py-3 bg-canvas/60 text-xs font-semibold uppercase tracking-wider text-muted">
                      Cash &amp; Expenses Summary
                    </div>

                    <div className="px-6 py-3.5 flex items-center justify-between text-body-default">
                      <span className="text-ink">Amount from sales (Cash Present)</span>
                      <span className="font-semibold text-success tabular-nums">
                        {formatMoney(Number(book.revenue))}
                      </span>
                    </div>

                    {Number(book.borrowed_amount ?? 0) > 0 && (
                      <div className="px-6 py-3.5 flex items-center justify-between text-body-default bg-warn-bg/20">
                        <span className="text-warn font-medium">Borrowed sales (Not paid yet)</span>
                        <span className="font-semibold text-warn tabular-nums">
                          {formatMoney(Number(book.borrowed_amount))}
                        </span>
                      </div>
                    )}

                    <div className="px-6 py-3.5 flex items-center justify-between text-body-default">
                      <span className="text-muted pl-3">• Feed expense</span>
                      <span className="font-medium text-ink tabular-nums">
                        {formatMoney(Number(book.feed))}
                      </span>
                    </div>

                    <div className="px-6 py-3.5 flex items-center justify-between text-body-default">
                      <span className="text-muted pl-3">• Other expenses</span>
                      <span className="font-medium text-ink tabular-nums">
                        {formatMoney(Number(book.other))}
                      </span>
                    </div>

                    <div className="px-6 py-3.5 flex items-center justify-between text-body-default">
                      <span className="text-ink font-medium">Total spent</span>
                      <span className="font-semibold text-danger tabular-nums">
                        - {formatMoney(Number(book.total_expenses))}
                      </span>
                    </div>

                    {/* Hero Net Cash Row */}
                    <div className="px-6 py-5 bg-brand-tint/60 flex items-center justify-between">
                      <div>
                        <span className="block text-sm font-bold uppercase tracking-wider text-brand">
                          Sales Minus Expenses (Money Present)
                        </span>
                        <span className="text-helper-xs text-muted">
                          {Number(book.borrowed_amount ?? 0) > 0
                            ? `Projected if borrowed is paid: ${formatMoney(Number(book.projected_net_margin ?? book.net_margin))}`
                            : 'Total cash retained after daily operational expenses'}
                        </span>
                      </div>
                      <span
                        className={`text-display-md font-bold tabular-nums ${
                          Number(book.net_margin) >= 0 ? 'text-success' : 'text-danger'
                        }`}
                      >
                        {formatMoney(Number(book.net_margin))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right 4 Cols: Sales by Worker & End of Day Card */}
                <div className="lg:col-span-4 space-y-6">
                  {/* Sales by Worker */}
                  <div className="card overflow-hidden">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                      <h3 className="text-title-section text-ink">Sales by Worker</h3>
                      <Link
                        to={`/entries?date=${selectedDate}`}
                        className="text-xs font-semibold text-brand hover:underline"
                      >
                        All entries →
                      </Link>
                    </div>

                    {book.by_worker.length === 0 ? (
                      <div className="p-6 text-center text-muted text-sm">
                        No worker sales recorded on {formatDate(selectedDate)}.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {book.by_worker.map((w) => (
                          <div
                            key={w.user_id}
                            className="px-5 py-3.5 flex items-center justify-between hover:bg-canvas/50 transition-colors"
                          >
                            <div>
                              <p className="text-body-medium text-ink">{w.user_name}</p>
                              <p className="text-helper-xs text-muted tabular-nums">
                                {formatEggs(w.sold_eggs, perCrate)} ({w.sold_eggs} eggs)
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-body-medium text-success tabular-nums">
                                {formatMoney(Number(w.sold_amount))}
                              </p>
                              <Link
                                to={`/entries?date=${selectedDate}&user_id=${w.user_id}`}
                                className="text-xs font-medium text-brand hover:underline inline-flex items-center gap-0.5"
                              >
                                Filter
                                <ArrowRight size={11} />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Reconciliation Status Card */}
                  <div className="card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-title-section text-ink">Day Reconciliation</h3>
                      <Lock
                        size={18}
                        className={book.locked ? 'text-success' : 'text-muted'}
                      />
                    </div>
                    <p className="text-xs text-muted leading-relaxed">
                      {book.locked
                        ? `This day has been closed and locked with a physical count of ${formatEggs(
                          book.counted_eggs ?? book.closing,
                          perCrate,
                        )}.`
                        : 'Verify physical trays in the storeroom at the end of the shift and lock the day.'}
                    </p>
                    <Link
                      to={`/end-of-day?date=${selectedDate}`}
                      className="btn-outline w-full justify-center text-xs"
                    >
                      {book.locked ? 'View Reconciliation' : 'Go to End of Day Count'}
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
