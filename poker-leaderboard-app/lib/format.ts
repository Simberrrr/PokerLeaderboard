export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "-" : ""
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatSignedMoney(amount: number): string {
  const sign = amount > 0 ? "+" : amount < 0 ? "-" : ""
  return `${sign}$${Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function profitClass(amount: number): string {
  if (amount > 0) return "text-emerald-600 dark:text-emerald-400"
  if (amount < 0) return "text-red-600 dark:text-red-400"
  return "text-muted-foreground"
}

export function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}
