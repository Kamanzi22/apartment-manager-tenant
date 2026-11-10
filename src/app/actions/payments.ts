'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getLandlordId } from '@/lib/landlord'
import { notify } from '@/lib/notify'
import { formatRWF } from '@/lib/currency'
import { formatPeriodMonth } from '@/lib/rent-utils'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_RECEIPT_SIZE = 10 * 1024 * 1024

/**
 * Adds a payment for a month. Every submission is its own row: a month can be
 * paid in several parts (top up until it is paid in full), and a rejected
 * receipt stays in the history while the new one is reviewed. The database
 * (payments_guard) decides which months may be paid: up to 6 months ahead on
 * the current lease, or only what is owed on an ended lease.
 */
export async function submitPayment(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const leaseId = formData.get('lease_id') as string
  const periodMonth = formData.get('period_month') as string
  const amount = Math.round(Number(String(formData.get('amount') ?? '').replace(/,/g, '')))
  const file = formData.get('receipt') as File | null

  if (!leaseId || !MONTH_RE.test(periodMonth ?? '')) return { error: 'Choose the month you are paying for.' }
  if (!Number.isFinite(amount) || amount <= 0) return { error: 'Enter the amount you paid.' }
  if (!file || file.size === 0) return { error: 'Receipt is required' }
  if (file.size > MAX_RECEIPT_SIZE) return { error: 'The receipt is too large (max 10MB).' }

  const { data: lease } = await supabase
    .from('leases').select('id, units(label)').eq('id', leaseId).eq('tenant_id', user.id).maybeSingle()
  if (!lease) return { error: 'That lease was not found.' }

  const ext = (file.name.split('.').pop() ?? 'jpg').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'jpg'
  const path = `${user.id}/${periodMonth}-${Date.now()}.${ext}`
  const { error: uploadError } = await supabase.storage.from('receipts').upload(path, file)
  if (uploadError) return { error: uploadError.message }

  const { error } = await supabase.from('payments').insert({
    tenant_id: user.id,
    lease_id: leaseId,
    period_month: periodMonth,
    amount,
    receipt_file_url: path, // bare path: the bucket is private
    status: 'pending_review' as const,
  })
  if (error) {
    await supabase.storage.from('receipts').remove([path])
    return { error: error.message }
  }

  const landlordId = await getLandlordId(supabase)
  if (landlordId) {
    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
    const unitLabel = (lease.units as { label: string } | null)?.label ?? 'a unit'
    await notify(supabase, {
      user_id: landlordId,
      type: 'payment_submitted',
      title: 'New payment receipt',
      body: `${profile?.full_name ?? 'A tenant'} (${unitLabel}) submitted ${formatRWF(amount)} for ${formatPeriodMonth(periodMonth)}.`,
      link: '/landlord/rent',
    })
  }

  revalidatePath('/')
  return { success: true }
}
