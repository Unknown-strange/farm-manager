/**
 * Currency formatting utilities for Ghana Cedi (GH₵).
 * All monetary values are stored as numbers (GHS, 2 decimal precision).
 */

/** Format a number as a Ghana Cedi amount e.g. "GH₵ 1,250.00" */
export const formatMoney = (amount: number): string =>
  `GH₵ ${amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

/** Parse a formatted string back to number */
export const parseMoney = (value: string): number => {
  const cleaned = value.replace(/[^\d.]/g, '')
  return parseFloat(cleaned) || 0
}

