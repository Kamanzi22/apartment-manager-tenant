'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function sendMessage(body: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: landlord } = await supabase.from('profiles').select('id').eq('role', 'landlord').single()
  if (!landlord) return { error: 'Landlord not found' }

  const { error } = await supabase.from('messages').insert({
    sender_id: user.id,
    recipient_id: landlord.id,
    body,
  })
  if (error) return { error: error.message }

  await supabase.from('notifications').insert({
    user_id: landlord.id,
    type: 'message',
    title: 'New message',
    body: body.slice(0, 100),
    link: '/landlord/messages',
  })

  revalidatePath('/messages')
  return { success: true }
}
