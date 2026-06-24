'use client'

import { useTransition } from 'react'
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications'
import { BellOff } from 'lucide-react'
import { format } from 'date-fns'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: string | null
  created_at: string
}

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const [pending, startTransition] = useTransition()
  const hasUnread = notifications.some(n => !n.read_at)

  return (
    <div className="space-y-3">
      {hasUnread && (
        <div className="flex justify-end">
          <button
            onClick={() => startTransition(() => markAllNotificationsRead())}
            disabled={pending}
            className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
          >
            Mark all as read
          </button>
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <BellOff className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white divide-y shadow-sm overflow-hidden">
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => {
                if (!n.read_at) startTransition(() => markNotificationRead(n.id))
              }}
              className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${n.read_at ? 'bg-transparent' : 'bg-blue-500'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.read_at ? 'text-slate-600' : 'text-slate-900 font-medium'}`}>{n.title}</p>
                {n.body && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-xs text-slate-400 mt-1">{format(new Date(n.created_at), 'MMM d, h:mm a')}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
