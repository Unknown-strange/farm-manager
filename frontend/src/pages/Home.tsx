import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShoppingBag,
  PackagePlus,
  AlertOctagon,
  Receipt,
  CheckCircle2,
  Wallet,
  Pencil,
  Ban,
  ArrowRight,
  Info,
  Loader2,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { StatCard } from '@/components/StatCard'
import { TypeTag } from '@/components/TypeTag'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EggQuantityInput } from '@/components/EggQuantityInput'
import { CurrencyInput } from '@/components/CurrencyInput'
import { useToast } from '@/components/Toast'
import { useCan } from '@/auth/useCan'
import { eventsApi, type EggEvent } from '@/api/events'
import { summaryApi } from '@/api/summary'
import { settingsApi } from '@/api/settings'
import { formatEggs } from '@/lib/eggs'
import { formatMoney } from '@/lib/money'
import { todayString, formatDate, formatTime } from '@/lib/dates'

export function Home() {
  const today = todayString()
  const toast = useToast()
  const queryClient = useQueryClient()
  const canEditOwn = useCan('events:edit_own')
  const canVoidOwn = useCan('events:void_own')
  const canCreateEvents = useCan('events:create')
  const canCreateExpenses = useCan('expenses:create')

  const [editingEvent, setEditingEvent] = useState<EggEvent | null>(null)
  const [editEggs, setEditEggs] = useState(0)
  const [editAmount, setEditAmount] = useState('')
  const [editNote, setEditNote] = useState('')
  const [voidingEvent, setVoidingEvent] = useState<EggEvent | null>(null)

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  })
  const perCrate = settings?.eggs_per_crate ?? 30

  const { data: mySummary } = useQuery({
    queryKey: ['my-summary', today],
    queryFn: () => summaryApi.getMySummary(today),
  })

  const { data: todayEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events', { date: today }],
    queryFn: () => eventsApi.getEvents({ date: today }),
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; eggs: number; amount?: number | null; note?: string }) =>
      eventsApi.updateEvent(payload.id, {
        eggs: payload.eggs,
        amount: payload.amount,
        note: payload.note,
      }),
    onSuccess: () => {
      toast('Entry updated', 'success')
      setEditingEvent(null)
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['my-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to update entry'
      toast(msg, 'error')
    },
  })

  const voidMutation = useMutation({
    mutationFn: (id: number) => eventsApi.voidEvent(id),
    onSuccess: () => {
      toast('Entry voided', 'info')
      setVoidingEvent(null)
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['my-summary'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
      queryClient.invalidateQueries({ queryKey: ['period-summary'] })
      queryClient.invalidateQueries({ queryKey: ['daily-book'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to void entry'
      toast(msg, 'error')
    },
  })

  const openEditModal = (ev: EggEvent) => {
    setEditingEvent(ev)
    setEditEggs(ev.eggs)
    setEditAmount(ev.amount != null ? String(ev.amount) : '')
    setEditNote(ev.note ?? '')
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvent) return
    if (editEggs <= 0) {
      toast('Quantity must be greater than 0', 'error')
      return
    }
    updateMutation.mutate({
      id: editingEvent.id,
      eggs: editEggs,
      amount: editingEvent.type === 'sold' ? parseFloat(editAmount) || 0 : undefined,
      note: editNote,
    })
  }

  const allActionCards = [
    {
      to: '/sale',
      title: 'Record Sale',
      desc: 'Enter crates or single eggs sold to customers',
      cta: 'New entry',
      icon: ShoppingBag,
      tint: 'bg-success-bg text-success',
      ctaColor: 'text-brand',
      permission: canCreateEvents,
    },
    {
      to: '/received',
      title: 'Eggs Received',
      desc: 'Log fresh harvest collected from poultry pens',
      cta: 'Log harvest',
      icon: PackagePlus,
      tint: 'bg-intake-bg text-intake',
      ctaColor: 'text-intake',
      permission: canCreateEvents,
    },
    {
      to: '/cracked',
      title: 'Cracked Eggs',
      desc: 'Record damaged or broken stock during handling',
      cta: 'Report loss',
      icon: AlertOctagon,
      tint: 'bg-danger-bg text-danger',
      ctaColor: 'text-danger',
      permission: canCreateEvents,
    },
    {
      to: '/expense',
      title: 'Add Expense',
      desc: 'Log daily feed, transport, or supply costs',
      cta: 'Log cost',
      icon: Receipt,
      tint: 'bg-brand-tint text-brand',
      ctaColor: 'text-ink',
      permission: canCreateExpenses,
    },
  ]
  const actionCards = allActionCards.filter((c) => c.permission)

  return (
    <>
      <TopBar
        title="Home"
        right={
          <span className="text-body-medium text-muted hidden sm:inline">
            Today · {formatDate(today)}
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 space-y-6 sm:space-y-8">
        <div className="max-w-page mx-auto space-y-6 sm:space-y-8">
          {/* Quick Actions Grid */}
          <section>
            <div className="mb-4">
              <h2 className="text-title-section text-ink">Quick Actions</h2>
              <p className="text-body-default text-muted">
                {actionCards.length > 0
                  ? 'Select an operation to record to today\'s farm ledger'
                  : 'Your account access rights'}
              </p>
            </div>

            {actionCards.length === 0 ? (
              <div className="card p-6 bg-brand-tint/20 border border-brand/40 flex items-start gap-3.5">
                <Info size={22} className="text-brand flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-base font-semibold text-ink">View-Only Access</h3>
                  <p className="text-xs text-muted mt-1 leading-relaxed">
                    Your account is configured with view-only permissions. You can view daily egg sales, shift totals, and entries below without recording transactions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                {actionCards.map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="group card p-6 hover:border-brand transition-all flex flex-col justify-between min-h-[168px]"
                    >
                      <div className="flex items-start justify-between">
                        <div
                          className={`w-11 h-11 rounded-md ${item.tint} flex items-center justify-center`}
                        >
                          <Icon size={22} />
                        </div>
                        <ArrowRight
                          size={18}
                          className="text-muted group-hover:text-brand group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                      <div className="mt-4">
                        <h3 className="text-base font-semibold text-ink mb-1">{item.title}</h3>
                        <p className="text-xs text-muted leading-relaxed">{item.desc}</p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                        <span className={`text-xs font-semibold ${item.ctaColor}`}>{item.cta}</span>
                        <span className="text-xs text-muted">→</span>
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* Shift Summary (2 Cards) */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <StatCard
              label="Sales recorded today"
              value={String(mySummary?.sales_count ?? 0)}
              helper="Completed customer transactions"
              icon={<CheckCircle2 size={20} />}
              variant="neutral"
            />
            <StatCard
              label="Your sales total"
              value={formatMoney(Number(mySummary?.sales_total ?? 0))}
              helper="Gross amount collected on your shift"
              icon={<Wallet size={20} />}
              variant="success"
            />
          </section>

          {/* Today's Activity Log */}
          <section className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-title-section text-ink">My entries today</h2>
                <p className="text-xs text-muted">
                  Recent logs submitted under your account during this shift
                </p>
              </div>
              <Link
                to="/my-entries"
                className="text-label-sm text-brand hover:text-brand-hover flex items-center gap-1"
              >
                View all my entries
                <ArrowRight size={14} />
              </Link>
            </div>

            {eventsLoading ? (
              <div className="py-12 flex items-center justify-center text-muted gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading today&apos;s entries...</span>
              </div>
            ) : todayEvents.length === 0 ? (
              <div className="py-12 text-center text-muted text-body-default">
                No entries recorded yet today. Choose a Quick Action above to start.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-canvas border-b border-border">
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Time
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Type
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Quantity (Crates + Eggs)
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Amount
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Note
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {todayEvents.map((ev) => (
                      <tr
                        key={ev.id}
                        className={`hover:bg-canvas/60 transition-colors ${ev.voided ? 'opacity-50 line-through' : ''
                          }`}
                      >
                        <td className="py-3.5 px-6 text-muted tabular-nums whitespace-nowrap">
                          {formatTime(ev.occurred_at)}
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <TypeTag type={ev.type} />
                        </td>
                        <td className="py-3.5 px-6 font-medium text-ink tabular-nums">
                          {formatEggs(ev.eggs, perCrate)}{' '}
                          <span className="text-xs text-muted font-normal">
                            ({ev.eggs} eggs)
                          </span>
                        </td>
                        <td className="py-3.5 px-6 text-right font-semibold text-ink tabular-nums whitespace-nowrap">
                          {ev.type === 'sold' && ev.amount != null
                            ? formatMoney(Number(ev.amount))
                            : '—'}
                        </td>
                        <td className="py-3.5 px-6 text-muted max-w-xs truncate">
                          {ev.note || '—'}
                        </td>
                        <td className="py-3.5 px-6 text-right whitespace-nowrap">
                          {ev.voided ? (
                            <span className="badge-neutral">Voided</span>
                          ) : (
                            <div className="inline-flex items-center gap-3">
                              {canEditOwn && (
                                <button
                                  onClick={() => openEditModal(ev)}
                                  className="text-xs font-semibold text-brand hover:underline inline-flex items-center gap-1"
                                >
                                  <Pencil size={13} />
                                  Edit
                                </button>
                              )}
                              {canVoidOwn && (
                                <button
                                  onClick={() => setVoidingEvent(ev)}
                                  className="text-xs font-semibold text-danger hover:underline inline-flex items-center gap-1"
                                >
                                  <Ban size={13} />
                                  Void
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Bottom Helper Banner */}
          <div className="bg-brand-tint/70 border border-brand/20 rounded-md p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded bg-brand/15 text-brand flex items-center justify-center flex-shrink-0">
                <Info size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-ink">Crate Reference Standard</p>
                <p className="text-xs text-muted">
                  All crate calculations automatically use standard{' '}
                  <strong>{perCrate}-egg trays</strong>. Loose eggs are added on top of full crate
                  counts.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-brand bg-card px-3 py-1.5 rounded border border-brand/20">
              <span>1 Crate = {perCrate} Eggs</span>
              <span className="text-border">|</span>
              <span>1/2 Crate = {Math.floor(perCrate / 2)} Eggs</span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        title="Edit Entry"
      >
        {editingEvent && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <span className="block text-label-sm text-ink mb-1.5">Quantity</span>
              <EggQuantityInput
                value={editEggs}
                onChange={setEditEggs}
                perCrate={perCrate}
              />
            </div>

            {editingEvent.type === 'sold' && (
              <CurrencyInput
                label="Amount received (GH₵)"
                value={editAmount}
                onChange={setEditAmount}
                required
              />
            )}

            <div>
              <label className="block text-label-sm text-ink mb-1.5">Note (optional)</label>
              <input
                type="text"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="input-base"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="btn-outline"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="btn-primary"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Void Confirmation */}
      <ConfirmDialog
        isOpen={!!voidingEvent}
        onClose={() => setVoidingEvent(null)}
        onConfirm={() => {
          if (voidingEvent) voidMutation.mutate(voidingEvent.id)
        }}
        title="Void Entry"
        message="Void this entry? It will stay visible as voided and will no longer count toward today's totals."
        confirmLabel="Void Entry"
        isLoading={voidMutation.isPending}
      />
    </>
  )
}
