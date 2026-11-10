import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getLandlord } from '@/lib/landlord'
import { markMessagesRead } from '@/app/actions/messages'
import { MessageThread } from './message-thread'

// Newest messages first (then shown oldest -> newest), so the latest ones are
// never cut off by Supabase's row limit.
const PAGE = 200

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
      <div className="space-y-4 flex flex-col h-[calc(100dvh-11rem)]">
        <div>
          <h1 className="on-photo text-3xl font-semibold tracking-tight">Messages</h1>
          <p className="on-photo text-sm mt-1 opacity-95">Chat with Your Landlord</p>
        </div>
        <MessageThread messages={demoMessages} currentUserId="demo-sarah" />
      </div>
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const landlord = await getLandlord(supabase)

  // Opening this page clears the unread badge (direct messages and broadcasts).
  await markMessagesRead()

  // RLS already limits broadcasts to those sent since the current lease began.
  const { data: newest } = await supabase
    .from('messages')
    .select('id, sender_id, recipient_id, body, created_at')
    .or(
      landlord
        ? `and(sender_id.eq.${user.id},recipient_id.eq.${landlord.id}),and(sender_id.eq.${landlord.id},recipient_id.eq.${user.id}),recipient_id.is.null`
        : `sender_id.eq.${user.id}`
    )
    .order('created_at', { ascending: false })
    .limit(PAGE)

  const messages = [...(newest ?? [])].reverse()

  return (
    <div className="space-y-4 flex flex-col h-[calc(100dvh-11rem)]">
      <div>
        <h1 className="on-photo text-3xl font-semibold tracking-tight">Messages</h1>
        <p className="on-photo text-sm mt-1 opacity-95">
          {landlord?.full_name ? `Chat with ${landlord.full_name}` : 'Your landlord'}
          {(newest?.length ?? 0) === PAGE && ' · newest 200 messages'}
        </p>
      </div>
      <MessageThread messages={messages} currentUserId={user.id} />
    </div>
  )
}
