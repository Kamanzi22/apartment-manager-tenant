'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitMoveOutNotice(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const leaseId = formData.get('lease_id') as string
  const moveOutDate = formData.get('move_out_date') as string
  const reason = formData.get('reason') as string

  const daysUntil = Math.floor((new Date(moveOutDate).getTime() - Date.now()) / 86400000)
  if (daysUntil < 30) return { error: 'Move-out date must be at least 30 days from today' }

  const { error } = await supabase.from('move_out_notices').insert({
    tenant_id: user.id,
    lease_id: leaseId,
    intended_move_out_date: moveOutDate,
    reason: reason || null,
    status: 'submitted' as const,
  })
  if (error) return { error: error.message }

  const { data: landlord } = await supabase.from('profiles').select('id').eq('role', 'landlord').single()
  if (landlord) {
    await supabase.from('notifications').insert({
      user_id: landlord.id,
      type: 'move_out_notice',
      title: 'Move-out notice',
      body: `Tenant submitted a move-out notice for ${moveOutDate}`,
      link: '/landlord/move-out',
    })
  }

  revalidatePath('/move-out')
  return { success: true }
}
