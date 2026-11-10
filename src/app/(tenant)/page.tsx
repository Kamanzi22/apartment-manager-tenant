import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RentCard } from './rent-card'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { PaymentHistory } from '@/components/tenant-ui'
import {
  getDueDate,
  currentPeriodMonth,
  formatPeriodMonth,
  computeOwedMonths,
  type OwedMonth,
} from '@/lib/rent-utils'
import { formatRWF } from '@/lib/currency'

interface HistoryPayment {
  id: string
  lease_id?: string
  period_month: string
  amount: number
  status: string
  submitted_at: string | null
  receipt_file_url: string | null
  landlord_notes: string | null
}

const PERIOD_RE = /^\d{4}-\d{2}$/

export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const { month } = await searchParams
  const periodMonth = currentPeriodMonth()

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoLease = { move_in_date: '2026-01-15', lease_end: null, rent_due_day: 1, monthly_rent: 350000 }
    const demoHistory: HistoryPayment[] = [
      { id: 'dp-2026-05', period_month: '2026-05', amount: 350000, status: 'confirmed', submitted_at: '2026-05-01T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-04', period_month: '2026-04', amount: 350000, status: 'rejected', submitted_at: '2026-04-02T09:00:00Z', receipt_file_url: null, landlord_notes: 'Receipt is unreadable, please re-upload.' },
      { id: 'dp-2026-03', period_month: '2026-03', amount: 200000, status: 'confirmed', submitted_at: '2026-03-03T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-02', period_month: '2026-02', amount: 350000, status: 'confirmed', submitted_at: '2026-02-02T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-01', period_month: '2026-01', amount: 350000, status: 'confirmed', submitted_at: '2026-01-02T09:00:00Z', receipt_file_url: null, landlord_notes: null },
    ]
    return (
      <RentView
        leaseId="demo-lease-1"
        unitLabel="Unit 1A"
        rentDueDay={demoLease.rent_due_day}
        monthlyRent={demoLease.monthly_rent}
        owed={computeOwedMonths(demoLease, demoHistory)}
        history={demoHistory}
        requestedMonth={month}
        currentMonth={periodMonth}
      />
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lease } = await supabase
    .from('leases')
    .select('id, monthly_rent, rent_due_day, move_in_date, lease_start, lease_end, unit_id, units(label)')
    .eq('tenant_id', user.id)
    .eq('status', 'active')
    .single()

  if (!lease) {
    return (
      <div className="glass p-6">
        <div className="empty-state">
          <p className="text-base font-semibold text-[var(--ink)]">No active lease found</p>
          <p>Contact your landlord if you believe this is an error</p>
        </div>
      </div>
    )
  }

  // Full history across all of this tenant's leases (RLS limits rows to the tenant).
  const { data: history } = await supabase
    .from('payments')
    .select('id, lease_id, period_month, amount, status, submitted_at, receipt_file_url, landlord_notes')
    .eq('tenant_id', user.id)
    .order('period_month', { ascending: false })

  const leasePayments = (history ?? []).filter(p => p.lease_id === lease.id)
  const unitLabel = (lease.units as { label: string } | null)?.label ?? ''

  return (
    <RentView
      leaseId={lease.id}
      unitLabel={unitLabel}
      rentDueDay={lease.rent_due_day}
      monthlyRent={lease.monthly_rent}
      owed={computeOwedMonths(lease, leasePayments)}
      history={history ?? []}
      requestedMonth={month}
      currentMonth={periodMonth}
    />
  )
}

