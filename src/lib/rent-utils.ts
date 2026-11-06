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

/** Every "YYYY-MM" from start to end, inclusive. */
export function monthsBetween(start: string, end: string): string[] {
  const result: string[] = []
  let [y, m] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) { m = 1; y++ }
  }
  return result
}

export interface LedgerPayment {
  period_month: string
  amount: number
  status: string
}

export interface OwedMonth {
  period_month: string
  dueDate: Date
  /** Amount still owed for the month */
  balance: number
  reason: 'unpaid' | 'rejected' | 'partial'
}

/**
 * Months on the lease whose due date has passed and that are not covered by a
 * confirmed or pending payment. A month with a pending payment is not treated as owed;
 * the landlord still has to review it.
 */
export function computeOwedMonths(
  lease: { move_in_date: string; lease_end: string | null; rent_due_day: number; monthly_rent: number },
  payments: LedgerPayment[],
  today: Date = new Date(),
): OwedMonth[] {
  const todayMonth = format(today, 'yyyy-MM')
  const leaseEndMonth = lease.lease_end ? lease.lease_end.slice(0, 7) : todayMonth
  const endMonth = leaseEndMonth < todayMonth ? leaseEndMonth : todayMonth
  const startMonth = lease.move_in_date.slice(0, 7)

  const owed: OwedMonth[] = []
  for (const mo of monthsBetween(startMonth, endMonth)) {
    const [y, m] = mo.split('-').map(Number)
    const dueDate = getDueDate(lease.rent_due_day, new Date(y, m - 1, 1))
    if (dueDate > today) continue

    const p = payments.find(x => x.period_month === mo)
    if (!p) {
      owed.push({ period_month: mo, dueDate, balance: lease.monthly_rent, reason: 'unpaid' })
    } else if (p.status === 'rejected') {
      owed.push({ period_month: mo, dueDate, balance: lease.monthly_rent, reason: 'rejected' })
    } else if (p.status === 'confirmed' && p.amount < lease.monthly_rent) {
      owed.push({ period_month: mo, dueDate, balance: lease.monthly_rent - p.amount, reason: 'partial' })
    }
  }
  return owed
}
