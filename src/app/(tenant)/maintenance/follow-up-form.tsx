'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { addMaintenanceUpdate } from '@/app/actions/maintenance'

/** Add a message or photos to an open request. The request itself can't be edited. */
export function FollowUpForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="mt-2 min-h-11 text-xs font-semibold text-[var(--muted-2)] underline underline-offset-2">
        Add an update
      </button>
    )
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const fd = new FormData()
    fd.append('request_id', requestId)
    fd.append('body', body)
    for (const f of Array.from(fileRef.current?.files ?? [])) fd.append('photos', f)
    start(async () => {
      const r = await addMaintenanceUpdate(fd)
      if (r?.error) toast.error(r.error)
      else { toast.success('Update sent to your landlord'); setBody(''); setOpen(false) }
    })
  }

  return (
    <form onSubmit={submit} className="mt-3 space-y-2">
      <label htmlFor={`fu-${requestId}`} className="block text-xs font-semibold text-[var(--ink)]">Update for your landlord</label>
      <textarea id={`fu-${requestId}`} required maxLength={2000} rows={2} value={body} onChange={e => setBody(e.target.value)}
        placeholder="e.g. It is still leaking" className="glass-input text-sm h-auto! py-2" />
      <input ref={fileRef} type="file" accept="image/*" multiple aria-label="Add photos" className="text-xs" />
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-primary">{pending ? 'Sending…' : 'Send update'}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-4 text-sm text-[var(--muted-2)]">Cancel</button>
      </div>
    </form>
  )
}
