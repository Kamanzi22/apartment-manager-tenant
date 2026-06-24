import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MaintenanceForm } from './maintenance-form'
import { MAINTENANCE_CATEGORIES } from '@/lib/categories'
import { format } from 'date-fns'

const statusConfig = {
  submitted:    { label: 'Submitted',    cls: 'bg-slate-100 text-slate-700' },
  acknowledged: { label: 'Acknowledged', cls: 'bg-blue-100 text-blue-700' },
  in_progress:  { label: 'In progress',  cls: 'bg-amber-100 text-amber-700' },
  resolved:     { label: 'Resolved',     cls: 'bg-green-100 text-green-700' },
}

function categoryLabel(value: string) {
  return MAINTENANCE_CATEGORIES.find(c => c.value === value)?.label ?? value
}

export default async function MaintenancePage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoRequests = [
      {
        id: 'demo-maint-1',
        category: 'plumbing',
        urgency: 'medium',
        status: 'submitted',
        description: 'Kitchen faucet is dripping constantly.',
        landlord_comment: null,
        created_at: '2026-06-15T10:20:00Z',
        updated_at: '2026-06-15T10:20:00Z',
      },
      {
        id: 'demo-maint-2',
        category: 'electrical',
        urgency: 'low',
        status: 'resolved',
        description: 'Light switch in bedroom doesn\'t always work on first try.',
        landlord_comment: 'Fixed — replaced the switch.',
        created_at: '2026-05-10T14:00:00Z',
        updated_at: '2026-05-14T11:30:00Z',
      },
    ]
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
          <p className="text-sm text-slate-500 mt-1">Submit and track repair requests</p>
        </div>
        <MaintenanceForm />
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Your Requests</h2>
          <div className="rounded-xl border bg-white divide-y shadow-sm overflow-hidden">
            {demoRequests.map(r => {
              const st = statusConfig[r.status as keyof typeof statusConfig]
              return (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{categoryLabel(r.category)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          r.urgency === 'high' ? 'text-red-600' : r.urgency === 'medium' ? 'text-amber-600' : 'text-slate-500'
                        }`}>
                          {r.urgency}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{r.description}</p>
                      {r.landlord_comment && (
                        <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 mt-2">
                          Landlord: {r.landlord_comment}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1.5">
                        {format(new Date(r.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${st?.cls ?? 'bg-slate-100 text-slate-500'}`}>
                      {st?.label ?? r.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: requests } = await supabase
    .from('maintenance_requests')
    .select('id, category, urgency, status, description, landlord_comment, created_at, updated_at')
    .eq('tenant_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Maintenance</h1>
        <p className="text-sm text-slate-500 mt-1">Submit and track repair requests</p>
      </div>

      <MaintenanceForm />

      {requests && requests.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-800 mb-3">Your Requests</h2>
          <div className="rounded-xl border bg-white divide-y shadow-sm overflow-hidden">
            {requests.map(r => {
              const st = statusConfig[r.status as keyof typeof statusConfig]
              return (
                <div key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{categoryLabel(r.category)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          r.urgency === 'high' ? 'text-red-600' : r.urgency === 'medium' ? 'text-amber-600' : 'text-slate-500'
                        }`}>
                          {r.urgency}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">{r.description}</p>
                      {r.landlord_comment && (
                        <p className="text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2 mt-2">
                          Landlord: {r.landlord_comment}
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-1.5">
                        {format(new Date(r.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${st?.cls ?? 'bg-slate-100 text-slate-500'}`}>
                      {st?.label ?? r.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
