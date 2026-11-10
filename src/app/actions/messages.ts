'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLandlordId } from '@/lib/landlord'
import { notify } from '@/lib/notify'

export async function sendMessage(body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const text = (body ?? '').trim()
  if (!text) return { error: 'Message cannot be empty' }

  const landlordId = await getLandlordId(supabase)
  if (!landlordId) return { error: 'Landlord not found' }

  const { error } = await supabase.from('messages').insert({
    sender_id: user.id,
    recipient_id: landlordId,
    body: text,
  })
  if (error) return { error: error.message }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
  await notify(supabase, {
    user_id: landlordId,
    type: 'new_message',
    title: `New message from ${profile?.full_name ?? 'a tenant'}`,
    body: text.slice(0, 100),
    link: '/landlord/messages',
  })

  revalidatePath('/messages')
  return { success: true }
}

/**
 * Opening Messages marks everything there as read: direct messages through
 * read_at, broadcasts through message_reads (one row per tenant, so one
 * tenant reading an announcement does not mark it read for everyone).
 */
export async function markMessagesRead() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const now = new Date().toISOString()
  await supabase.from('messages').update({ read_at: now }).eq('recipient_id', user.id).is('read_at', null)

  const [{ data: broadcasts }, { data: reads }] = await Promise.all([
    supabase.from('messages').select('id').is('recipient_id', null).order('created_at', { ascending: false }).limit(500),
    supabase.from('message_reads').select('message_id').eq('user_id', user.id).limit(1000),
  ])
  const done = new Set((reads ?? []).map(r => r.message_id))
  const unread = (broadcasts ?? []).filter(b => !done.has(b.id))
  if (unread.length) {
    await supabase.from('message_reads').upsert(
      unread.map(b => ({ message_id: b.id, user_id: user.id, read_at: now })),
      { onConflict: 'message_id,user_id', ignoreDuplicates: true },
    )
  }
}
