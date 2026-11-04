export type EventTagType = 'sale' | 'sold' | 'received' | 'cracked' | 'expense' | 'feed' | 'other'

const TYPE_CONFIG: Record<EventTagType, { label: string; className: string }> = {
  sale: { label: 'Sale', className: 'badge-sale' },
  sold: { label: 'Sold', className: 'badge-sale' },
  received: { label: 'Received', className: 'badge-received' },
  cracked: { label: 'Cracked', className: 'badge-cracked' },
  expense: { label: 'Expense', className: 'badge-neutral' },
  feed: { label: 'Feed', className: 'badge-neutral' },
  other: { label: 'Other', className: 'badge-neutral' },
}

interface TypeTagProps {
  type: EventTagType
}

export function TypeTag({ type }: TypeTagProps) {
  const config = TYPE_CONFIG[type] ?? TYPE_CONFIG.expense
  return <span className={config.className}>{config.label}</span>
}
