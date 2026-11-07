import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShoppingBag,
  CheckCircle,
  Loader2,
  ArrowLeft,
  Calculator,
  Minus,
  Plus,
  Package,
  Egg,
  Clock,
  Banknote,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { useToast } from '@/components/Toast'
import { eventsApi } from '@/api/events'
import { settingsApi } from '@/api/settings'
import { formatEggs } from '@/lib/eggs'
import { todayString, formatDate } from '@/lib/dates'

type SaleUnitMode = 'crates' | 'eggs'

export function RecordSale() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const today = todayString()

  // Mode switcher: 'crates' (number of crates + price per crate) vs 'eggs' (number of eggs + price per egg)
  const [unitMode, setUnitMode] = useState<SaleUnitMode>('crates')

  // Crates mode inputs
  const [crates, setCrates] = useState<string>('')
  const [pricePerCrate, setPricePerCrate] = useState<string>('')

  // Single Eggs mode inputs
  const [eggsInput, setEggsInput] = useState<string>('')
  const [pricePerEgg, setPricePerEgg] = useState<string>('')

  // Borrowed (not paid yet) toggle
  const [isBorrowed, setIsBorrowed] = useState<boolean>(false)

  // Customer / Note
  const [note, setNote] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [errors, setErrors] = useState<{ quantity?: string; price?: string; note?: string }>({})

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  })
  const perCrate = settings?.eggs_per_crate ?? 30

  const cratesCount = parseInt(crates, 10) || 0
  const eggsCount = parseInt(eggsInput, 10) || 0
  const unitPrice =
    unitMode === 'crates' ? parseFloat(pricePerCrate) || 0 : parseFloat(pricePerEgg) || 0

  // System multiplies both to get the total amount
  const calculatedAmount =
    unitMode === 'crates'
      ? cratesCount > 0 && unitPrice > 0
        ? Number((cratesCount * unitPrice).toFixed(2))
        : 0
      : eggsCount > 0 && unitPrice > 0
        ? Number((eggsCount * unitPrice).toFixed(2))
        : 0

  const totalEggs = unitMode === 'crates' ? cratesCount * perCrate : eggsCount

  const createMutation = useMutation({
    mutationFn: () =>
      eventsApi.createEvent(
        unitMode === 'crates'
          ? {
              type: 'sold',
              crates: cratesCount,
              price_per_crate: unitPrice,
              eggs: totalEggs,
              amount: calculatedAmount,
              is_borrowed: isBorrowed,
              note: note.trim() || undefined,
            }
          : {
              type: 'sold',
              eggs: totalEggs,
              price_per_egg: unitPrice,
              amount: calculatedAmount,
              is_borrowed: isBorrowed,
              note: note.trim() || undefined,
            },
        idempotencyKey,
      ),
    onSuccess: () => {
      const qtyLabel =
        unitMode === 'crates' ? `${cratesCount} crates` : `${eggsCount} eggs`
      const statusLabel = isBorrowed ? 'Recorded as Borrowed (Unpaid)' : 'Sale saved'
      toast(`${statusLabel}: ${qtyLabel} for GH₵ ${calculatedAmount.toFixed(2)}`, 'success')
      setCrates('')
      setPricePerCrate('')
      setEggsInput('')
      setPricePerEgg('')
      setIsBorrowed(false)
      setNote('')
      setErrors({})
      setIdempotencyKey(crypto.randomUUID())
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['my-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to save sale'
      toast(msg, 'error')
    },
  })

  const adjustQuantity = (delta: number) => {
    if (unitMode === 'crates') {
      const next = Math.max(0, cratesCount + delta)
      setCrates(next === 0 ? '' : String(next))
      if (next > 0) setErrors((prev) => ({ ...prev, quantity: undefined }))
    } else {
      const next = Math.max(0, eggsCount + delta)
      setEggsInput(next === 0 ? '' : String(next))
      if (next > 0) setErrors((prev) => ({ ...prev, quantity: undefined }))
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newErrors: { quantity?: string; price?: string; note?: string } = {}

    if (unitMode === 'crates') {
      if (cratesCount <= 0 || crates.trim() === '') {
        newErrors.quantity = 'Please enter at least 1 crate sold'
      }
      if (unitPrice <= 0 || pricePerCrate.trim() === '' || isNaN(unitPrice)) {
        newErrors.price = 'Please enter a valid price for one crate'
      }
    } else {
      if (eggsCount <= 0 || eggsInput.trim() === '') {
        newErrors.quantity = 'Please enter at least 1 egg sold'
      }
      if (unitPrice <= 0 || pricePerEgg.trim() === '' || isNaN(unitPrice)) {
        newErrors.price = 'Please enter a valid price for one egg'
      }
    }

    if (isBorrowed && !note.trim()) {
      newErrors.note = 'Please enter the customer name or note for a borrowed sale'
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
        title="Record Sale"
        right={
          <span className="text-body-medium text-muted hidden sm:inline">
            Today · {formatDate(today)}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-form mx-auto">
          <button
            type="button"
            onClick={() => navigate('/home')}
            className="inline-flex items-center gap-1.5 text-label-sm text-muted hover:text-ink mb-4 transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Home
          </button>

          <div className="card overflow-hidden">
            {/* Header Banner */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-success-bg/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-success-bg text-success flex items-center justify-center flex-shrink-0">
                <ShoppingBag size={20} />
              </div>
              <div>
                <h2 className="text-title-section text-ink">Customer Egg Sale</h2>
                <p className="text-helper-xs text-muted">
                  Sell by crates or individual eggs — total amount is multiplied automatically ({perCrate} eggs/crate)
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6" noValidate>
              {/* Unit Mode Switcher: Crates vs Individual Eggs */}
              <div>
                <span className="block text-label-sm font-semibold text-ink mb-2">
                  Sale Mode
                </span>
                <div className="grid grid-cols-2 gap-3 p-1 bg-canvas rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => {
                      setUnitMode('crates')
                      setErrors({})
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-all ${
                      unitMode === 'crates'
                        ? 'bg-card text-brand shadow-sm border border-border'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Package size={16} />
                    Sell by Crates
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUnitMode('eggs')
                      setErrors({})
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold transition-all ${
                      unitMode === 'eggs'
                        ? 'bg-card text-brand shadow-sm border border-border'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    <Egg size={16} />
                    Sell by Eggs (Each)
                  </button>
                </div>
              </div>

              {/* INPUT 1: Quantity (Crates OR Eggs) */}
              {unitMode === 'crates' ? (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="crates-input" className="block text-label-sm font-semibold text-ink">
                      Number of Crates <span className="text-danger">*</span>
                    </label>
                    <span className="text-helper-xs text-muted font-mono">{perCrate} EGGS / CRATE</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(-1)}
                      disabled={cratesCount <= 0}
                      className="w-11 h-11 flex items-center justify-center rounded border border-border bg-canvas hover:bg-card active:scale-95 transition-all text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Decrease crates"
                    >
                      <Minus size={18} />
                    </button>

                    <div className="flex-1 relative">
                      <input
                        id="crates-input"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 10"
                        value={crates}
                        onChange={(e) => {
                          const val = e.target.value
                          setCrates(val)
                          if (parseInt(val, 10) > 0) {
                            setErrors((prev) => ({ ...prev, quantity: undefined }))
                          }
                        }}
                        className={`input-base text-center font-bold text-lg tabular-nums ${
                          errors.quantity ? 'border-danger focus:border-danger' : ''
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => adjustQuantity(1)}
                      className="w-11 h-11 flex items-center justify-center rounded border border-border bg-canvas hover:bg-card active:scale-95 transition-all text-ink"
                      aria-label="Increase crates"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {errors.quantity && (
                    <p className="mt-1 text-helper-xs text-danger">{errors.quantity}</p>
                  )}

                  {cratesCount > 0 && (
                    <p className="mt-1.5 text-helper-xs font-medium text-success">
                      = {formatEggs(totalEggs, perCrate)} ({totalEggs} total eggs)
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label htmlFor="eggs-input" className="block text-label-sm font-semibold text-ink">
                      Number of Eggs <span className="text-danger">*</span>
                    </label>
                    <span className="text-helper-xs text-muted font-mono">INDIVIDUAL EGGS</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(-1)}
                      disabled={eggsCount <= 0}
                      className="w-11 h-11 flex items-center justify-center rounded border border-border bg-canvas hover:bg-card active:scale-95 transition-all text-ink disabled:opacity-40 disabled:cursor-not-allowed"
                      aria-label="Decrease eggs"
                    >
                      <Minus size={18} />
                    </button>

                    <div className="flex-1 relative">
                      <input
                        id="eggs-input"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="e.g. 15"
                        value={eggsInput}
                        onChange={(e) => {
                          const val = e.target.value
                          setEggsInput(val)
                          if (parseInt(val, 10) > 0) {
                            setErrors((prev) => ({ ...prev, quantity: undefined }))
                          }
                        }}
                        className={`input-base text-center font-bold text-lg tabular-nums ${
                          errors.quantity ? 'border-danger focus:border-danger' : ''
                        }`}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => adjustQuantity(1)}
                      className="w-11 h-11 flex items-center justify-center rounded border border-border bg-canvas hover:bg-card active:scale-95 transition-all text-ink"
                      aria-label="Increase eggs"
                    >
                      <Plus size={18} />
                    </button>
                  </div>

                  {errors.quantity && (
                    <p className="mt-1 text-helper-xs text-danger">{errors.quantity}</p>
                  )}

                  {eggsCount > 0 && (
                    <p className="mt-1.5 text-helper-xs font-medium text-success">
                      = {formatEggs(totalEggs, perCrate)} ({totalEggs} total eggs)
                    </p>
                  )}
                </div>
              )}

              {/* INPUT 2: Unit Price (Amount per 1 crate OR Amount per 1 egg) */}
              {unitMode === 'crates' ? (
                <div>
                  <label htmlFor="price-per-crate" className="block text-label-sm font-semibold text-ink mb-1.5">
                    Amount Sold 1 Crate At (GH₵) <span className="text-danger">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-muted font-bold pointer-events-none select-none text-sm">
                      GH₵
                    </div>
                    <input
                      id="price-per-crate"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 45.00"
                      value={pricePerCrate}
                      onChange={(e) => {
                        const val = e.target.value
                        setPricePerCrate(val)
                        if (parseFloat(val) > 0) {
                          setErrors((prev) => ({ ...prev, price: undefined }))
                        }
                      }}
                      className={`input-base pl-14 font-semibold text-base tabular-nums ${
                        errors.price ? 'border-danger focus:border-danger' : ''
                      }`}
                    />
                  </div>
                  {errors.price && (
                    <p className="mt-1 text-helper-xs text-danger">{errors.price}</p>
                  )}
                </div>
              ) : (
                <div>
                  <label htmlFor="price-per-egg" className="block text-label-sm font-semibold text-ink mb-1.5">
                    Amount Sold 1 Egg At (GH₵) <span className="text-danger">*</span>
                  </label>
                  <div className="relative flex items-center">
                    <div className="absolute left-3 text-muted font-bold pointer-events-none select-none text-sm">
                      GH₵
                    </div>
                    <input
                      id="price-per-egg"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 2.00"
                      value={pricePerEgg}
                      onChange={(e) => {
                        const val = e.target.value
                        setPricePerEgg(val)
                        if (parseFloat(val) > 0) {
                          setErrors((prev) => ({ ...prev, price: undefined }))
                        }
                      }}
                      className={`input-base pl-14 font-semibold text-base tabular-nums ${
                        errors.price ? 'border-danger focus:border-danger' : ''
                      }`}
                    />
                  </div>
                  {errors.price && (
                    <p className="mt-1 text-helper-xs text-danger">{errors.price}</p>
                  )}
                </div>
              )}

              {/* Payment Status: Paid Now vs Borrowed (Not Paid Yet) */}
              <div>
                <span className="block text-label-sm font-semibold text-ink mb-2">
                  Payment Status
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsBorrowed(false)
                      setErrors((prev) => ({ ...prev, note: undefined }))
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold border transition-all ${
                      !isBorrowed
                        ? 'bg-success-bg border-success text-success shadow-sm'
                        : 'bg-canvas border-border text-muted hover:text-ink'
                    }`}
                  >
                    <Banknote size={16} />
                    Paid Now (Cash)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsBorrowed(true)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-md text-xs font-semibold border transition-all ${
                      isBorrowed
                        ? 'bg-warn-bg border-warn text-warn shadow-sm'
                        : 'bg-canvas border-border text-muted hover:text-ink'
                    }`}
                  >
                    <Clock size={16} />
                    Borrowed (Not Paid Yet)
                  </button>
                </div>
                {isBorrowed && (
                  <p className="mt-1.5 text-helper-xs text-warn font-medium">
                    This sale will deduct eggs from stock now and record the money as owed (unpaid). Only an Admin can mark it as Paid in Summary.
                  </p>
                )}
              </div>

              {/* SYSTEM MULTIPLICATION & CALCULATED AMOUNT (READ-ONLY / NOT INPUTTED) */}
              <div
                className={`rounded-lg border p-4 space-y-2 ${
                  isBorrowed
                    ? 'border-warn/50 bg-warn-bg/40'
                    : 'border-success-border bg-success-bg/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-label-sm font-semibold text-ink flex items-center gap-1.5">
                    <Calculator size={16} className={isBorrowed ? 'text-warn' : 'text-success'} />
                    {isBorrowed ? 'Total Amount Borrowed (Owed)' : 'Total Amount Received'}
                  </span>
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider bg-white/80 px-2 py-0.5 rounded border ${
                      isBorrowed
                        ? 'text-warn border-warn/40'
                        : 'text-success border-success-border/60'
                    }`}
                  >
                    Calculated by System
                  </span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-display-stat-md font-bold text-ink tabular-nums">
                    GH₵ {calculatedAmount.toFixed(2)}
                  </span>
                </div>

                <div className="pt-1 border-t border-border/60 flex items-center justify-between text-xs text-muted">
                  <span className="font-mono">
                    {unitMode === 'crates'
                      ? `${cratesCount} crates × GH₵ ${unitPrice > 0 ? unitPrice.toFixed(2) : '0.00'} = GH₵ ${calculatedAmount.toFixed(2)}`
                      : `${eggsCount} eggs × GH₵ ${unitPrice > 0 ? unitPrice.toFixed(2) : '0.00'} = GH₵ ${calculatedAmount.toFixed(2)}`}
                  </span>
                  <span className="text-[11px] text-muted italic">
                    Not manually entered
                  </span>
                </div>
              </div>

              {/* Note / Customer */}
              <div>
                <label htmlFor="sale-note" className="block text-label-sm text-ink mb-1.5">
                  Customer / Note{' '}
                  {isBorrowed ? (
                    <span className="text-danger">* (required for borrowed sales)</span>
                  ) : (
                    <span className="text-muted font-normal">(optional)</span>
                  )}
                </label>
                <input
                  id="sale-note"
                  type="text"
                  placeholder={
                    isBorrowed
                      ? 'Enter customer name who borrowed the eggs (e.g. Auntie Ama)'
                      : 'e.g. Market buyer, Auntie Ama'
                  }
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value)
                    if (e.target.value.trim()) {
                      setErrors((prev) => ({ ...prev, note: undefined }))
                    }
                  }}
                  className={`input-base ${errors.note ? 'border-danger focus:border-danger' : ''}`}
                />
                {errors.note && (
                  <p className="mt-1 text-helper-xs text-danger">{errors.note}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setCrates('')
                    setPricePerCrate('')
                    setEggsInput('')
                    setPricePerEgg('')
                    setIsBorrowed(false)
                    setNote('')
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
                      {isBorrowed ? 'Save Borrowed Sale' : 'Save Sale'}
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
