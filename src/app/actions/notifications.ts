'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function markNotificationRead(id: string) {
  const supabase = await createClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/notifications')
}

export async function markAllNotificationsRead() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase.from('notifications').update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id).is('read_at', null)
  revalidatePath('/notifications')
}

/** Whether alerts and repair updates are also emailed to this tenant. */
export async function setEmailNotifications(on: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { error } = await supabase.from('profiles').update({ email_notifications: !!on }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/notifications')
  return { success: true }
}
