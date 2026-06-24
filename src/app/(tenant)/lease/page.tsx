import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { format, differenceInDays } from 'date-fns'
import { FileText, AlertTriangle } from 'lucide-react'

export default async function LeasePage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Lease</h1>
          <p className="text-sm text-slate-500 mt-1">Unit 1A</p>
        </div>
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-5 py-4 text-white">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-300" />
              <span className="font-semibold">Lease Agreement</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">Active</p>
          </div>
          <div className="divide-y">
            {([
              ['Unit', 'Unit 1A'],
              ['Monthly Rent', '$1,200.00'],
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

  const { data: lease } = await supabase
    .from('leases')
    .select('id, monthly_rent, rent_due_day, lease_start, lease_end, status, units(label)')
    .eq('tenant_id', user.id)
    .eq('status', 'active')
    .single()

  if (!lease) {
    return (
      <div className="text-center py-16 text-slate-400">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="font-medium">No active lease</p>
      </div>
    )
  }

  const endDate = lease.lease_end ? new Date(lease.lease_end) : null
  const daysUntilEnd = endDate ? differenceInDays(endDate, new Date()) : null
  const expiringSoon = daysUntilEnd !== null && daysUntilEnd <= 60
  const unitLabel = (lease.units as { label: string } | null)?.label ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">My Lease</h1>
        <p className="text-sm text-slate-500 mt-1">{unitLabel}</p>
      </div>

      {expiringSoon && daysUntilEnd !== null && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-800 font-medium">
            Your lease expires in {daysUntilEnd} day{daysUntilEnd !== 1 ? 's' : ''} — contact your landlord to renew.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="bg-slate-900 px-5 py-4 text-white">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-slate-300" />
            <span className="font-semibold">Lease Agreement</span>
          </div>
          <p className="text-sm text-slate-400 mt-1">Active</p>
        </div>
        <div className="divide-y">
          {([
            ['Unit', unitLabel],
            ['Monthly Rent', `$${lease.monthly_rent.toFixed(2)}`],
            ['Rent Due Day', `${lease.rent_due_day}${lease.rent_due_day === 1 ? 'st' : lease.rent_due_day === 2 ? 'nd' : lease.rent_due_day === 3 ? 'rd' : 'th'} of each month`],
            ['Start Date', format(new Date(lease.lease_start), 'MMMM d, yyyy')],
            ['End Date', endDate ? format(endDate, 'MMMM d, yyyy') : 'Month-to-month'],
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
