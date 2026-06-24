import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NotificationList } from './notification-list'

export default async function NotificationsPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoNotifications = [
      {
        id: 'demo-notif-1',
        type: 'payment_confirmed',
        title: 'Rent confirmed',
        body: 'Your payment of $1,200 for June 2026 has been confirmed.',
        link: null,
        read_at: '2026-06-03T10:00:00Z',
        created_at: '2026-06-03T10:00:00Z',
      },
      {
        id: 'demo-notif-2',
        type: 'general',
        title: 'Welcome to Tenant Portal',
        body: 'You can submit maintenance requests, pay rent, and message your landlord here.',
        link: null,
        read_at: null,
        created_at: '2024-01-01T09:00:00Z',
      },
    ]
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
        <NotificationList notifications={demoNotifications} />
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('id, type, title, body, link, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-slate-900">Notifications</h1>
      <NotificationList notifications={notifications ?? []} />
    </div>
  )
}
