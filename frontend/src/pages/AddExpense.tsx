import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Receipt, CheckCircle, RotateCcw, Loader2, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { CurrencyInput } from '@/components/CurrencyInput'
import { useToast } from '@/components/Toast'
import { expensesApi } from '@/api/expenses'
import { todayString, formatDate } from '@/lib/dates'

interface UndoState {
  id: number
  undoUntilMs: number
  remainingSec: number
}

export function AddExpense() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const today = todayString()

  const [category, setCategory] = useState<'feed' | 'crates' | 'other'>('feed')
  const [isBorrowed, setIsBorrowed] = useState<boolean>(false)
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [amount, setAmount] = useState('')
  const [errors, setErrors] = useState<{ name?: string; amount?: string }>({})
  const [undoState, setUndoState] = useState<UndoState | null>(null)

  // Countdown effect for Undo banner
  useEffect(() => {
    if (!undoState) return
    const timer = setInterval(() => {
      const rem = Math.max(0, Math.ceil((undoState.undoUntilMs - Date.now()) / 1000))
      if (rem <= 0) {
        setUndoState(null)
      } else {
        setUndoState((prev) => (prev ? { ...prev, remainingSec: rem } : null))
      }
    }, 500)
    return () => clearInterval(timer)
  }, [undoState])

  const createMutation = useMutation({
    mutationFn: () =>
      expensesApi.createExpense({
        category,
        name:
          category === 'feed'
            ? name.trim() || 'Feed'
            : category === 'crates'
              ? name.trim() || 'Crates'
              : name.trim(),
        quantity: quantity.trim() || undefined,
        amount: parseFloat(amount),
        is_borrowed: isBorrowed,
      }),
    onSuccess: (res) => {
      const catLabel = category === 'feed' ? 'Feed' : category === 'crates' ? 'Crates' : 'Expense'
      toast(
        isBorrowed
          ? `Borrowed ${catLabel} saved (adds to ${catLabel} total, pending settlement in Summary)`
          : `${catLabel} expense saved and deducted from cash`,
        'success',
      )
      setName('')
      setQuantity('')
      setAmount('')
      setIsBorrowed(false)
      setErrors({})
      const undoUntilMs = new Date(res.undo_until).getTime()
      const remainingSec = Math.max(1, Math.ceil((undoUntilMs - Date.now()) / 1000))
      setUndoState({ id: res.id, undoUntilMs, remainingSec })
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to save expense'
      toast(msg, 'error')
    },
  })

  const undoMutation = useMutation({
    mutationFn: (id: number) => expensesApi.undoExpense(id),
    onSuccess: () => {
      toast('Expense undone and voided', 'info')
      setUndoState(null)
      queryClient.invalidateQueries({ queryKey: ['expenses'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Undo window expired'
      toast(msg, 'error')
      setUndoState(null)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { name?: string; amount?: string } = {}
    if (category === 'other' && !name.trim()) {
      newErrors.name = 'Item name is required for Other expenses'
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      newErrors.amount = 'Please enter a valid expense amount'
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }
    setErrors({})
    createMutation.mutate()
  }

  return (
    <>
      <TopBar
        title="Add Expense"
        right={
          <span className="text-body-medium text-muted hidden sm:inline">
            Today · {formatDate(today)}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-form mx-auto space-y-4">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="inline-flex items-center gap-1.5 text-label-sm text-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>

          {/* Undo Banner (Blind-create window for staff) */}
          {undoState && (
            <div className="bg-success-bg border border-success/30 rounded-md px-4 sm:px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle size={20} className="text-success flex-shrink-0" />
                <div>
                  <p className="text-body-medium text-ink">Expense saved to today&apos;s ledger</p>
                  <p className="text-helper-xs text-muted">
                    Made a mistake? You can undo this entry for the next{' '}
                    <strong className="tabular-nums">{undoState.remainingSec}s</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => undoMutation.mutate(undoState.id)}
                disabled={undoMutation.isPending}
                className="btn-outline h-9 px-3 text-xs border-success/40 text-success hover:bg-card w-full sm:w-auto"
              >
                <RotateCcw size={14} />
                Undo ({undoState.remainingSec}s)
              </button>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-brand-tint/60 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-brand-tint text-brand flex items-center justify-center flex-shrink-0">
                <Receipt size={20} />
              </div>
              <div>
                <h2 className="text-title-section text-ink">Record Farm Expense</h2>
                <p className="text-helper-xs text-muted">
                  Log feed purchases, transport, or operational costs
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6" noValidate>
              {/* 1. Main Category Control */}
              <div>
                <label className="block text-label-sm text-ink mb-2">1. Expense Category</label>
                <div className="grid grid-cols-3 gap-2 p-1 bg-canvas rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('feed')
                      setErrors((p) => ({ ...p, name: undefined }))
                    }}
                    className={`h-11 rounded text-label-sm font-semibold transition-all ${
                      category === 'feed'
                        ? 'bg-card text-brand shadow-card border border-border'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    Feed Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCategory('crates')
                      setErrors((p) => ({ ...p, name: undefined }))
                    }}
                    className={`h-11 rounded text-label-sm font-semibold transition-all ${
                      category === 'crates'
                        ? 'bg-card text-brand shadow-card border border-border'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    Crates Expense
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategory('other')}
                    className={`h-11 rounded text-label-sm font-semibold transition-all ${
                      category === 'other'
                        ? 'bg-card text-brand shadow-card border border-border'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    Other Expense
                  </button>
                </div>
              </div>

              {/* 2. Sub-Category / Payment Status Control */}
              <div>
                <label className="block text-label-sm text-ink mb-1.5">
                  2. Sub-Category / Payment Status
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-canvas rounded-md border border-border">
                  <button
                    type="button"
                    onClick={() => setIsBorrowed(false)}
                    className={`py-2 px-3 rounded text-xs font-semibold border text-center transition-all ${
                      !isBorrowed
                        ? 'bg-success text-white border-success shadow-sm'
                        : 'bg-card text-muted border-border hover:text-ink'
                    }`}
                  >
                    {category === 'feed' ? 'Paid Feed' : category === 'crates' ? 'Paid Crates' : 'Paid Expense'} (Paid Now)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBorrowed(true)}
                    className={`py-2 px-3 rounded text-xs font-semibold border text-center transition-all ${
                      isBorrowed
                        ? 'bg-warn text-white border-warn shadow-sm'
                        : 'bg-card text-muted border-border hover:text-ink'
                    }`}
                  >
                    {category === 'feed' ? 'Borrowed Feed' : category === 'crates' ? 'Borrowed Crates' : 'Borrowed Expense'} (On Credit)
                  </button>
                </div>
              </div>

              {isBorrowed ? (
                <div className="bg-warn-bg/40 border border-warn/40 rounded-md px-3.5 py-2.5 text-xs text-ink">
                  <strong className="text-warn">
                    Borrowed {category === 'feed' ? 'Feed' : category === 'crates' ? 'Crates' : 'Expense'} (Credit):
                  </strong>{' '}
                  This is included in your <strong>{category === 'feed' ? 'Feed' : category === 'crates' ? 'Crates' : 'Total'} Expenses</strong>, but will{' '}
                  <strong>not</strong> be deducted from Money We Have until marked as <strong>Paid</strong> in the Summary or Manual Entry page.
                </div>
              ) : (
                <div className="bg-success-bg/40 border border-success/30 rounded-md px-3.5 py-2 text-xs text-ink">
                  <span className="text-success font-semibold">Immediate Cash Payment:</span> Deducted from Money We Have upon saving.
                </div>
              )}

              {/* Item Name (Required for Other, Optional for Feed & Crates) */}
              <div>
                <label htmlFor="expense-name" className="block text-label-sm text-ink mb-1.5">
                  Item Description {category === 'other' ? <span className="text-danger">*</span> : <span className="text-muted font-normal">(optional)</span>}
                </label>
                <input
                  id="expense-name"
                  type="text"
                  placeholder={
                    category === 'feed'
                      ? 'e.g. Grower Mash, Layer Mash, Starter (Default: Feed)'
                      : category === 'crates'
                        ? 'e.g. Plastic Crates, Paper Trays (Default: Crates)'
                        : 'e.g. Fuel, Staff Food, Vet Medication'
                  }
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (e.target.value.trim()) setErrors((p) => ({ ...p, name: undefined }))
                  }}
                  className={`input-base ${errors.name ? 'input-error' : ''}`}
                />
                {errors.name && <p className="text-helper-xs text-danger mt-1">{errors.name}</p>}
              </div>

              {/* Quantity */}
              <div>
                <label htmlFor="expense-qty" className="block text-label-sm text-ink mb-1.5">
                  Quantity / Unit <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="expense-qty"
                  type="text"
                  placeholder={
                    category === 'feed'
                      ? 'e.g. 5 bags (50kg)'
                      : category === 'crates'
                        ? 'e.g. 50 empty crates'
                        : 'e.g. 10 litres / 2 packs'
                  }
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="input-base"
                />
              </div>

              {/* Amount */}
              <CurrencyInput
                label="Amount Spent (GH₵) *"
                placeholder="0.00"
                value={amount}
                onChange={(val) => {
                  setAmount(val)
                  setErrors((p) => ({ ...p, amount: undefined }))
                }}
                error={errors.amount}
              />

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setName('')
                    setQuantity('')
                    setAmount('')
                    setErrors({})
                  }}
                  className="btn-outline w-full sm:w-auto"
                >
                  Clear
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary w-full sm:w-auto sm:min-w-[160px]"
                >
                  {createMutation.isPending ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      Save Expense
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  )
}

