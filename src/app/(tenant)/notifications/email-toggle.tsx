'use client'

import { useState, useTransition } from 'react'
import { Mail, MailX } from 'lucide-react'
import { toast } from 'sonner'
import { setEmailNotifications } from '@/app/actions/notifications'

/** Whether rent reminders and repair updates are also emailed. */
export function EmailToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, start] = useTransition()

  function toggle() {
    const next = !on
    start(async () => {
      const r = await setEmailNotifications(next)
      if (r?.error) { toast.error(r.error); return }
      setOn(next)
      toast.success(next ? 'Email alerts turned on' : 'Email alerts turned off')
    })
  }

  return (
    <button type="button" onClick={toggle} disabled={pending} aria-pressed={on}
      className="inline-flex items-center gap-2 min-h-11 px-4 rounded-full text-sm font-semibold glass-row hover:bg-white/80 disabled:opacity-60">
      {on ? <Mail className="h-4 w-4" /> : <MailX className="h-4 w-4" />}
      {on ? 'Email alerts on' : 'Email alerts off'}
    </button>
  )
}
