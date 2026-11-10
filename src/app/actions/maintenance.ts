'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MaintenanceCategory, Urgency } from '@/lib/categories'
import { getLandlordId } from '@/lib/landlord'
import { notify } from '@/lib/notify'

export async function submitMaintenanceRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase
    .from('profiles').select('unit_id, full_name, units(label)').eq('id', user.id).single()
  if (!profile?.unit_id) return { error: 'No unit assigned' }

  const photoFiles = formData.getAll('photos') as File[]
  const photoPaths: string[] = []

  for (const file of photoFiles.filter(f => f.size > 0)) {
    const ext = (file.name.split('.').pop() ?? 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg'
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage.from('maintenance-photos').upload(path, file)
    if (!uploadError) photoPaths.push(path) // bare path: the bucket is private
  }

  const { error } = await supabase.from('maintenance_requests').insert({
    tenant_id: user.id,
    unit_id: profile.unit_id,
    category: formData.get('category') as MaintenanceCategory,
    urgency: formData.get('urgency') as Urgency,
    description: formData.get('description') as string,
    photo_urls: photoPaths,
    status: 'submitted' as const,
  })

  if (error) return { error: error.message }

  const landlordId = await getLandlordId(supabase)
  if (landlordId) {
    const unitLabel = (profile.units as { label: string } | null)?.label ?? 'a unit'
    await notify(supabase, {
      user_id: landlordId,
      type: 'maintenance_submitted',
      title: 'Maintenance request',
      body: `${profile.full_name} (${unitLabel}): new ${formData.get('urgency')} priority ${formData.get('category')} request.`,
      link: '/landlord/maintenance',
    })
  }

  revalidatePath('/maintenance')
  return { success: true }
}
