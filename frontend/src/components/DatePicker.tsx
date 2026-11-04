import { todayString } from '@/lib/dates'

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  max?: string
  label?: string
  className?: string
}

export function DatePicker({ value, onChange, max, label, className }: DatePickerProps) {
  return (
    <div className={`flex items-center gap-1.5 sm:gap-2 ${className ?? ''}`}>
      {label && <span className="text-xs sm:text-label-sm text-muted whitespace-nowrap hidden xs:inline sm:inline">{label}</span>}
      <input
        type="date"
        value={value}
        max={max ?? todayString()}
        onChange={(e) => onChange(e.target.value)}
        className="input-base h-9 sm:h-[40px] w-auto px-2.5 sm:px-3 text-xs sm:text-sm cursor-pointer"
      />
    </div>
  )
}

