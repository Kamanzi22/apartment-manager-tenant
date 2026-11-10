import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format, parseISO } from 'date-fns'
import { AlertCircle, CalendarClock, CheckCircle2, History } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { RentCard, type MonthPayment } from './rent-card'
import { PaymentHistory } from '@/components/tenant-ui'
import { currentPeriodMonth, formatPeriodMonth, kigaliDateString } from '@/lib/rent-utils'
import {
  computeLedger, computeUpcoming, fetchLedgers, fetchUpcoming, owedAfterPending, type LedgerRow,
} from '@/lib/rent-ledger'
import { formatRWF } from '@/lib/currency'

interface LeaseView {
  id: string
  unitLabel: string
  active: boolean
  rentDueDay: number
  moveIn: string
  leaseEnd: string | null
  /** rent_ledger: move-in to this month */
  rows: LedgerRow[]
  /** rent_upcoming: the next 6 months (current lease only) */
  upcoming: LedgerRow[]
}

interface HistoryPayment extends MonthPayment {
  lease_id: string
  period_month: string
}

const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/

export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; lease?: string }>
}) {
  const { month, lease: leaseParam } = await searchParams
  const currentMonth = currentPeriodMonth()

  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoLease = { move_in_date: '2026-01-15', lease_end: null, rent_due_day: 1, monthly_rent: 350000 }
    const demoHistory: HistoryPayment[] = [
      { id: 'dp-2026-05', lease_id: 'demo-lease-1', period_month: '2026-05', amount: 350000, status: 'confirmed', submitted_at: '2026-05-01T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-04', lease_id: 'demo-lease-1', period_month: '2026-04', amount: 350000, status: 'rejected', submitted_at: '2026-04-02T09:00:00Z', receipt_file_url: null, landlord_notes: 'Receipt is unreadable, please re-upload.' },
      { id: 'dp-2026-03', lease_id: 'demo-lease-1', period_month: '2026-03', amount: 200000, status: 'confirmed', submitted_at: '2026-03-03T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-02', lease_id: 'demo-lease-1', period_month: '2026-02', amount: 350000, status: 'confirmed', submitted_at: '2026-02-02T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-01', lease_id: 'demo-lease-1', period_month: '2026-01', amount: 350000, status: 'confirmed', submitted_at: '2026-01-02T09:00:00Z', receipt_file_url: null, landlord_notes: null },
    ]
    const today = kigaliDateString()
    return (
      <RentView
        leases={[{
          id: 'demo-lease-1', unitLabel: 'Unit 1A', active: true, rentDueDay: 1, moveIn: demoLease.move_in_date, leaseEnd: null,
          rows: computeLedger(demoLease, demoHistory, [], today),
          upcoming: computeUpcoming(demoLease, demoHistory, [], today),
        }]}
        history={demoHistory}
        requestedMonth={month}
        requestedLease={leaseParam}
        currentMonth={currentMonth}
      />
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: leasesRaw } = await supabase
    .from('leases')
    .select('id, rent_due_day, move_in_date, lease_end, status, units(label)')
    .eq('tenant_id', user.id)
    .order('move_in_date', { ascending: false })

  if (!leasesRaw?.length) {
    return (
      <div className="glass p-6">
        <div className="empty-state">
          <p className="text-base font-semibold text-[var(--ink)]">You are not on a lease yet</p>
          <p>Your landlord has been told you signed up and will add you to your unit.</p>
        </div>
      </div>
    )
  }

  const active = leasesRaw.find(l => l.status === 'active')
  const [ledgers, upcoming, { data: history }] = await Promise.all([
    fetchLedgers(supabase, leasesRaw.map(l => l.id)),
    active ? fetchUpcoming(supabase, active.id, 6) : Promise.resolve([] as LedgerRow[]),
    // Full history across all of this tenant's leases (RLS limits rows to the tenant).
    supabase
      .from('payments')
      .select('id, lease_id, period_month, amount, status, submitted_at, receipt_file_url, landlord_notes')
      .eq('tenant_id', user.id)
      .order('period_month', { ascending: false })
      .order('submitted_at', { ascending: false })
      .limit(500),
  ])

  const leases: LeaseView[] = leasesRaw.map(l => ({
    id: l.id,
    unitLabel: (l.units as { label: string } | null)?.label ?? 'Your unit',
    active: l.status === 'active',
    rentDueDay: l.rent_due_day,
    moveIn: l.move_in_date,
    leaseEnd: l.lease_end,
    rows: ledgers.get(l.id) ?? [],
    upcoming: l.id === active?.id ? upcoming : [],
  }))

  return (
    <RentView
      leases={leases}
      history={(history ?? []).map(p => ({ ...p, amount: Number(p.amount) }))}
      requestedMonth={month}
      requestedLease={leaseParam}
      currentMonth={currentMonth}
    />
  )
}

