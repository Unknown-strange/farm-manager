import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PackagePlus, CheckCircle, Loader2, ArrowLeft } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { EggQuantityInput } from '@/components/EggQuantityInput'
import { useToast } from '@/components/Toast'
import { eventsApi } from '@/api/events'
import { settingsApi } from '@/api/settings'
import { formatEggs } from '@/lib/eggs'
import { todayString, formatDate } from '@/lib/dates'

export function EggsReceived() {
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()
  const today = todayString()

  const [eggs, setEggs] = useState(0)
  const [note, setNote] = useState('')
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [error, setError] = useState<string | undefined>()

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.getSettings,
  })
  const perCrate = settings?.eggs_per_crate ?? 30

  const createMutation = useMutation({
    mutationFn: () =>
      eventsApi.createEvent(
        {
          type: 'received',
          eggs,
          note: note.trim() || undefined,
        },
        idempotencyKey,
      ),
    onSuccess: () => {
      toast('Eggs received saved', 'success')
      setEggs(0)
      setNote('')
      setError(undefined)
      setIdempotencyKey(crypto.randomUUID())
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['summary'] })
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Failed to save received eggs'
      toast(msg, 'error')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (eggs <= 0) {
      setError('Please enter at least 1 egg or crate')
      return
    }
    setError(undefined)
    createMutation.mutate()
  }

  return (
    <>
      <TopBar
        title="Eggs Received"
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
            {/* Semantic Header */}
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-intake-bg/50 flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-intake-bg text-intake flex items-center justify-center flex-shrink-0">
                <PackagePlus size={20} />
              </div>
              <div>
                <h2 className="text-title-section text-ink">Log Harvest / Eggs Received</h2>
                <p className="text-helper-xs text-muted">
                  Adds freshly collected eggs to today&apos;s available farm stock
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6" noValidate>
              <div>
                <label className="block text-label-sm text-ink mb-2">
                  Quantity Received <span className="text-danger">*</span>
                </label>
                <EggQuantityInput
                  value={eggs}
                  onChange={(val) => {
                    setEggs(val)
                    if (val > 0) setError(undefined)
                  }}
                  perCrate={perCrate}
                  error={error}
                />
                {eggs > 0 && (
                  <p className="mt-1.5 text-helper-xs font-medium text-intake">
                    Adding {formatEggs(eggs, perCrate)} ({eggs} total eggs) to stock
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="received-note" className="block text-label-sm text-ink mb-1.5">
                  Source / Batch Note <span className="text-muted font-normal">(optional)</span>
                </label>
                <input
                  id="received-note"
                  type="text"
                  placeholder="e.g. Morning collection — Pen B"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="input-base"
                />
              </div>

              <div className="pt-2 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEggs(0)
                    setNote('')
                    setError(undefined)
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
                      Save Received
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

