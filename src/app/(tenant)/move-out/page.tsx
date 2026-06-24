import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MoveOutForm } from './move-out-form'
import { format } from 'date-fns'
import { CheckCircle2, Clock } from 'lucide-react'

export default async function MoveOutPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Move-out Notice</h1>
          <p className="text-sm text-slate-500 mt-1">At least 30 days notice required</p>
        </div>
        <MoveOutForm leaseId={null} />
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notice } = await supabase
    .from('move_out_notices')
    .select('id, intended_move_out_date, reason, status, created_at')
    .eq('tenant_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fetch lease_id for the form
  const { data: lease } = await supabase
    .from('leases')
    .select('id')
    .eq('tenant_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Move-out Notice</h1>
        <p className="text-sm text-slate-500 mt-1">At least 30 days notice required</p>
      </div>

      {notice ? (
        <div className="bg-white rounded-2xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            {notice.status === 'acknowledged' ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Clock className="h-5 w-5 text-amber-500" />
            )}
            <span className={`text-sm font-semibold ${notice.status === 'acknowledged' ? 'text-green-700' : 'text-amber-700'}`}>
              {notice.status === 'acknowledged' ? 'Acknowledged by landlord' : 'Pending acknowledgment'}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Move-out date</span>
              <span className="font-medium text-slate-800">{format(new Date(notice.intended_move_out_date), 'MMMM d, yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Submitted</span>
              <span className="font-medium text-slate-800">{format(new Date(notice.created_at), 'MMM d, yyyy')}</span>
            </div>
            {notice.reason && (
              <div>
                <span className="text-slate-500 block mb-1">Reason</span>
                <p className="text-slate-700">{notice.reason}</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <MoveOutForm leaseId={lease?.id ?? null} />
      )}
    </div>
  )
}
