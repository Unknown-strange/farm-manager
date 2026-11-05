import { useEffect, useId, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { toEggs, fromEggs, formatEggs } from '@/lib/eggs'

interface EggQuantityInputProps {
  /** Total eggs value (single integer) */
  value: number
  onChange: (totalEggs: number) => void
  perCrate: number
  error?: string
  disabled?: boolean
}

/** Parse a raw input string into a non-negative integer (empty → 0). */
const toCount = (raw: string): number => {
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** Show 0 as an empty box so typing doesn't produce "05", "012", etc. */
const toText = (n: number): string => (n > 0 ? String(n) : '')

/**
 * Crates + loose eggs input.
 *
 * The Crates and Eggs boxes are kept exactly as the user typed them — nothing is moved
 * between the two boxes while typing. Only the combined total
 * (crates × perCrate + eggs) is reported to the parent, and that single total is what
 * gets saved. Converting the total back into "X crates + Y eggs" happens when the saved
 * value is displayed (see formatEggs).
 */
export function EggQuantityInput({
  value,
  onChange,
  perCrate,
  error,
  disabled,
}: EggQuantityInputProps) {
  const id = useId()

  const initial = fromEggs(value, perCrate)
  const [cratesText, setCratesText] = useState<string>(toText(initial.crates))
  const [eggsText, setEggsText] = useState<string>(toText(initial.eggs))

  // Last total we reported to the parent. Used to tell apart "the parent echoed our own
  // change back" (keep the boxes as typed) from "the parent changed the value externally"
  // (e.g. form reset after save, or a record loaded for editing → re-split the total).
  const lastEmitted = useRef<number>(value)

  useEffect(() => {
    if (value !== lastEmitted.current) {
      const { crates, eggs } = fromEggs(value, perCrate)
      setCratesText(toText(crates))
      setEggsText(toText(eggs))
      lastEmitted.current = value
    }
  }, [value, perCrate])

  const crates = toCount(cratesText)
  const eggs = toCount(eggsText)
  const total = toEggs(crates, eggs, perCrate)

  const emit = (nextCratesText: string, nextEggsText: string) => {
    setCratesText(nextCratesText)
    setEggsText(nextEggsText)
    const nextTotal = toEggs(toCount(nextCratesText), toCount(nextEggsText), perCrate)
    lastEmitted.current = nextTotal
    onChange(nextTotal)
  }

  // Keep only digits so "-" / "e" / "." can't sneak in
  const clean = (raw: string) => raw.replace(/\D/g, '')

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
              onClick={() => emit(toText(Math.max(0, crates - 1)), eggsText)}
              disabled={disabled || crates <= 0}
              className="w-11 h-full flex-shrink-0 flex items-center justify-center text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <input
              id={`${id}-crates`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={cratesText}
              onChange={(e) => emit(clean(e.target.value), eggsText)}
              disabled={disabled}
              className="flex-1 min-w-0 h-full text-center text-body-default text-ink tabular-nums outline-none bg-transparent border-x border-border"
            />
            <button
              type="button"
              onClick={() => emit(String(crates + 1), eggsText)}
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
              onClick={() => emit(cratesText, toText(Math.max(0, eggs - 1)))}
              disabled={disabled || eggs <= 0}
              className="w-11 h-full flex-shrink-0 flex items-center justify-center text-muted hover:bg-canvas hover:text-ink transition-colors disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <input
              id={`${id}-eggs`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="0"
              value={eggsText}
              onChange={(e) => emit(cratesText, clean(e.target.value))}
              disabled={disabled}
              className="flex-1 min-w-0 h-full text-center text-body-default text-ink tabular-nums outline-none bg-transparent border-x border-border"
            />
            <button
              type="button"
              onClick={() => emit(cratesText, String(eggs + 1))}
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
        = {total} eggs total
        {eggs >= perCrate && total > 0 && (
          <> · will be saved as {formatEggs(total, perCrate)}</>
        )}
      </p>

      {error && <p className="text-helper-xs text-danger">{error}</p>}
    </div>
  )
}
