import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format, differenceInDays, parseISO } from 'date-fns'
import { FileText, AlertTriangle } from 'lucide-react'
import { formatRWF } from '@/lib/currency'
import { kigaliToday, ordinal } from '@/lib/rent-utils'

export default async function LeasePage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="on-photo text-3xl font-semibold tracking-tight">My Lease</h1>
          <p className="on-photo text-sm mt-1 opacity-95">Unit 1A</p>
        </div>
        <div className="glass overflow-hidden">
          <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-[var(--metal)]" />
              <span className="font-semibold">Lease Agreement</span>
            </div>
            <p className="text-sm text-[var(--metal)] mt-1">Active</p>
          </div>
          <div className="divide-y">
            {([
              ['Unit', 'Unit 1A'],
              ['Monthly Rent', '1,200,000 RWF'],
              ['Rent Due Day', '1st of each month'],
              ['Start Date', 'January 1, 2024'],
              ['End Date', 'December 31, 2026'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex justify-between px-5 py-3">
                <span className="text-sm text-slate-500">{label}</span>
                <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
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

  // The current lease, or for a former tenant the most recent one (read-only).
  const { data: lease } = await supabase
    .from('leases')
    .select('id, monthly_rent, rent_due_day, lease_start, lease_end, status, units(label)')
    .eq('tenant_id', user.id)
    .order('status', { ascending: true })
    .order('move_in_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lease) {
    return (
      <div className="text-center py-16 text-slate-400">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No active lease</p>
      </div>
    )
  }

  const endDate = lease.lease_end ? parseISO(lease.lease_end) : null
  const isActive = lease.status === 'active'
  const daysUntilEnd = endDate ? differenceInDays(endDate, kigaliToday()) : null
  const expiringSoon = isActive && daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 60
  const unitLabel = (lease.units as { label: string } | null)?.label ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="on-photo text-3xl font-semibold tracking-tight">My Lease</h1>
        <p className="on-photo text-sm mt-1 opacity-95">{unitLabel}</p>
      </div>

      {expiringSoon && daysUntilEnd !== null && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            Your lease expires in {daysUntilEnd} day{daysUntilEnd !== 1 ? 's' : ''} — contact your landlord to renew.
          </p>
        </div>
      )}

      <div className="glass overflow-hidden">
        <div className="bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--metal)]" />
            <span className="font-semibold">Lease Agreement</span>
          </div>
          <p className="text-sm text-[var(--metal)] mt-1">{isActive ? 'Active' : 'Ended'}</p>
        </div>
        <div className="divide-y">
          {([
            ['Unit', unitLabel],
            ['Monthly Rent', formatRWF(Number(lease.monthly_rent))],
            ['Rent Due Day', `${ordinal(lease.rent_due_day)} of each month`],
            ['Start Date', format(parseISO(lease.lease_start), 'MMMM d, yyyy')],
            [isActive ? 'End Date' : 'Ended', endDate ? format(endDate, 'MMMM d, yyyy') : 'Month-to-month'],
          ] as [string, string][]).map(([label, value]) => (
            <div key={label} className="flex justify-between px-5 py-3">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-sm font-medium text-slate-800 text-right">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
