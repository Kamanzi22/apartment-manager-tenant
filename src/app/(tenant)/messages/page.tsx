import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessageThread } from './message-thread'

export default async function MessagesPage() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    const demoMessages = [
      {
        id: 'demo-msg-1',
        sender_id: 'demo-landlord',
        recipient_id: 'demo-sarah',
        body: 'Hi Sarah, just a reminder that rent is due on the 1st. Let me know if you have any questions!',
        created_at: '2026-06-01T08:00:00Z',
      },
      {
        id: 'demo-msg-2',
        sender_id: 'demo-sarah',
        recipient_id: 'demo-landlord',
        body: "Thanks, I've already submitted my payment for June!",
        created_at: '2026-06-02T09:30:00Z',
      },
    ]
    return (
      <div className="space-y-4 flex flex-col h-[calc(100vh-8rem)]">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
          <p className="text-sm text-slate-500 mt-1">Chat with Your Landlord</p>
        </div>
        <MessageThread messages={demoMessages} currentUserId="demo-sarah" />
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { createAdminClient } = await import('@/lib/supabase/server')
  const admin = await createAdminClient()
  const { data: landlord } = await admin.from('profiles').select('id, full_name').eq('role', 'landlord').single()

  const { data: messages } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at')
    .or(
      landlord
        ? `and(sender_id.eq.${user.id},recipient_id.eq.${landlord.id}),and(sender_id.eq.${landlord.id},recipient_id.eq.${user.id}),recipient_id.is.null`
        : `sender_id.eq.${user.id}`
    )
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-4 flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
        <p className="text-sm text-slate-500 mt-1">
          {landlord?.full_name ? `Chat with ${landlord.full_name}` : 'Your landlord'}
        </p>
      </div>
      <MessageThread messages={messages ?? []} currentUserId={user.id} />
    </div>
  )
}
