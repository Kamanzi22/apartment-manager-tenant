import { Wrench } from 'lucide-react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MaintenanceForm } from './maintenance-form'
import { FollowUpForm } from './follow-up-form'
import { MAINTENANCE_CATEGORIES } from '@/lib/categories'
import { isOpenStatus, statusInfo } from '@/lib/maintenance'
import { format, parseISO } from 'date-fns'
import { fileUrl } from '@/lib/storage-url'

interface Request {
  id: string
  category: string
  urgency: string
  status: string
  description: string
  landlord_comment: string | null
  scheduled_for?: string | null
  photo_urls?: string[] | null
  created_at: string
  updated_at: string
}
interface HistoryEntry { request_id: string; to_status: string; comment: string | null; changed_at: string }
interface FollowUp { id: string; request_id: string; body: string; photo_paths: string[]; created_at: string }

function categoryLabel(value: string) {
  return MAINTENANCE_CATEGORIES.find(c => c.value === value)?.label ?? value
}

export default async function MaintenancePage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoRequests: Request[] = [
      {
        id: 'demo-maint-1', category: 'plumbing', urgency: 'medium', status: 'scheduled',
        description: 'Kitchen faucet is dripping constantly.', landlord_comment: 'Plumber booked.',
        scheduled_for: '2026-06-18', created_at: '2026-06-15T10:20:00Z', updated_at: '2026-06-16T09:00:00Z',
      },
      {
        id: 'demo-maint-2', category: 'electrical', urgency: 'low', status: 'resolved',
        description: 'Light switch in bedroom doesn\'t always work on first try.', landlord_comment: 'Fixed — replaced the switch.',
        created_at: '2026-05-10T14:00:00Z', updated_at: '2026-05-14T11:30:00Z',
      },
    ]
    return <MaintenanceView requests={demoRequests} history={[]} updates={[]} hasUnit />
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: requests }, { data: profile }] = await Promise.all([
    supabase
      .from('maintenance_requests')
      .select('id, category, urgency, status, description, landlord_comment, scheduled_for, photo_urls, created_at, updated_at')
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('profiles').select('unit_id').eq('id', user.id).single(),
  ])
  const ids = (requests ?? []).map(r => r.id)
  const [{ data: history }, { data: updates }] = ids.length
    ? await Promise.all([
        supabase.from('maintenance_status_history').select('request_id, to_status, comment, changed_at')
          .in('request_id', ids).order('changed_at'),
        supabase.from('maintenance_updates').select('id, request_id, body, photo_paths, created_at')
          .in('request_id', ids).order('created_at'),
      ])
    : [{ data: [] }, { data: [] }]

  return (
    <MaintenanceView
      requests={requests ?? []}
      history={(history ?? []) as HistoryEntry[]}
      updates={(updates ?? []) as FollowUp[]}
      hasUnit={!!profile?.unit_id}
    />
  )
}

function MaintenanceView({ requests, history, updates, hasUnit }: {
  requests: Request[]; history: HistoryEntry[]; updates: FollowUp[]; hasUnit: boolean
}) {
  const open = requests.filter(r => isOpenStatus(r.status))
  const done = requests
    .filter(r => !isOpenStatus(r.status))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="on-photo text-3xl font-semibold tracking-tight">Maintenance</h1>
        <p className="on-photo text-sm mt-1 opacity-95">Report a problem and follow the repair</p>
      </div>

      {hasUnit ? <MaintenanceForm /> : (
        <section className="glass p-5 text-sm text-[var(--muted-2)]">
          You are not living in one of the units now, so new requests are switched off. Your past requests are below.
        </section>
      )}

      <section className="glass p-5">
        <h2 className="text-base font-semibold mb-3">
          Open Requests {open.length > 0 && <span className="text-[var(--muted)] font-normal">({open.length})</span>}
        </h2>
        {open.length === 0 ? <EmptyState text="No open requests" /> : <RequestList requests={open} history={history} updates={updates} />}
      </section>

      <section className="glass p-5">
        <h2 className="text-base font-semibold mb-3">
          History {done.length > 0 && <span className="text-[var(--muted)] font-normal">({done.length})</span>}
        </h2>
        {done.length === 0
          ? <EmptyState text="No finished requests yet" />
          : <RequestList requests={done} history={history} updates={updates} />}
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

function Photos({ paths }: { paths: string[] | null | undefined }) {
  if (!paths?.length) return null
  return (
    <div className="flex gap-2 flex-wrap mt-2">
      {paths.map((stored, i) => {
        const url = fileUrl('maintenance-photos', stored)
        return url ? (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Photo ${i + 1}`} className="h-14 w-14 rounded-xl object-cover border border-white/85" />
          </a>
        ) : null
      })}
    </div>
  )
}

// Read-only: the tenant sees the status the landlord set, never changes it.
function RequestList({ requests, history, updates }: { requests: Request[]; history: HistoryEntry[]; updates: FollowUp[] }) {
  return (
    <div className="space-y-2">
      {requests.map(r => {
        const st = statusInfo(r.status)
        const timeline = [
          ...history.filter(h => h.request_id === r.id).map(h => ({
            at: h.changed_at, who: 'status' as const, text: statusInfo(h.to_status).label, note: h.comment, photos: [] as string[],
          })),
          ...updates.filter(u => u.request_id === r.id).map(u => ({
            at: u.created_at, who: 'you' as const, text: 'You added', note: u.body, photos: u.photo_paths,
          })),
        ].sort((a, b) => a.at.localeCompare(b.at))
        return (
          <article key={r.id} className="glass-row p-4" aria-label={`${categoryLabel(r.category)} request`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-900">{categoryLabel(r.category)}</span>
                  <span className={`chip ${r.urgency === 'high' ? 'text-red-600' : r.urgency === 'medium' ? 'text-amber-600' : 'text-slate-500'}`}>
                    {r.urgency}
                  </span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">{r.description}</p>
                <Photos paths={r.photo_urls} />
                {r.status === 'scheduled' && r.scheduled_for && (
                  <p className="text-sm font-semibold text-[var(--ink)] mt-2">
                    Scheduled for {format(parseISO(r.scheduled_for), 'EEEE d MMMM yyyy')}
                  </p>
                )}
                {r.landlord_comment && (
                  <p className="text-sm text-[var(--ink)] bg-white/75 rounded-xl px-3 py-2 mt-2">
                    Landlord: {r.landlord_comment}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1.5">Submitted {format(new Date(r.created_at), 'MMM d, yyyy')}</p>
              </div>
              <span className={`chip shrink-0 ${st.cls}`}>{st.label}</span>
            </div>

            {timeline.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-[var(--muted-2)] min-h-9 flex items-center">
                  History ({timeline.length})
                </summary>
                <ol className="mt-1 space-y-1.5 border-l-2 border-white/80 pl-3">
                  {timeline.map((e, i) => (
                    <li key={i} className="text-xs text-[var(--muted-2)]">
                      <span className="text-slate-400">{format(new Date(e.at), 'MMM d, yyyy HH:mm')}</span>{' '}
                      <span className="font-semibold text-[var(--ink)]">{e.text}</span>
                      {e.note && <span> · {e.note}</span>}
                      <Photos paths={e.photos} />
                    </li>
                  ))}
                </ol>
              </details>
            )}

            {isOpenStatus(r.status) && <FollowUpForm requestId={r.id} />}
          </article>
        )
      })}
    </div>
  )
}
