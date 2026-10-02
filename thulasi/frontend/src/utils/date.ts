/** "11 February 2025", or the raw value when it isn't a date. */
export function prettyDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}
