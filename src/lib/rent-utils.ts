import { format, getDaysInMonth, setDate, startOfMonth } from 'date-fns'

export function currentPeriodMonth(): string {
  return format(new Date(), 'yyyy-MM')
}

export function getDueDate(rentDueDay: number, forMonth?: Date): Date {
  const base = forMonth ?? new Date()
  const year = base.getFullYear()
  const month = base.getMonth()
  const maxDay = getDaysInMonth(new Date(year, month))
  const day = Math.min(rentDueDay, maxDay)
  return setDate(startOfMonth(new Date(year, month)), day)
}

export function formatPeriodMonth(period: string): string {
  const [year, month] = period.split('-').map(Number)
  return format(new Date(year, month - 1), 'MMMM yyyy')
}

export function periodMonthFromDate(date: Date): string {
  return format(date, 'yyyy-MM')
}