interface PayOption {
  lease: LeaseView
  row: LedgerRow
  kind: 'owed' | 'current' | 'ahead'
}

function payHref(o: { lease: LeaseView; row: LedgerRow }) {
  return `/?lease=${o.lease.id}&month=${o.row.period_month}#pay`
}

function RentView({
  leases, history, requestedMonth, requestedLease, currentMonth,
}: {
  leases: LeaseView[]
  history: HistoryPayment[]
  requestedMonth: string | undefined
  requestedLease: string | undefined
  currentMonth: string
}) {
  const active = leases.find(l => l.active) ?? null
  const previous = leases.filter(l => !l.active)

  const owed: PayOption[] = leases
    .flatMap(lease => lease.rows.filter(r => owedAfterPending(r) > 0).map(row => ({ lease, row, kind: 'owed' as const })))
    .sort((a, b) => a.row.period_month.localeCompare(b.row.period_month))
  const totalOwed = owed.reduce((s, o) => s + owedAfterPending(o.row), 0)
  const underReview = leases.flatMap(l => l.rows).reduce((s, r) => s + Math.min(r.pending_paid, r.balance), 0)
  const previousOwed = previous.flatMap(l => l.rows.filter(r => r.balance > 0).map(r => ({ lease: l, row: r })))
  const previousBalance = previousOwed.reduce((s, o) => s + o.row.balance, 0)

  // Months that can be paid: anything owed; and on the current lease, this
  // month and up to six months ahead.
  const currentRow = active?.rows.find(r => r.period_month === currentMonth)
  const options: PayOption[] = [
    ...owed,
    ...(active && currentRow ? [{ lease: active, row: currentRow, kind: 'current' as const }] : []),
    ...(active ? active.upcoming.map(row => ({ lease: active, row, kind: 'ahead' as const })) : []),
  ]
  const requested = requestedMonth && PERIOD_RE.test(requestedMonth)
    ? options.find(o => o.row.period_month === requestedMonth && (!requestedLease || o.lease.id === requestedLease))
    : undefined
  const selected = requested
    ?? options.find(o => o.kind === 'current')
    ?? owed[0]
    ?? (active ? options.find(o => o.kind === 'ahead') : undefined)
    ?? null
  const isDefault = !requested

  const totalPaid = history.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.amount, 0)
  const monthPayments = selected
    ? history.filter(p => p.lease_id === selected.lease.id && p.period_month === selected.row.period_month)
    : []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="on-photo text-3xl font-semibold tracking-tight">Rent</h1>
        <p className="on-photo text-sm mt-1 opacity-95">
          {active
            ? `${active.unitLabel}${currentRow ? ` · Due ${format(parseISO(currentRow.due_date), 'MMM d')}` : ''}`
            : 'Former tenant · your history and balance'}
        </p>
      </div>

      {!active && (
        <section className="glass p-4 flex items-start gap-3" aria-label="Former tenant">
          <History className="h-5 w-5 shrink-0 text-[var(--muted-2)] mt-0.5" />
          <p className="text-sm text-[var(--muted-2)]">
            Your lease has ended. You can still see your receipts and history here
            {totalOwed > 0 ? ', and pay what you still owe.' : '.'}
          </p>
        </section>
      )}

      {previousBalance > 0 && (
        <section className="glass p-4" aria-label="Previous balance">
          <p className="text-sm font-semibold text-[var(--danger-text)]">
            Previous balance: {formatRWF(previousBalance)}
          </p>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {previous.filter(l => l.rows.some(r => r.balance > 0)).map(l =>
              `${l.unitLabel}, ${l.rows.filter(r => r.balance > 0).map(r => formatPeriodMonth(r.period_month)).join(', ')}`
            ).join('; ')}
          </p>
        </section>
      )}

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
            <p className="text-sm text-white/90 mt-2">
              Choose a month below to pay it.{underReview > 0 && ` ${formatRWF(underReview)} more is waiting for review.`}
            </p>
          </section>

          <section className="glass p-3 space-y-2" aria-label="Overdue months">
            {owed.map(o => {
              const isSelected = selected?.lease.id === o.lease.id && selected.row.period_month === o.row.period_month
              return (
                <div
                  key={`${o.lease.id}-${o.row.period_month}`}
                  data-selected={isSelected}
                  className="glass-row flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {formatPeriodMonth(o.row.period_month)}
                      {!o.lease.active && <span className="text-xs font-normal text-[var(--muted)]"> · {o.lease.unitLabel} (previous)</span>}
                    </p>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Was due {format(parseISO(o.row.due_date), 'MMM d, yyyy')}
                      {o.row.status === 'partial' && ` · ${formatRWF(o.row.confirmed_paid + o.row.pending_paid)} of ${formatRWF(o.row.expected)} paid`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-bold text-[var(--danger-text)]">{formatRWF(owedAfterPending(o.row))}</span>
                    <Link
                      href={payHref(o)}
                      aria-current={isSelected ? 'true' : undefined}
                      className={isSelected
                        ? 'inline-flex items-center min-h-11 px-4 rounded-full text-xs font-semibold bg-white/90 border border-white text-[var(--muted-2)]'
                        : 'inline-flex items-center min-h-11 px-5 rounded-full text-xs font-semibold bg-[var(--ink)] text-[var(--on-dark)] hover:bg-[#2B3640]'}
                    >
                      {isSelected ? 'Selected' : o.row.status === 'partial' ? 'Top up' : 'Pay'}
                    </Link>
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
            <p className="text-sm text-white/90 mt-0.5">
              {underReview > 0 ? `${formatRWF(underReview)} is waiting for your landlord to review.` : 'No overdue rent.'}
            </p>
          </div>
          <span className="chip chip-success ml-auto">All clear</span>
        </section>
      )}

      {selected && (
        <div id="pay" className="space-y-2 scroll-mt-4">
          {!isDefault && (
            <div className="glass rounded-full! flex items-center justify-between gap-3 text-sm px-4 py-2">
              <p className="text-[var(--muted-2)]">
                {selected.kind === 'ahead' ? 'Paying ahead for ' : selected.kind === 'owed' ? 'Paying overdue rent for ' : 'Paying '}
                <span className="font-semibold text-[var(--ink)]">{formatPeriodMonth(selected.row.period_month)}</span>
              </p>
              <Link href="/" className="inline-flex items-center min-h-11 font-semibold text-[var(--ink)] underline underline-offset-2 shrink-0">
                Back to this month
              </Link>
            </div>
          )}
          <RentCard
            key={`${selected.lease.id}-${selected.row.period_month}`}
            leaseId={selected.lease.id}
            periodMonth={selected.row.period_month}
            periodLabel={formatPeriodMonth(selected.row.period_month)}
            dueDate={format(parseISO(selected.row.due_date), 'MMMM d, yyyy')}
            expected={selected.row.expected}
            confirmed={selected.row.confirmed_paid}
            pending={selected.row.pending_paid}
            payments={monthPayments}
            maxAmount={selected.lease.active ? undefined : owedAfterPending(selected.row)}
          />
        </div>
      )}

      {active && active.upcoming.length > 0 && (
        <section className="glass p-5" aria-labelledby="pay-ahead">
          <h2 id="pay-ahead" className="text-base font-semibold mb-1 flex items-center gap-2">
            <CalendarClock className="h-4 w-4" /> Pay ahead
          </h2>
          <p className="text-xs text-[var(--muted)] mb-3">You can pay up to 6 months in advance.</p>
          <div className="space-y-2">
            {active.upcoming.map(row => {
              const remaining = Math.max(row.expected - row.confirmed_paid - row.pending_paid, 0)
              return (
                <div key={row.period_month} className="glass-row flex items-center justify-between gap-3 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-semibold">{formatPeriodMonth(row.period_month)}</p>
                    <p className="text-xs text-[var(--muted)]">{formatRWF(row.expected)} · due {format(parseISO(row.due_date), 'MMM d')}</p>
                  </div>
                  {row.status === 'paid' ? <span className="chip chip-success">Paid</span>
                    : remaining === 0 ? <span className="chip chip-warning">In review</span>
                    : (
                      <Link href={payHref({ lease: active, row })} className="inline-flex items-center min-h-11 px-5 rounded-full text-xs font-semibold bg-white/90 border border-white text-[var(--ink)] hover:bg-white">
                        Pay ahead
                      </Link>
                    )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      <PaymentHistory history={history} totalPaid={totalPaid} />
    </div>
  )
}
