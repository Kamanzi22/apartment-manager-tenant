import { Wrench } from 'lucide-react'
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

interface Request {
  id: string
  category: string
  urgency: string
  status: string
  description: string
  landlord_comment: string | null
  created_at: string
  updated_at: string
}

function categoryLabel(value: string) {
  return MAINTENANCE_CATEGORIES.find(c => c.value === value)?.label ?? value
}

export default async function MaintenancePage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoRequests: Request[] = [
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
    return <MaintenanceView requests={demoRequests} />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: requests } = await supabase
    .from('maintenance_requests')
    .select('id, category, urgency, status, description, landlord_comment, created_at, updated_at')
    .eq('tenant_id', user.id)
    .order('created_at', { ascending: false })

  return <MaintenanceView requests={requests ?? []} />
}

function MaintenanceView({ requests }: { requests: Request[] }) {
  const open = requests.filter(r => r.status !== 'resolved')
  const history = requests
    .filter(r => r.status === 'resolved')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="on-photo text-3xl font-semibold tracking-tight">Maintenance</h1>
        <p className="on-photo text-sm mt-1 opacity-95">Submit and track repair requests</p>
      </div>

      <MaintenanceForm />

      <section className="glass p-5">
        <h2 className="text-base font-semibold mb-3">
          Open Requests {open.length > 0 && <span className="text-[var(--muted)] font-normal">({open.length})</span>}
        </h2>
        {open.length === 0 ? <EmptyState text="No open requests" /> : <RequestList requests={open} />}
      </section>

      <section className="glass p-5">
        <h2 className="text-base font-semibold mb-3">
          History {history.length > 0 && <span className="text-[var(--muted)] font-normal">({history.length})</span>}
        </h2>
        {history.length === 0
          ? <EmptyState text="No resolved requests yet" />
          : <RequestList requests={history} showResolved />}
      </section>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <Wrench className="h-5 w-5" />
      <p>{text}</p>
    </div>
  )
}

function RequestList({ requests, showResolved = false }: { requests: Request[]; showResolved?: boolean }) {
  return (
    <div className="space-y-2">
      {requests.map(r => {
        const st = statusConfig[r.status as keyof typeof statusConfig]
        const updated = r.updated_at !== r.created_at
        return (
          <div key={r.id} className="glass-row p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-900">{categoryLabel(r.category)}</span>
                  <span className={`chip ${
                    r.urgency === 'high' ? 'text-red-600' : r.urgency === 'medium' ? 'text-amber-600' : 'text-slate-500'
                  }`}>
                    {r.urgency}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{r.description}</p>
                {r.landlord_comment && (
                  <p className="text-sm text-[var(--ink)] bg-white/75 rounded-xl px-3 py-2 mt-2">
                    Landlord: {r.landlord_comment}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5">
                  Submitted {format(new Date(r.created_at), 'MMM d, yyyy')}
                  {showResolved && ` · Resolved ${format(new Date(r.updated_at), 'MMM d, yyyy')}`}
                  {!showResolved && updated && ` · Updated ${format(new Date(r.updated_at), 'MMM d, yyyy')}`}
                </p>
              </div>
              <span className={`chip shrink-0 ${st?.cls ?? 'bg-slate-100 text-slate-500'}`}>
                {st?.label ?? r.status}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
