'use client'

import { useState, useTransition } from 'react'
import { submitMoveOutNotice } from '@/app/actions/move-out'
import { format, addDays } from 'date-fns'
import { toast } from 'sonner'

export function MoveOutForm({ leaseId }: { leaseId: string | null }) {
  const today = new Date()
  const minDate = format(addDays(today, 30), 'yyyy-MM-dd')

  const [moveOutDate, setMoveOutDate] = useState(minDate)
  const [reason, setReason] = useState('')
  const [pending, startTransition] = useTransition()

  if (!leaseId) {
    return (
      <div className="text-center py-10 text-slate-400 text-sm">
        No active lease found. Contact your landlord.
      </div>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('lease_id', leaseId!)
    fd.append('move_out_date', moveOutDate)
    fd.append('reason', reason)
    startTransition(async () => {
      const result = await submitMoveOutNotice(fd)
      if (result?.error) toast.error(result.error)
      else toast.success('Move-out notice submitted')
    })
  }

  return (
    <div className="glass p-5">
      <h2 className="font-semibold text-slate-900 mb-4">Submit Move-out Notice</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Move-out date *</label>
          <input
            type="date"
            required
            min={minDate}
            value={moveOutDate}
            onChange={e => setMoveOutDate(e.target.value)}
            className="w-full border border-white/85 rounded-[14px] px-3.5 min-h-11 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white/70"
          />
          <p className="text-xs text-slate-400">Must be at least 30 days from today ({format(today, 'MMM d')})</p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Reason (optional)</label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Reason for moving out…"
            className="w-full border border-white/85 rounded-[14px] px-3.5 min-h-11 text-sm text-slate-900 resize-none h-24 focus:outline-none focus:ring-2 focus:ring-slate-500 bg-white/70"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full"
        >
          {pending ? 'Submitting…' : 'Submit Notice'}
        </button>
      </form>
    </div>
  )
}
