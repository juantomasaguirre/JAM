export function getMonthlyAvgMep(rates: { sell: number | null }[]): number | null {
  const valid = rates.filter((r) => r.sell !== null).map((r) => r.sell as number)
  if (valid.length === 0) return null
  return valid.reduce((a, b) => a + b, 0) / valid.length
}

export function convert(
  amount: number,
  from: 'ARS' | 'USD',
  to: 'ARS' | 'USD',
  rate: number | null,
): number | null {
  if (from === to) return amount
  if (rate === null) return null
  return from === 'ARS' ? amount / rate : amount * rate
}

export function formatAmount(amount: number, currency: 'ARS' | 'USD'): string {
  const num = new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))
  return currency === 'ARS' ? `$ ${num}` : `U$S ${num}`
}

export function lastDayOfMonth(year: number, month: number): string {
  const d = new Date(year, month, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
