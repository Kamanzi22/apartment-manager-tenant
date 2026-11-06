import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RentCard } from './rent-card'
import { format } from 'date-fns'
import { AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react'
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
      <div className="text-center py-16 text-slate-400">
        <p className="text-lg font-medium">No active lease found</p>
        <p className="text-sm mt-1">Contact your landlord if you believe this is an error</p>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rent</h1>
        <p className="text-sm text-slate-500 mt-1">
          {unitLabel} · Due {format(getDueDate(rentDueDay), 'MMM d')}
        </p>
      </div>

      {/* What the tenant owes */}
      {owed.length > 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 overflow-hidden">
          <div className="flex items-start gap-3 px-5 py-4">
            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">You owe</p>
              <p className="text-2xl font-bold text-red-700">{formatRWF(totalOwed)}</p>
              <p className="text-xs text-red-600 mt-0.5">
                {owed.length} {owed.length === 1 ? 'month' : 'months'} overdue
              </p>
            </div>
          </div>
          <div className="bg-white divide-y border-t border-red-200">
            {owed.map(o => (
              <div key={o.period_month} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">{formatPeriodMonth(o.period_month)}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Was due {format(o.dueDate, 'MMM d, yyyy')}
                    {o.reason === 'rejected' && ' · payment rejected'}
                    {o.reason === 'partial' && ' · partly paid'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-semibold text-red-700">{formatRWF(o.balance)}</span>
                  {o.reason === 'partial' ? (
                    <Link href="/messages" className="text-xs font-medium text-slate-600 underline underline-offset-2">
                      Contact landlord
                    </Link>
                  ) : (
                    <Link
                      href={`/?month=${o.period_month}#pay`}
                      className={`text-xs font-medium px-3 py-1.5 rounded-lg ${
                        selectedMonth === o.period_month
                          ? 'bg-slate-200 text-slate-600'
                          : 'bg-slate-900 text-white hover:bg-slate-700'
                      }`}
                    >
                      {selectedMonth === o.period_month ? 'Selected' : 'Pay'}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">You&apos;re all caught up. No overdue rent.</p>
        </div>
      )}

      <div id="pay" className="space-y-2 scroll-mt-4">
        {isOverdueSelection && (
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-slate-600">
              Paying overdue rent for <span className="font-medium">{formatPeriodMonth(selectedMonth)}</span>
            </p>
            <Link href="/" className="text-slate-500 underline underline-offset-2 shrink-0">
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
      <div>
        <div className="flex items-baseline justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold text-slate-800">Payment History</h2>
          {totalPaid > 0 && (
            <p className="text-xs text-slate-500">Total confirmed: {formatRWF(totalPaid)}</p>
          )}
        </div>
        {history.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-white px-4 py-8 text-center text-sm text-slate-400">
            No payments submitted yet
          </div>
        ) : (
          <div className="rounded-xl border bg-white divide-y shadow-sm overflow-hidden">
            {history.map(p => (
              <div key={p.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800">{formatPeriodMonth(p.period_month)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Submitted {p.submitted_at ? format(new Date(p.submitted_at), 'MMM d, yyyy') : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm font-medium text-slate-700">{formatRWF(p.amount)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
                {(p.landlord_notes || p.receipt_file_url) && (
                  <div className="mt-1.5 space-y-1">
                    {p.landlord_notes && (
                      <p className="text-xs text-slate-600 bg-slate-50 rounded-md px-2 py-1">
                        Landlord: {p.landlord_notes}
                      </p>
                    )}
                    {p.receipt_file_url && (
                      <a
                        href={p.receipt_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
                      >
                        <ExternalLink className="h-3 w-3" /> View receipt
                      </a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const cfg =
    status === 'confirmed' ? { label: 'Confirmed', cls: 'bg-green-100 text-green-700' } :
    status === 'pending_review' ? { label: 'Pending', cls: 'bg-amber-100 text-amber-700' } :
    status === 'rejected' ? { label: 'Rejected', cls: 'bg-red-100 text-red-700' } :
    { label: status, cls: 'bg-slate-100 text-slate-500' }
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.cls}`}>{cfg.label}</span>
}
