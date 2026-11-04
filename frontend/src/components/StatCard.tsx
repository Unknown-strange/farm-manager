interface StatCardProps {
  label: string
  value: string
  helper?: string
  icon?: React.ReactNode
  variant?: 'neutral' | 'success' | 'danger' | 'intake' | 'warn'
}

const VALUE_COLORS: Record<NonNullable<StatCardProps['variant']>, string> = {
  neutral: 'text-ink',
  success: 'text-success',
  danger: 'text-danger',
  intake: 'text-intake',
  warn: 'text-warn',
}

export function StatCard({ label, value, helper, icon, variant = 'neutral' }: StatCardProps) {
  return (
    <div className="card p-5 flex flex-col gap-3">
      {/* Top row: label + icon */}
      <div className="flex items-center justify-between">
        <span className="stat-label">{label}</span>
        {icon && <span className={VALUE_COLORS[variant]}>{icon}</span>}
      </div>
      {/* Value */}
      <p className={`text-display-md font-bold tabular-nums ${VALUE_COLORS[variant]}`}>
        {value}
      </p>
      {/* Helper */}
      {helper && <p className="text-helper-xs text-muted">{helper}</p>}
    </div>
  )
}

