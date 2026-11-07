import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Wallet,
  Package,
  Clock,
  CheckCircle2,
  RotateCcw,
  PlusCircle,
  Save,
  Loader2,
  History,
  Banknote,
  Egg,
  Lock,
  Unlock,
  Sliders,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { EggQuantityInput } from '@/components/EggQuantityInput'
import { DatePicker } from '@/components/DatePicker'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { UnifiedCard } from '@/components/UnifiedCard'
import { useToast } from '@/components/Toast'
import { settingsApi } from '@/api/settings'
import { summaryApi } from '@/api/summary'
import { eventsApi, type EggEvent } from '@/api/events'
import { expensesApi, type ExpenseCategory } from '@/api/expenses'
import { closingsApi } from '@/api/closings'
import { formatEggs } from '@/lib/eggs'
import { formatMoney } from '@/lib/money'
import { todayString, formatDate } from '@/lib/dates'

export function BeginningEntry() {
  const today = todayString()
  const toast = useToast()
  const queryClient = useQueryClient()

  const [searchParams, setSearchParams] = useSearchParams()
  const initialReconcileDate = searchParams.get('date') || today
  const [reconcileDate, setReconcileDate] = useState<string>(initialReconcileDate)

  // Sync reconcileDate if URL searchParam date changes
  useEffect(() => {
    const d = searchParams.get('date')
    if (d && d !== reconcileDate) {
      setReconcileDate(d)
    }
  }, [searchParams, reconcileDate])

  const handleReconcileDateChange = (d: string) => {
    setReconcileDate(d)
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('date', d)
        return next
      },
      { replace: true }
    )
  }

  // Reconciliation actual inputs
  const [countedEggsOverride, setCountedEggsOverride] = useState<number | null>(null)
  const [actualRevenueInput, setActualRevenueInput] = useState<string>('')
  const [actualExpensesInput, setActualExpensesInput] = useState<string>('')
  const [actualSoldEggsOverride, setActualSoldEggsOverride] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [unlockConfirmOpen, setUnlockConfirmOpen] = useState(false)

  useEffect(() => {
    setCountedEggsOverride(null)
    setActualRevenueInput('')
    setActualExpensesInput('')
    setActualSoldEggsOverride(null)
  }, [reconcileDate])

  const { data: closing, isLoading: isClosingLoading } = useQuery({
    queryKey: ['closing', reconcileDate],
    queryFn: () => closingsApi.getClosing(reconcileDate),
  })

  const { data: reconcileDailyBook } = useQuery({
    queryKey: ['daily-book', reconcileDate],
    queryFn: () => summaryApi.getDailyBook(reconcileDate),
  })

  // Recorded values from system entries
  const recordedClosing = closing?.closing_eggs ?? reconcileDailyBook?.computed_closing ?? reconcileDailyBook?.closing ?? 0
  const recordedRevenue = Number(closing?.recorded_revenue ?? reconcileDailyBook?.recorded_revenue ?? reconcileDailyBook?.revenue ?? 0)
  const recordedExpenses = Number(closing?.recorded_expenses ?? reconcileDailyBook?.recorded_expenses ?? reconcileDailyBook?.total_expenses ?? 0)
  const recordedSold = closing?.recorded_sold_eggs ?? reconcileDailyBook?.recorded_sold ?? reconcileDailyBook?.sold ?? 0

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
      closingsApi.closeDay(reconcileDate, {
        counted_eggs: countedEggs,
        actual_revenue: actualRevenue,
        actual_expenses: actualExpenses,
        actual_sold_eggs: actualSoldEggs,
      }),
    onSuccess: () => {
      toast(`Day ${formatDate(reconcileDate)} reconciled and locked!`, 'success')
      setConfirmOpen(false)
      queryClient.invalidateQueries({ queryKey: ['closing', reconcileDate] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to lock day'
      toast(msg, 'error')
    },
  })

  const unlockMutation = useMutation({
    mutationFn: () => closingsApi.unlockDay(reconcileDate),
    onSuccess: () => {
      toast(`Day ${formatDate(reconcileDate)} unlocked for adjustments.`, 'info')
      setUnlockConfirmOpen(false)
      queryClient.invalidateQueries({ queryKey: ['closing', reconcileDate] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to unlock day'
      toast(msg, 'error')
    },
  })

  // 1. Fetch settings and all-time summary
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  })
  const perCrate = settings?.eggs_per_crate ?? 30

  const { data: allTimeSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['period-summary', 'all', today],
    queryFn: () => summaryApi.getPeriodSummary({ period: 'all', date: today }),
  })

  // 2. State for Manual Money & Egg Stock (Available Now, Opening Day Eggs, or Initial Beginning Stock)
  const [moneyMode, setMoneyMode] = useState<'exact_present' | 'beginning_base'>('exact_present')
  const [moneyInput, setMoneyInput] = useState<string>('')
  const [eggMode, setEggMode] = useState<'exact_present' | 'opening_day' | 'beginning_base'>('exact_present')
  const [eggOpeningDate, setEggOpeningDate] = useState<string>(today)
  const [beginningEggs, setBeginningEggs] = useState<number>(0)
  const [balancesInitialized, setBalancesInitialized] = useState(false)

  const { data: selectedDayBook } = useQuery({
    queryKey: ['summary', eggOpeningDate],
    queryFn: () => summaryApi.getDailyBook(eggOpeningDate),
  })

  useEffect(() => {
    if (settings && allTimeSummary && !balancesInitialized) {
      setBeginningEggs(Number(allTimeSummary.closing_eggs ?? settings.beginning_eggs ?? 0))
      setMoneyInput(String(Number(allTimeSummary.money_left_present ?? 0).toFixed(2)))
      setBalancesInitialized(true)
    }
  }, [settings, allTimeSummary, balancesInitialized])

  const handleMoneyModeChange = (mode: 'exact_present' | 'beginning_base') => {
    setMoneyMode(mode)
    if (mode === 'exact_present' && allTimeSummary) {
      setMoneyInput(String(Number(allTimeSummary.money_left_present ?? 0).toFixed(2)))
    } else if (mode === 'beginning_base' && settings) {
      setMoneyInput(String(Number(settings.beginning_money ?? 0).toFixed(2)))
    }
  }

  const handleEggModeChange = (mode: 'exact_present' | 'opening_day' | 'beginning_base') => {
    setEggMode(mode)
    if (mode === 'exact_present' && allTimeSummary) {
      setBeginningEggs(Number(allTimeSummary.closing_eggs ?? 0))
    } else if (mode === 'opening_day' && selectedDayBook) {
      setBeginningEggs(Number(selectedDayBook.opening ?? 0))
    } else if (mode === 'beginning_base' && settings) {
      setBeginningEggs(Number(settings.beginning_eggs ?? 0))
    }
  }

  const handleEggOpeningDateChange = (newDate: string) => {
    setEggOpeningDate(newDate)
  }

  useEffect(() => {
    if (eggMode === 'opening_day' && selectedDayBook) {
      setBeginningEggs(Number(selectedDayBook.opening ?? 0))
    }
  }, [eggMode, selectedDayBook])

  const updateBalancesMutation = useMutation({
    mutationFn: async () => {
      const parsedMoney = parseFloat(moneyInput)
      if (isNaN(parsedMoney)) {
        throw new Error('Please enter a valid money amount')
      }
      const payload: {
        beginning_eggs?: number
        target_present_eggs?: number
        target_opening_eggs?: number
        target_opening_date?: string
        beginning_money?: number
        target_present_money?: number
      } = {}

      if (eggMode === 'exact_present') {
        payload.target_present_eggs = beginningEggs
        payload.target_opening_date = today
      } else if (eggMode === 'opening_day') {
        payload.target_opening_eggs = beginningEggs
        payload.target_opening_date = eggOpeningDate || today
      } else {
        payload.beginning_eggs = beginningEggs
      }

      if (moneyMode === 'exact_present') {
        payload.target_present_money = Number(parsedMoney.toFixed(2))
      } else {
        payload.beginning_money = Number(parsedMoney.toFixed(2))
      }

      return settingsApi.updateSettings(payload)
    },
    onSuccess: () => {
      toast('Money and egg stock balances updated!', 'success')
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err as { message?: string })?.message ||
        'Failed to update balances'
      toast(msg, 'error')
    },
  })

  // 3. State for Logging Borrowed Eggs & Money OR Old Manual Entries
  const [entryTab, setEntryTab] = useState<'borrowed' | 'historical'>('borrowed')

  // Borrowed entry form state
  const [borrowedDate, setBorrowedDate] = useState<string>(today)
  const [borrowedUnitMode, setBorrowedUnitMode] = useState<'crates' | 'eggs'>('crates')
  const [borrowedCrates, setBorrowedCrates] = useState<string>('')
  const [borrowedEggsCount, setBorrowedEggsCount] = useState<string>('')
  const [borrowedPricingMode, setBorrowedPricingMode] = useState<'multiply' | 'manual'>('multiply')
  const [borrowedUnitPrice, setBorrowedUnitPrice] = useState<string>('')
  const [borrowedManualAmount, setBorrowedManualAmount] = useState<string>('')
  const [borrowedNote, setBorrowedNote] = useState<string>('')
  const [excludeFromStock, setExcludeFromStock] = useState<boolean>(true)

  const computedBorrowedEggs =
    borrowedUnitMode === 'crates'
      ? (parseInt(borrowedCrates, 10) || 0) * perCrate
      : parseInt(borrowedEggsCount, 10) || 0

  const computedBorrowedAmount =
    borrowedPricingMode === 'manual'
      ? Number((parseFloat(borrowedManualAmount) || 0).toFixed(2))
      : borrowedUnitMode === 'crates'
        ? Number(((parseInt(borrowedCrates, 10) || 0) * (parseFloat(borrowedUnitPrice) || 0)).toFixed(2))
        : Number(((parseInt(borrowedEggsCount, 10) || 0) * (parseFloat(borrowedUnitPrice) || 0)).toFixed(2))

  const createBorrowedMutation = useMutation({
    mutationFn: async () => {
      if (computedBorrowedEggs <= 0) {
        throw new Error('Please enter the number of crates or eggs borrowed')
      }
      if (computedBorrowedAmount <= 0) {
        throw new Error('Please enter a valid borrowed amount or unit price')
      }
      return eventsApi.createEvent({
        type: 'sold',
        eggs: computedBorrowedEggs,
        amount: computedBorrowedAmount,
        is_borrowed: true,
        exclude_from_stock: excludeFromStock,
        business_date: borrowedDate,
        note: borrowedNote.trim() || 'Borrowed / Credit entry',
      })
    },
    onSuccess: () => {
      toast('Borrowed eggs & money recorded!', 'success')
      setBorrowedCrates('')
      setBorrowedEggsCount('')
      setBorrowedUnitPrice('')
      setBorrowedManualAmount('')
      setBorrowedNote('')
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err as { message?: string })?.message ||
        'Failed to record borrowed entry'
      toast(msg, 'error')
    },
  })

  // Historical / Manual entry form state
  const [histDate, setHistDate] = useState<string>(today)
  const [histType, setHistType] = useState<'received' | 'sold' | 'cracked' | 'expense'>('received')
  const [histEggs, setHistEggs] = useState<number>(0)
  const [histAmount, setHistAmount] = useState<string>('')
  const [histNote, setHistNote] = useState<string>('')
  const [histExpenseCategory, setHistExpenseCategory] = useState<ExpenseCategory>('feed')
  const [histExpenseQty, setHistExpenseQty] = useState<string>('')

  const createHistoricalMutation = useMutation({
    mutationFn: async () => {
      if (histType === 'expense') {
        const amt = parseFloat(histAmount)
        if (isNaN(amt) || amt <= 0) {
          throw new Error('Please enter a valid expense amount')
        }
        if ((histExpenseCategory === 'other' || histExpenseCategory === 'borrowed') && !histNote.trim()) {
          throw new Error('Please enter a description/name for the expense')
        }
        return expensesApi.createExpense({
          category: histExpenseCategory,
          name:
            histNote.trim() ||
            (histExpenseCategory === 'feed'
              ? 'Feed'
              : histExpenseCategory === 'crates'
                ? 'Crates'
                : 'Expense'),
          quantity: histExpenseQty.trim() || undefined,
          amount: Number(amt.toFixed(2)),
          is_borrowed: histExpenseCategory === 'borrowed',
          business_date: histDate,
        })
      } else {
        if (histEggs <= 0) {
          throw new Error('Please enter at least 1 egg or crate')
        }
        let saleAmt: number | undefined = undefined
        if (histType === 'sold') {
          const parsed = parseFloat(histAmount)
          if (isNaN(parsed) || parsed < 0) {
            throw new Error('Please enter the total sale amount')
          }
          saleAmt = Number(parsed.toFixed(2))
        }
        return eventsApi.createEvent({
          type: histType,
          eggs: histEggs,
          amount: saleAmt,
          is_borrowed: false,
          business_date: histDate,
          note: histNote.trim() || undefined,
        })
      }
    },
    onSuccess: () => {
      toast(`Manual ${histType} entry saved for ${formatDate(histDate)}!`, 'success')
      setHistEggs(0)
      setHistAmount('')
      setHistNote('')
      setHistExpenseQty('')
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } }; message?: string })?.response?.data
          ?.detail ||
        (err as { message?: string })?.message ||
        'Failed to save manual entry'
      toast(msg, 'error')
    },
  })

  // 4. Borrowed status management (Mark as Paid / Revert to Unpaid)
  const [borrowedFilter, setBorrowedFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid')

  const markPaidMutation = useMutation({
    mutationFn: (eventId: number) => eventsApi.markPaid(eventId),
    onSuccess: (updated) => {
      toast(
        `Marked as Paid! ${formatMoney(Number(updated.amount ?? 0))} added to Money We Have.`,
        'success',
      )
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: () => toast('Failed to mark borrowed entry as paid', 'error'),
  })

  const markUnpaidMutation = useMutation({
    mutationFn: (eventId: number) => eventsApi.markUnpaid(eventId),
    onSuccess: () => {
      toast('Reverted status back to Unpaid (Borrowed).', 'info')
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
    },
    onError: () => toast('Failed to update status', 'error'),
  })

  const presentMoney = Number(allTimeSummary?.money_left_present ?? 0)
  const projectedMoney = Number(allTimeSummary?.money_left_with_borrowed ?? 0)
  const unpaidBorrowedTotal = Number(allTimeSummary?.borrowed_unpaid_amount ?? 0)
  const currentEggStock = Number(allTimeSummary?.closing_eggs ?? 0)
  const beginningMoneyVal = Number(settings?.beginning_money ?? 0)
  const beginningEggsVal = Number(settings?.beginning_eggs ?? 0)

  const allBorrowedSales: EggEvent[] = allTimeSummary?.borrowed_sales ?? []
  const filteredBorrowed = allBorrowedSales.filter((ev) => {
    if (borrowedFilter === 'unpaid') return !ev.paid
    if (borrowedFilter === 'paid') return Boolean(ev.paid)
    return true
  })

  return (
    <>
      <TopBar title="Manual Entry" />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-page mx-auto space-y-6">
          {/* TOP HERO STRIP: Current Money & Egg Stock We Have */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <UnifiedCard
              label="Money We Have (Present)"
              icon={<Wallet size={18} />}
              variant="success"
              value={isSummaryLoading ? '—' : formatMoney(presentMoney)}
              helper={`Includes manual/beginning balance (${formatMoney(beginningMoneyVal)}) + paid sales − expenses`}
            />

            <UnifiedCard
              label="Eggs We Have (In Stock)"
              icon={<Package size={18} />}
              variant="intake"
              value={isSummaryLoading ? '—' : formatEggs(currentEggStock, perCrate)}
              helper={
                <span>
                  {currentEggStock.toLocaleString()} total eggs · Opening Day Eggs ({eggOpeningDate === today ? 'Today' : formatDate(eggOpeningDate)}):{' '}
                  <strong className="text-ink">
                    {selectedDayBook ? formatEggs(Number(selectedDayBook.opening ?? 0), perCrate) : formatEggs(beginningEggsVal, perCrate)}
                  </strong>
                </span>
              }
            />

            <UnifiedCard
              label="Borrowed & Yet to Be Paid"
              icon={<Clock size={18} />}
              variant="warn"
              value={isSummaryLoading ? '—' : formatMoney(unpaidBorrowedTotal)}
              helper={
                <span>
                  Money if all borrowed is paid:{' '}
                  <strong className="text-ink">{formatMoney(projectedMoney)}</strong>
                </span>
              }
            />
          </div>

          {/* SECTION 1: Set / Change Money & Eggs We Already Have */}
          <div className="card p-5 sm:p-6 space-y-5">
            <div className="border-b border-border pb-3">
              <h2 className="text-title-section text-ink">
                1. Set or Change Money & Eggs We Already Have
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Use this section to set your starting egg inventory or manually adjust the cash balance currently on hand.
              </p>
            </div>

            {isSettingsLoading ? (
              <div className="py-8 flex items-center justify-center text-muted gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading current balances...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Manual Money Control */}
                <div className="space-y-3 bg-canvas/60 p-4 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <label className="text-label-sm font-semibold text-ink flex items-center gap-2">
                      <Banknote size={16} className="text-brand" />
                      Money We Have (GH₵)
                    </label>
                  </div>

                  {/* Mode selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleMoneyModeChange('exact_present')}
                      className={`py-2 px-3 rounded text-xs font-semibold border text-left transition-colors ${
                        moneyMode === 'exact_present'
                          ? 'bg-brand text-white border-brand'
                          : 'bg-card text-muted border-border hover:text-ink'
                      }`}
                    >
                      Set Exact Cash on Hand Now
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoneyModeChange('beginning_base')}
                      className={`py-2 px-3 rounded text-xs font-semibold border text-left transition-colors ${
                        moneyMode === 'beginning_base'
                          ? 'bg-brand text-white border-brand'
                          : 'bg-card text-muted border-border hover:text-ink'
                      }`}
                    >
                      Set Beginning / Opening Cash
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs text-muted mb-1">
                      {moneyMode === 'exact_present'
                        ? 'Enter the exact total cash you currently have on hand (GH₵):'
                        : 'Enter the starting / beginning cash balance before recorded sales (GH₵):'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={moneyInput}
                      onChange={(e) => setMoneyInput(e.target.value)}
                      placeholder="0.00"
                      className="input-base text-lg font-bold tabular-nums"
                    />
                  </div>
                </div>

                {/* Right: Egg Stock & Opening Day Eggs Control */}
                <div className="space-y-3 bg-canvas/60 p-4 rounded-lg border border-border">
                  <label className="text-label-sm font-semibold text-ink flex items-center gap-2">
                    <Egg size={16} className="text-brand" />
                    Beginning Eggs We Already Have / Eggs Available
                  </label>

                  {/* Egg Mode Selector */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEggModeChange('exact_present')}
                      className={`py-2 px-3 rounded text-xs font-semibold border text-left transition-colors ${
                        eggMode === 'exact_present'
                          ? 'bg-brand text-white border-brand'
                          : 'bg-card text-muted border-border hover:text-ink'
                      }`}
                    >
                      Set Eggs Available Now (In Stock)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEggModeChange('opening_day')}
                      className={`py-2 px-3 rounded text-xs font-semibold border text-left transition-colors ${
                        eggMode === 'opening_day'
                          ? 'bg-brand text-white border-brand'
                          : 'bg-card text-muted border-border hover:text-ink'
                      }`}
                    >
                      Set Opening Day Eggs (Start of Day)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEggModeChange('beginning_base')}
                      className={`py-2 px-3 rounded text-xs font-semibold border text-left transition-colors ${
                        eggMode === 'beginning_base'
                          ? 'bg-brand text-white border-brand'
                          : 'bg-card text-muted border-border hover:text-ink'
                      }`}
                    >
                      Set Initial Beginning Stock
                    </button>
                  </div>

                  {eggMode === 'opening_day' && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 bg-card p-2.5 rounded border border-border">
                      <label className="text-xs font-semibold text-ink whitespace-nowrap">
                        Opening Day Date:
                      </label>
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="date"
                          value={eggOpeningDate}
                          onChange={(e) => handleEggOpeningDateChange(e.target.value)}
                          className="input-base py-1 px-2.5 text-xs font-medium w-auto"
                        />
                        {eggOpeningDate !== today && (
                          <button
                            type="button"
                            onClick={() => handleEggOpeningDateChange(today)}
                            className="text-xs font-semibold text-brand hover:underline"
                          >
                            Today
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] text-muted">
                        Current opening:{' '}
                        <strong className="text-ink">
                          {formatEggs(Number(selectedDayBook?.opening ?? 0), perCrate)}
                        </strong>
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-muted">
                    {eggMode === 'exact_present'
                      ? 'Enter the exact crates and single eggs currently available in stock right now:'
                      : eggMode === 'opening_day'
                        ? `Enter the crates and single eggs used to start ${eggOpeningDate === today ? 'today' : formatDate(eggOpeningDate)} (Opening Day Eggs):`
                        : 'Enter the initial crates and single eggs already in storage when starting the book:'}
                  </p>
                  <EggQuantityInput
                    value={beginningEggs}
                    onChange={setBeginningEggs}
                    perCrate={perCrate}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => updateBalancesMutation.mutate()}
                disabled={updateBalancesMutation.isPending}
                className="btn-primary w-full sm:w-auto"
              >
                {updateBalancesMutation.isPending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving Balances...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Save Money & Egg Balances
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SECTION 2: Log Borrowed Eggs & Money OR Old Manual Entries */}
          <div className="card p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border pb-4">
              <div>
                <h2 className="text-title-section text-ink">
                  2. Log Borrowed Eggs & Money or Old Manual Entries
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Record existing credit/borrowed sales yet to be paid, or backdate old farm records.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEntryTab('borrowed')}
                  className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                    entryTab === 'borrowed'
                      ? 'bg-warn text-white shadow-sm'
                      : 'bg-canvas text-muted hover:text-ink border border-border'
                  }`}
                >
                  Log Borrowed (Yet to Be Paid)
                </button>
                <button
                  type="button"
                  onClick={() => setEntryTab('historical')}
                  className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors ${
                    entryTab === 'historical'
                      ? 'bg-brand text-white shadow-sm'
                      : 'bg-canvas text-muted hover:text-ink border border-border'
                  }`}
                >
                  Log Old Sale / Eggs / Expense
                </button>
              </div>
            </div>

            {entryTab === 'borrowed' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label-sm text-ink mb-1.5">
                      Date Borrowed
                    </label>
                    <input
                      type="date"
                      value={borrowedDate}
                      max={today}
                      onChange={(e) => setBorrowedDate(e.target.value)}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-ink mb-1.5">
                      Debtor / Customer Name & Note
                    </label>
                    <input
                      type="text"
                      value={borrowedNote}
                      onChange={(e) => setBorrowedNote(e.target.value)}
                      placeholder="e.g. Kwesi Mensah — 4 crates on credit"
                      className="input-base"
                    />
                  </div>
                </div>

                {/* Unit Mode & Pricing Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-label-sm text-ink">Quantity Mode</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBorrowedUnitMode('crates')}
                        className={`py-2 px-3 rounded text-xs font-semibold border transition-colors ${
                          borrowedUnitMode === 'crates'
                            ? 'bg-brand-tint text-brand border-brand'
                            : 'bg-card text-muted border-border'
                        }`}
                      >
                        By Crates ({perCrate}/crate)
                      </button>
                      <button
                        type="button"
                        onClick={() => setBorrowedUnitMode('eggs')}
                        className={`py-2 px-3 rounded text-xs font-semibold border transition-colors ${
                          borrowedUnitMode === 'eggs'
                            ? 'bg-brand-tint text-brand border-brand'
                            : 'bg-card text-muted border-border'
                        }`}
                      >
                        By Single Eggs
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-label-sm text-ink">Amount Calculation</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setBorrowedPricingMode('multiply')}
                        className={`py-2 px-3 rounded text-xs font-semibold border transition-colors ${
                          borrowedPricingMode === 'multiply'
                            ? 'bg-brand-tint text-brand border-brand'
                            : 'bg-card text-muted border-border'
                        }`}
                      >
                        Rate × Quantity
                      </button>
                      <button
                        type="button"
                        onClick={() => setBorrowedPricingMode('manual')}
                        className={`py-2 px-3 rounded text-xs font-semibold border transition-colors ${
                          borrowedPricingMode === 'manual'
                            ? 'bg-brand-tint text-brand border-brand'
                            : 'bg-card text-muted border-border'
                        }`}
                      >
                        Enter Direct Amount
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-label-sm text-ink mb-1.5">
                      {borrowedUnitMode === 'crates' ? 'Number of Crates Borrowed' : 'Number of Eggs Borrowed'}
                    </label>
                    {borrowedUnitMode === 'crates' ? (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={borrowedCrates}
                        onChange={(e) => setBorrowedCrates(e.target.value)}
                        placeholder="0"
                        className="input-base tabular-nums"
                      />
                    ) : (
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={borrowedEggsCount}
                        onChange={(e) => setBorrowedEggsCount(e.target.value)}
                        placeholder="0"
                        className="input-base tabular-nums"
                      />
                    )}
                    <p className="text-xs text-muted mt-1">
                      Total: {formatEggs(computedBorrowedEggs, perCrate)} ({computedBorrowedEggs} eggs)
                    </p>
                  </div>

                  {borrowedPricingMode === 'multiply' ? (
                    <div>
                      <label className="block text-label-sm text-ink mb-1.5">
                        {borrowedUnitMode === 'crates' ? 'Price per Crate (GH₵)' : 'Price per Egg (GH₵)'}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={borrowedUnitPrice}
                        onChange={(e) => setBorrowedUnitPrice(e.target.value)}
                        placeholder="0.00"
                        className="input-base tabular-nums"
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-label-sm text-ink mb-1.5">
                        Total Money Owed (GH₵)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={borrowedManualAmount}
                        onChange={(e) => setBorrowedManualAmount(e.target.value)}
                        placeholder="0.00"
                        className="input-base tabular-nums"
                      />
                    </div>
                  )}

                  <div className="bg-warn-bg/50 border border-warn/40 rounded-lg p-3 flex flex-col justify-center">
                    <span className="text-xs font-semibold text-warn uppercase">
                      Amount Yet to Be Paid
                    </span>
                    <span className="text-xl font-extrabold text-ink tabular-nums mt-0.5">
                      {formatMoney(computedBorrowedAmount)}
                    </span>
                  </div>
                </div>

                {/* Stock deduction toggle */}
                <label className="flex items-start gap-2.5 p-3 rounded-lg bg-canvas border border-border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={excludeFromStock}
                    onChange={(e) => setExcludeFromStock(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-brand focus:ring-brand"
                  />
                  <span className="text-xs text-ink">
                    <strong>Old debt (do not deduct from current egg stock):</strong> Check this if these eggs were already handed out before you counted your current Beginning Egg Stock. Uncheck if the eggs are being taken from current stock now.
                  </span>
                </label>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => createBorrowedMutation.mutate()}
                    disabled={createBorrowedMutation.isPending}
                    className="btn-primary w-full sm:w-auto"
                  >
                    {createBorrowedMutation.isPending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Recording Borrowed Entry...
                      </>
                    ) : (
                      <>
                        <PlusCircle size={16} />
                        Record Borrowed Eggs & Money
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              /* Historical / Manual Entry Tab */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label-sm text-ink mb-1.5">
                      Entry Date (Past or Today)
                    </label>
                    <input
                      type="date"
                      value={histDate}
                      max={today}
                      onChange={(e) => setHistDate(e.target.value)}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="block text-label-sm text-ink mb-1.5">
                      Entry Type
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(
                        [
                          { key: 'received', label: 'Eggs Received' },
                          { key: 'sold', label: 'Paid Sale' },
                          { key: 'cracked', label: 'Cracked Eggs' },
                          { key: 'expense', label: 'Expense' },
                        ] as const
                      ).map((t) => (
                        <button
                          key={t.key}
                          type="button"
                          onClick={() => setHistType(t.key)}
                          className={`py-2 px-2.5 rounded text-xs font-semibold border transition-colors ${
                            histType === t.key
                              ? 'bg-brand text-white border-brand'
                              : 'bg-card text-muted border-border hover:text-ink'
                          }`}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {histType === 'expense' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-label-sm text-ink mb-1.5">Category</label>
                      <select
                        value={histExpenseCategory}
                        onChange={(e) => setHistExpenseCategory(e.target.value as ExpenseCategory)}
                        className="input-base"
                      >
                        <option value="feed">Feed</option>
                        <option value="crates">Crates</option>
                        <option value="other">Other Expense</option>
                        <option value="borrowed">Borrowed Expense (Unpaid)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-label-sm text-ink mb-1.5">Amount Spent (GH₵)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={histAmount}
                        onChange={(e) => setHistAmount(e.target.value)}
                        placeholder="0.00"
                        className="input-base tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-label-sm text-ink mb-1.5">Item Name / Note</label>
                      <input
                        type="text"
                        value={histNote}
                        onChange={(e) => setHistNote(e.target.value)}
                        placeholder={histExpenseCategory === 'feed' ? 'e.g. 5 bags layer mash' : 'e.g. Transport / Medications'}
                        className="input-base"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <EggQuantityInput
                      value={histEggs}
                      onChange={setHistEggs}
                      perCrate={perCrate}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {histType === 'sold' && (
                        <div>
                          <label className="block text-label-sm text-ink mb-1.5">
                            Total Sale Amount Received (GH₵)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={histAmount}
                            onChange={(e) => setHistAmount(e.target.value)}
                            placeholder="0.00"
                            className="input-base tabular-nums"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-label-sm text-ink mb-1.5">
                          Note / Reference (Optional)
                        </label>
                        <input
                          type="text"
                          value={histNote}
                          onChange={(e) => setHistNote(e.target.value)}
                          placeholder="e.g. Old paper book entry"
                          className="input-base"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => createHistoricalMutation.mutate()}
                    disabled={createHistoricalMutation.isPending}
                    className="btn-primary w-full sm:w-auto"
                  >
                    {createHistoricalMutation.isPending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Saving Entry...
                      </>
                    ) : (
                      <>
                        <History size={16} />
                        Save Manual Entry
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: Single Day Reconciliation & Lock */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:px-6 sm:py-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-canvas/40">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-title-section text-ink flex items-center gap-2">
                    <Sliders size={18} className="text-brand" />
                    3. Daily Reconciliation &amp; Lock
                  </h2>
                  {closing?.locked ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-success-bg text-success border border-success-border">
                      <Lock size={12} />
                      Locked &amp; Reconciled
                    </span>
                  ) : (
                    <span className="badge-neutral">Open for Reconciliation</span>
                  )}
                </div>
                <p className="text-helper-xs text-muted">
                  Physical count and actual figures are recorded for a specific day: <strong>{formatDate(reconcileDate)}</strong>. Locking updates the real values for this day and anchors opening stock forward.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="text-xs text-muted font-medium whitespace-nowrap">Reference Date:</label>
                <DatePicker value={reconcileDate} onChange={handleReconcileDateChange} />
              </div>
            </div>

            {isClosingLoading ? (
              <div className="p-8 flex items-center justify-center text-muted gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading day reconciliation data...</span>
              </div>
            ) : (
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
                      disabled={closing?.locked}
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
                        disabled={closing?.locked}
                        value={
                          actualRevenueInput !== ''
                            ? actualRevenueInput
                            : closing?.locked
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
                        disabled={closing?.locked}
                        value={
                          actualExpensesInput !== ''
                            ? actualExpensesInput
                            : closing?.locked
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
                      disabled={closing?.locked}
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
                  {closing?.locked ? (
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
            )}
          </div>

          {/* SECTION 4: Borrowed Eggs & Money Ledger — Mark as Paid */}
          <div className="card overflow-hidden">
            <div className="p-4 sm:px-6 sm:py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-title-section text-ink">
                  4. Borrowed Eggs & Money — Change Status to Paid
                </h2>
                <p className="text-xs text-muted">
                  When a customer pays their borrowed balance, click <strong>Mark as Paid</strong> to add it to Money We Have.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                {(
                  [
                    { key: 'unpaid', label: `Yet to be Paid (${allBorrowedSales.filter((b) => !b.paid).length})` },
                    { key: 'paid', label: `Paid (${allBorrowedSales.filter((b) => b.paid).length})` },
                    { key: 'all', label: `All (${allBorrowedSales.length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setBorrowedFilter(tab.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      borrowedFilter === tab.key
                        ? 'bg-brand text-white'
                        : 'bg-canvas text-muted hover:text-ink border border-border'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredBorrowed.length === 0 ? (
              <div className="p-8 text-center text-muted text-sm">
                {borrowedFilter === 'unpaid'
                  ? 'No unpaid borrowed records! All credit sales have been settled.'
                  : 'No borrowed records found for this filter.'}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-canvas border-b border-border">
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Date
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Debtor / Note
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Eggs Borrowed
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Amount
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
                        Status
                      </th>
                      <th className="py-3 px-4 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {filteredBorrowed.map((ev) => (
                      <tr key={ev.id} className="hover:bg-canvas/50 transition-colors">
                        <td className="py-3.5 px-4 whitespace-nowrap text-muted tabular-nums">
                          {formatDate(ev.business_date)}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-ink">
                          {ev.note || 'Borrowed sale'}
                          <span className="block text-xs text-muted font-normal">
                            Logged by {ev.user_name || `User #${ev.user_id}`}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                          {formatEggs(ev.eggs, perCrate)}{' '}
                          <span className="text-xs text-muted">({ev.eggs} eggs)</span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-bold text-ink tabular-nums whitespace-nowrap">
                          {formatMoney(Number(ev.amount ?? 0))}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {ev.paid ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-success-bg text-success border border-success-border">
                              <CheckCircle2 size={12} />
                              Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-warn-bg text-warn border border-warn/40">
                              <Clock size={12} />
                              Yet to be Paid
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          {!ev.paid ? (
                            <button
                              type="button"
                              onClick={() => markPaidMutation.mutate(ev.id)}
                              disabled={markPaidMutation.isPending}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-success text-white text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
                              Mark as Paid
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => markUnpaidMutation.mutate(ev.id)}
                              disabled={markUnpaidMutation.isPending}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border bg-card text-muted hover:text-ink text-xs font-medium transition-colors"
                              title="Revert status to Unpaid"
                            >
                              <RotateCcw size={12} />
                              Mark Unpaid
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
              Locking <strong>{formatDate(reconcileDate)}</strong> will record the following authoritative actuals:
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
              Are you sure you want to unlock <strong>{formatDate(reconcileDate)}</strong>?
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
