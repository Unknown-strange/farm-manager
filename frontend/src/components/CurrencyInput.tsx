import { useId } from 'react'
import { type InputHTMLAttributes } from 'react'

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string
  onChange: (value: string) => void
  error?: string
  label?: string
}

export function CurrencyInput({ value, onChange, error, label, disabled, ...rest }: CurrencyInputProps) {
  const id = useId()

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={id} className="block text-label-sm text-ink">
          {label}
        </label>
      )}
      <div
        className={`flex items-center h-[44px] border rounded bg-card overflow-hidden transition-all
          ${error ? 'border-danger' : 'border-border'}
          focus-within:border-brand focus-within:border-[1.5px] focus-within:shadow-input`}
      >
        <span className="px-3 text-body-medium text-muted select-none border-r border-border h-full flex items-center">
          GH₵
        </span>
        <input
          id={id}
          type="number"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="flex-1 h-full px-3 text-body-default text-ink tabular-nums outline-none bg-transparent"
          {...rest}
        />
      </div>
      {error && <p className="text-helper-xs text-danger">{error}</p>}
    </div>
  )
}

