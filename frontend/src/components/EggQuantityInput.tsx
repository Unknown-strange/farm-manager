import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import { toEggs, fromEggs } from '@/lib/eggs'

interface EggQuantityInputProps {
  /** Total eggs value (single integer) */
  value: number
  onChange: (totalEggs: number) => void
  perCrate: number
  error?: string
  disabled?: boolean
}

export function EggQuantityInput({
  value,
  onChange,
  perCrate,
  error,
  disabled,
}: EggQuantityInputProps) {
  const id = useId()
  const { crates, eggs } = fromEggs(value, perCrate)

  const update = (newCrates: number, newEggs: number) => {
    let c = Math.max(0, newCrates)
    let e = Math.max(0, newEggs)
    // Auto-convert overflow eggs → crates
    if (e >= perCrate) {
      c += Math.floor(e / perCrate)
      e = e % perCrate
    }
    onChange(toEggs(c, e, perCrate))
  }

  return (
    <div className="space-y-1.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Crates stepper */}
        <div className="space-y-1">
          <label htmlFor={`${id}-crates`} className="block text-label-sm text-muted">
            Crates
          </label>
          <div className="flex items-center h-[44px] border border-border rounded bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => update(crates - 1, eggs)}
              disabled={disabled || crates <= 0}
              className="w-11 h-full flex-shrink-0 flex items-center justify-center text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <input
              id={`${id}-crates`}
              type="number"
              min={0}
              value={crates}
              onChange={(e) => update(parseInt(e.target.value) || 0, eggs)}
              disabled={disabled}
              className="flex-1 min-w-0 h-full text-center text-body-default text-ink tabular-nums outline-none bg-transparent border-x border-border"
            />
            <button
              type="button"
              onClick={() => update(crates + 1, eggs)}
              disabled={disabled}
              className="w-11 h-full flex-shrink-0 flex items-center justify-center text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        {/* Eggs stepper */}
        <div className="space-y-1">
          <label htmlFor={`${id}-eggs`} className="block text-label-sm text-muted">
            Eggs
          </label>
          <div className="flex items-center h-[44px] border border-border rounded bg-card overflow-hidden">
            <button
              type="button"
              onClick={() => update(crates, eggs - 1)}
              disabled={disabled || eggs <= 0}
              className="w-11 h-full flex-shrink-0 flex items-center justify-center text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <input
              id={`${id}-eggs`}
              type="number"
              min={0}
              max={perCrate - 1}
              value={eggs}
              onChange={(e) => update(crates, parseInt(e.target.value) || 0)}
              disabled={disabled}
              className="flex-1 min-w-0 h-full text-center text-body-default text-ink tabular-nums outline-none bg-transparent border-x border-border"
            />
            <button
              type="button"
              onClick={() => update(crates, eggs + 1)}
              disabled={disabled}
              className="w-11 h-full flex-shrink-0 flex items-center justify-center text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Live helper */}
      <p className="text-helper-xs text-muted tabular-nums">
        = {toEggs(crates, eggs, perCrate)} eggs total
      </p>

      {error && <p className="text-helper-xs text-danger">{error}</p>}
    </div>
  )
}
