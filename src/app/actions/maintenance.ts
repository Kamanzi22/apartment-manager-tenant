'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { MaintenanceCategory, Urgency } from '@/lib/categories'

export async function submitMaintenanceRequest(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('profiles').select('unit_id').eq('id', user.id).single()
  if (!profile?.unit_id) return { error: 'No unit assigned' }

  const photoFiles = formData.getAll('photos') as File[]
  const photoUrls: string[] = []

  for (const file of photoFiles.filter(f => f.size > 0)) {
    const ext = file.name.split('.').pop()
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error: uploadError } = await supabase.storage.from('maintenance-photos').upload(path, file)
    if (!uploadError) {
      const { data: { publicUrl } } = supabase.storage.from('maintenance-photos').getPublicUrl(path)
      photoUrls.push(publicUrl)
    }
  }

  const { error } = await supabase.from('maintenance_requests').insert({
    tenant_id: user.id,
    unit_id: profile.unit_id,
    category: formData.get('category') as MaintenanceCategory,
    urgency: formData.get('urgency') as Urgency,
    description: formData.get('description') as string,
    photo_urls: photoUrls,
    status: 'submitted' as const,
  })

  if (error) return { error: error.message }

  const { data: landlord } = await supabase.from('profiles').select('id').eq('role', 'landlord').single()
  if (landlord) {
    await supabase.from('notifications').insert({
      user_id: landlord.id,
      type: 'maintenance_submitted',
      title: 'Maintenance request',
      body: `New ${formData.get('category')} request submitted`,
      link: '/landlord/maintenance',
    })
  }

  revalidatePath('/maintenance')
  return { success: true }
}
