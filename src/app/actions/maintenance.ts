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
    // No status: the database starts every request as 'submitted' and only
    // the landlord can change it.
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

/** A follow-up on the tenant's own open request ("still leaking", a new photo). */
export async function addMaintenanceUpdate(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const requestId = formData.get('request_id') as string
  const body = ((formData.get('body') as string) ?? '').trim()
  if (!body) return { error: 'Write a short message' }
  if (body.length > 2000) return { error: 'The message is too long (2,000 characters at most)' }

  const { data: req } = await supabase
    .from('maintenance_requests').select('id, status, category, units(label)').eq('id', requestId).eq('tenant_id', user.id).maybeSingle()
  if (!req) return { error: 'Request not found' }
  if (req.status === 'resolved' || req.status === 'closed') return { error: 'This request is finished. Send a new request instead.' }

  const photoPaths: string[] = []
  for (const file of (formData.getAll('photos') as File[]).filter(f => f.size > 0).slice(0, 5)) {
    const ext = (file.name.split('.').pop() ?? 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg'
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage.from('maintenance-photos').upload(path, file)
    if (!uploadError) photoPaths.push(path)
  }

  const { error } = await supabase.from('maintenance_updates').insert({
    request_id: requestId, author_id: user.id, body, photo_paths: photoPaths,
  })
  if (error) return { error: error.message }

  const landlordId = await getLandlordId(supabase)
  if (landlordId) {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const unitLabel = (req.units as { label: string } | null)?.label ?? 'a unit'
    await notify(supabase, {
      user_id: landlordId,
      type: 'maintenance_follow_up',
      title: 'Update on a repair request',
      body: `${profile?.full_name ?? 'A tenant'} (${unitLabel}): ${body.slice(0, 100)}`,
      link: '/landlord/maintenance',
    })
  }

  revalidatePath('/maintenance')
  return { success: true }
}
