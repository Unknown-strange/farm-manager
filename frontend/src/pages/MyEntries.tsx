import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Ban, Loader2, Banknote, PackagePlus, AlertOctagon } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { DatePicker } from '@/components/DatePicker'
import { StatCard } from '@/components/StatCard'
import { TypeTag } from '@/components/TypeTag'
import { Modal } from '@/components/Modal'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EggQuantityInput } from '@/components/EggQuantityInput'
import { CurrencyInput } from '@/components/CurrencyInput'
import { useToast } from '@/components/Toast'
import { useCan } from '@/auth/useCan'
import { eventsApi, type EggEvent } from '@/api/events'
import { settingsApi } from '@/api/settings'
import { formatEggs } from '@/lib/eggs'
import { formatMoney } from '@/lib/money'
import { todayString, formatDate, formatTime } from '@/lib/dates'

export function MyEntries() {
  const today = todayString()
  const [selectedDate, setSelectedDate] = useState(today)
  const toast = useToast()
  const queryClient = useQueryClient()

  const canEditOwn = useCan('events:edit_own')
  const canVoidOwn = useCan('events:void_own')
  const isToday = selectedDate === today

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

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events', { date: selectedDate }],
    queryFn: () => eventsApi.getEvents({ date: selectedDate }),
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

  const activeEvents = events.filter((e) => !e.voided)
  const myMoneyGained = activeEvents
    .filter((e) => e.type === 'sold' && e.paid !== false)
    .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
  const myBorrowedUnpaid = activeEvents
    .filter((e) => e.type === 'sold' && e.is_borrowed && e.paid === false)
    .reduce((sum, e) => sum + Number(e.amount ?? 0), 0)
  const myEggsGotten = activeEvents
    .filter((e) => e.type === 'received')
    .reduce((sum, e) => sum + e.eggs, 0)
  const myCrackedEggs = activeEvents
    .filter((e) => e.type === 'cracked')
    .reduce((sum, e) => sum + e.eggs, 0)

  return (
    <>
      <TopBar
        title="My Entries"
        right={
          <DatePicker
            label="Business Date:"
            value={selectedDate}
            onChange={setSelectedDate}
          />
        }
      />

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <div className="max-w-page mx-auto space-y-5 sm:space-y-6">
          {/* Daily Totals Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5">
            <StatCard
              label="Total Money Gained in Day"
              value={formatMoney(myMoneyGained)}
              helper={
                myBorrowedUnpaid > 0
                  ? `Cash received (+ ${formatMoney(myBorrowedUnpaid)} borrowed unpaid)`
                  : 'Paid sales recorded today'
              }
              icon={<Banknote size={20} />}
              variant="success"
            />
            <StatCard
              label="Total Eggs Gotten in Day"
              value={formatEggs(myEggsGotten, perCrate)}
              helper={`= ${myEggsGotten} eggs received`}
              icon={<PackagePlus size={20} />}
              variant="neutral"
            />
            <StatCard
              label="Total Cracked Eggs"
              value={formatEggs(myCrackedEggs, perCrate)}
              helper={`= ${myCrackedEggs} cracked eggs`}
              icon={<AlertOctagon size={20} />}
              variant="danger"
            />
          </div>

          <div className="card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-title-section text-ink">
                  Entries for {formatDate(selectedDate)}
                </h2>
                <p className="text-xs text-muted">
                  {isToday
                    ? 'You can edit or void entries recorded during today’s shift.'
                    : 'Past-day entries are read-only for staff.'}
                </p>
              </div>
              <span className="badge-neutral">{events.length} entries</span>
            </div>

            {isLoading ? (
              <div className="py-12 flex items-center justify-center text-muted gap-2">
                <Loader2 size={18} className="animate-spin" />
                <span>Loading entries...</span>
              </div>
            ) : events.length === 0 ? (
              <div className="py-12 text-center text-muted text-body-default">
                No entries found for {formatDate(selectedDate)}.
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
                        Quantity
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Amount
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted">
                        Note
                      </th>
                      <th className="py-3 px-6 text-xs font-semibold uppercase tracking-wider text-muted text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-sm">
                    {events.map((ev) => (
                      <tr
                        key={ev.id}
                        className={`hover:bg-canvas/60 transition-colors ${
                          ev.voided ? 'opacity-50 line-through' : ''
                        }`}
                      >
                        <td className="py-3.5 px-6 text-muted tabular-nums whitespace-nowrap">
                          {formatTime(ev.occurred_at)}
                        </td>
                        <td className="py-3.5 px-6 whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <TypeTag type={ev.type} />
                            {ev.type === 'sold' && ev.is_borrowed && (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                                  ev.paid
                                    ? 'bg-success-bg text-success border-success-border'
                                    : 'bg-warn-bg text-warn border-warn/40'
                                }`}
                              >
                                {ev.paid ? 'Borrowed · Paid' : 'Borrowed · Unpaid'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-6 font-medium text-ink tabular-nums">
                          {formatEggs(ev.eggs, perCrate)}{' '}
                          <span className="text-xs text-muted font-normal">({ev.eggs} eggs)</span>
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
                          ) : isToday ? (
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
                          ) : (
                            <span className="text-xs text-muted">Locked</span>
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