function RentView({
  leaseId,
  unitLabel,
  rentDueDay,
  monthlyRent,
  owed,
  history,
  requestedMonth,
  currentMonth,
}: {
  leaseId: string
  unitLabel: string
  rentDueDay: number
  monthlyRent: number
  owed: OwedMonth[]
  history: HistoryPayment[]
  requestedMonth: string | undefined
  currentMonth: string
}) {
  // Tenants can pay the current month, or any overdue month that has no accepted payment.
  // A partly paid month already has a confirmed payment, so the balance goes through the landlord.
  const payableOwed = owed.filter(o => o.reason !== 'partial')
  const selectedMonth =
    requestedMonth && PERIOD_RE.test(requestedMonth) && payableOwed.some(o => o.period_month === requestedMonth)
      ? requestedMonth
      : currentMonth
  const isOverdueSelection = selectedMonth !== currentMonth

  const [sy, sm] = selectedMonth.split('-').map(Number)
  const selectedDue = getDueDate(rentDueDay, new Date(sy, sm - 1, 1))
  const selectedPayment =
    history.find(p => p.period_month === selectedMonth && (!p.lease_id || p.lease_id === leaseId)) ?? null
  const totalOwed = owed.reduce((s, o) => s + o.balance, 0)
  const totalPaid = history.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="on-photo text-3xl font-semibold tracking-tight">Rent</h1>
        <p className="on-photo text-sm mt-1 opacity-95">
          {unitLabel} · Due {format(getDueDate(rentDueDay), 'MMM d')}
        </p>
      </div>

      {/* What the tenant owes */}
      {owed.length > 0 ? (
        <>
          <section className="hero-card p-6">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-medium text-[var(--metal)]">You owe</p>
              <span className="chip chip-danger">
                <AlertCircle className="h-3 w-3" />
                {owed.length} {owed.length === 1 ? 'month' : 'months'} overdue
              </span>
            </div>
            <p className="mt-2 text-4xl font-semibold tracking-tight">
              {new Intl.NumberFormat('en-US').format(Math.round(totalOwed))}{' '}
              <span className="accent-word text-[0.85em]">RWF</span>
            </p>
            <p className="text-sm text-white/90 mt-2">Choose a month below to pay it.</p>
          </section>

          <section className="glass p-3 space-y-2" aria-label="Overdue months">
            {owed.map(o => {
              const isSelected = selectedMonth === o.period_month
              return (
                <div
                  key={o.period_month}
                  data-selected={isSelected}
                  className="glass-row flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{formatPeriodMonth(o.period_month)}</p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Was due {format(o.dueDate, 'MMM d, yyyy')}
                      {o.reason === 'rejected' && ' · payment rejected'}
                      {o.reason === 'partial' && ' · partly paid'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-[var(--danger-text)]">{formatRWF(o.balance)}</span>
                    {o.reason === 'partial' ? (
                      <Link href="/messages" className="inline-flex items-center min-h-11 text-xs font-semibold text-[var(--muted-2)] underline underline-offset-2">
                        Contact landlord
                      </Link>
                    ) : (
                      <Link
                        href={`/?month=${o.period_month}#pay`}
                        aria-current={isSelected ? 'true' : undefined}
                        className={isSelected
                          ? 'inline-flex items-center min-h-11 px-4 rounded-full text-xs font-semibold bg-white/90 border border-white text-[var(--muted-2)]'
                          : 'inline-flex items-center min-h-11 px-5 rounded-full text-xs font-semibold bg-[var(--ink)] text-[var(--on-dark)] hover:bg-[#2B3640]'}
                      >
                        {isSelected ? 'Selected' : 'Pay'}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </section>
        </>
      ) : (
        <section className="hero-card p-6 flex items-center gap-4">
          <CheckCircle2 className="h-8 w-8 text-[var(--metal)] shrink-0" />
          <div>
            <p className="text-xl font-semibold">You&apos;re <span className="accent-word">all</span> caught up</p>
            <p className="text-sm text-white/90 mt-0.5">No overdue rent.</p>
          </div>
          <span className="chip chip-success ml-auto">All clear</span>
        </section>
      )}

      <div id="pay" className="space-y-2 scroll-mt-4">
        {isOverdueSelection && (
          <div className="glass rounded-full! flex items-center justify-between gap-3 text-sm px-4 py-2">
            <p className="text-[var(--muted-2)]">
              Paying overdue rent for <span className="font-semibold text-[var(--ink)]">{formatPeriodMonth(selectedMonth)}</span>
            </p>
            <Link href="/" className="inline-flex items-center min-h-11 font-semibold text-[var(--ink)] underline underline-offset-2 shrink-0">
              Back to this month
            </Link>
          </div>
        )}
        <RentCard
          key={selectedMonth}
          leaseId={leaseId}
          monthlyRent={monthlyRent}
          periodMonth={selectedMonth}
          periodLabel={formatPeriodMonth(selectedMonth)}
          dueDate={format(selectedDue, 'MMMM d, yyyy')}
          currentPayment={selectedPayment}
        />
      </div>

      {/* Payment history */}
      <PaymentHistory history={history} totalPaid={totalPaid} />
    </div>
  )
}
