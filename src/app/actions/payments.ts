'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function submitPayment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const leaseId = formData.get('lease_id') as string
  const periodMonth = formData.get('period_month') as string
  const amount = parseFloat(formData.get('amount') as string)
  const file = formData.get('receipt') as File

  if (!file || file.size === 0) return { error: 'Receipt is required' }

  const ext = file.name.split('.').pop()
  const path = `${user.id}/${periodMonth}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, file, { upsert: true })
  if (uploadError) return { error: uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(path)

  const { error } = await supabase.from('payments').upsert({
    tenant_id: user.id,
    lease_id: leaseId,
    period_month: periodMonth,
    amount,
    receipt_file_url: publicUrl,
    status: 'pending_review' as const,
    submitted_at: new Date().toISOString(),
  }, { onConflict: 'lease_id,period_month' })

  if (error) return { error: error.message }

  const { data: landlord } = await supabase.from('profiles').select('id').eq('role', 'landlord').single()
  if (landlord) {
    await supabase.from('notifications').insert({
      user_id: landlord.id,
      type: 'payment_submitted',
      title: 'Payment submitted',
      body: `Rent payment submitted for ${periodMonth}`,
      link: '/landlord/rent',
    })
  }

  revalidatePath('/')
  return { success: true }
}
