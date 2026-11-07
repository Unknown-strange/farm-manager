import React from 'react'

export type CardVariant = 'success' | 'intake' | 'warn' | 'danger' | 'brand' | 'neutral'

export interface UnifiedCardProps {
  label: string
  value: React.ReactNode
  helper?: React.ReactNode
  icon?: React.ReactNode
  variant?: CardVariant
  className?: string
  children?: React.ReactNode
}

const VARIANT_STYLES: Record<CardVariant, { card: string; label: string; icon: string }> = {
  success: {
    card: 'border-2 border-success/40 bg-success-bg/30',
    label: 'text-success',
    icon: 'text-success',
  },
  intake: {
    card: 'border-2 border-intake/30 bg-intake-bg/20',
    label: 'text-intake',
    icon: 'text-intake',
  },
  brand: {
    card: 'border-2 border-brand/40 bg-brand-tint/20',
    label: 'text-brand',
    icon: 'text-brand',
  },
  warn: {
    card: 'border-2 border-warn/40 bg-warn-bg/30',
    label: 'text-warn',
    icon: 'text-warn',
  },
  danger: {
    card: 'border-2 border-danger/40 bg-danger-bg/25',
    label: 'text-danger',
    icon: 'text-danger',
  },
  neutral: {
    card: 'border-2 border-border bg-card shadow-card',
    label: 'text-ink',
    icon: 'text-muted',
  },
}

export function UnifiedCard({
  label,
  value,
  helper,
  icon,
  variant = 'neutral',
  className = '',
  children,
}: UnifiedCardProps) {
  const styles = VARIANT_STYLES[variant] ?? VARIANT_STYLES.neutral

  return (
    <div className={`card p-5 ${styles.card} flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-xs font-bold uppercase tracking-wider ${styles.label}`}>
            {label}
          </span>
          {icon && <span className={styles.icon}>{icon}</span>}
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold text-ink tabular-nums">
          {value}
        </div>
        {helper && (
          <div className="text-xs text-muted mt-1.5 leading-relaxed">
            {helper}
          </div>
        )}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}

