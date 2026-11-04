/**
 * Date helpers — all dates are handled in Africa/Accra timezone (GMT+0, no DST).
 */

const TIMEZONE = 'Africa/Accra'

/** Returns today's date as a YYYY-MM-DD string in Africa/Accra */
export const todayString = (): string => {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(new Date())
}

/** Format a YYYY-MM-DD string for display e.g. "Mon, 3 Nov 2026" */
export const formatDate = (dateStr: string): string => {
  const date = new Date(`${dateStr}T00:00:00`)
  return date.toLocaleDateString('en-GH', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  })
}

/** Format an ISO datetime string to local time e.g. "3:42 PM" */
export const formatTime = (isoString: string): string =>
  new Date(isoString).toLocaleTimeString('en-GH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIMEZONE,
  })

/** Returns true if the current local hour is >= 20 (8 PM) */
export const isPastEightPM = (): boolean => {
  const hour = parseInt(
    new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: TIMEZONE }).format(
      new Date(),
    ),
  )
  return hour >= 20
}

