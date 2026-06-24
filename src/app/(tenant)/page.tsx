import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RentCard } from './rent-card'
import { format } from 'date-fns'
import { getDueDate, currentPeriodMonth, formatPeriodMonth } from '@/lib/rent-utils'

export default async function RentPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const periodMonth = currentPeriodMonth()
    const demoPaymentHistory = [
      { id: 'dp-2026-06', period_month: '2026-06', amount: 1200, status: 'confirmed', submitted_at: '2026-06-02T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-05', period_month: '2026-05', amount: 1200, status: 'confirmed', submitted_at: '2026-05-01T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-04', period_month: '2026-04', amount: 1200, status: 'confirmed', submitted_at: '2026-04-02T09:00:00Z', receipt_file_url: null, landlord_notes: null },
      { id: 'dp-2026-03', period_month: '2026-03', amount: 1200, status: 'confirmed', submitted_at: '2026-03-03T09:00:00Z', receipt_file_url: null, landlord_notes: null },
    ]
    const demoCurrentPayment = demoPaymentHistory.find(p => p.period_month === periodMonth) ?? null
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Rent</h1>
          <p className="text-sm text-slate-500 mt-1">Unit 1A · Due Jun 1</p>
        </div>
        <RentCard
          leaseId="demo-lease-1"
          monthlyRent={1200}
          periodMonth={periodMonth}
          periodLabel={formatPeriodMonth(periodMonth)}
          dueDate="June 1, 2026"
          currentPayment={demoCurrentPayment}
        />
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Payment History</h2>
          <div className="rounded-xl border bg-white divide-y shadow-sm overflow-hidden">
            {demoPaymentHistory.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{formatPeriodMonth(p.period_month)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {p.submitted_at ? format(new Date(p.submitted_at), 'MMM d, yyyy') : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">${p.amount.toFixed(2)}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Confirmed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: lease } = await supabase
    .from('leases')
    .select('id, monthly_rent, rent_due_day, lease_start, lease_end, unit_id, units(label)')
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

  const periodMonth = currentPeriodMonth()
  const dueDate = getDueDate(lease.rent_due_day)

  const { data: currentPayment } = await supabase
    .from('payments')
    .select('id, amount, status, submitted_at, receipt_file_url, landlord_notes')
    .eq('lease_id', lease.id)
    .eq('period_month', periodMonth)
    .maybeSingle()

  const { data: history } = await supabase
    .from('payments')
    .select('id, period_month, amount, status, submitted_at')
    .eq('lease_id', lease.id)
    .order('period_month', { ascending: false })
    .limit(12)

  const unitLabel = (lease.units as { label: string } | null)?.label ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Rent</h1>
        <p className="text-sm text-slate-500 mt-1">{unitLabel} · Due {format(dueDate, 'MMM d')}</p>
      </div>

      <RentCard
        leaseId={lease.id}
        monthlyRent={lease.monthly_rent}
        periodMonth={periodMonth}
        periodLabel={formatPeriodMonth(periodMonth)}
        dueDate={format(dueDate, 'MMMM d, yyyy')}
        currentPayment={currentPayment}
      />

      {/* Payment history */}
      {history && history.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Payment History</h2>
          <div className="rounded-xl border bg-white divide-y shadow-sm overflow-hidden">
            {history.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{formatPeriodMonth(p.period_month)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {p.submitted_at ? format(new Date(p.submitted_at), 'MMM d, yyyy') : '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">${p.amount.toFixed(2)}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                    p.status === 'pending_review' ? 'bg-amber-100 text-amber-700' :
                    p.status === 'rejected' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-500'
                  }`}>
                    {p.status === 'confirmed' ? 'Confirmed' :
                     p.status === 'pending_review' ? 'Pending' :
                     p.status === 'rejected' ? 'Rejected' : p.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
