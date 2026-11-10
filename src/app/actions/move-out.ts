'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { getLandlordId } from '@/lib/landlord'
import { notify } from '@/lib/notify'
import { kigaliToday } from '@/lib/rent-utils'

export async function submitMoveOutNotice(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const leaseId = formData.get('lease_id') as string
  const moveOutDate = formData.get('move_out_date') as string
  const reason = ((formData.get('reason') as string) ?? '').trim()

  if (!/^\d{4}-\d{2}-\d{2}$/.test(moveOutDate ?? '')) return { error: 'Choose your move-out date' }
  if (differenceInCalendarDays(parseISO(moveOutDate), kigaliToday()) < 30) {
    return { error: 'Move-out date must be at least 30 days from today' }
  }

  const { data: lease } = await supabase
    .from('leases').select('id, unit_id').eq('id', leaseId).eq('tenant_id', user.id).eq('status', 'active').maybeSingle()
  if (!lease) return { error: 'No active lease found' }

  const { error } = await supabase.from('move_out_notices').insert({
    tenant_id: user.id,
    lease_id: lease.id,
    intended_move_out_date: moveOutDate,
    reason: reason || null,
    status: 'submitted' as const,
  })
  if (error) return { error: error.message }

  const landlordId = await getLandlordId(supabase)
  if (landlordId) {
    const { data: profile } = await supabase.from('profiles').select('full_name, units(label)').eq('id', user.id).single()
    const unitLabel = (profile?.units as { label: string } | null)?.label ?? 'a unit'
    await notify(supabase, {
      user_id: landlordId,
      type: 'move_out_notice',
      title: 'Move-out notice',
      body: `${profile?.full_name ?? 'A tenant'} (${unitLabel}) plans to move out on ${moveOutDate}.`,
      link: `/landlord/units/${lease.unit_id}`,
    })
  }

  revalidatePath('/move-out')
  return { success: true }
}
