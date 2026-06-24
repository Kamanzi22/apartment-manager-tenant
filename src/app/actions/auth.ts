'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signOut() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    redirect('/login')
  }
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function registerTenant(formData: FormData): Promise<{ error?: string; email?: string }> {
  const email    = (formData.get('email')     as string).trim()
  const password = formData.get('password')   as string
  const fullName = (formData.get('full_name') as string).trim()
  const phone    = ((formData.get('phone')    as string) || '').trim() || null

  if (!email || !password || !fullName) return { error: 'Name, email and password are required.' }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' }

  const admin = await createAdminClient()

  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !newUser.user) {
    return { error: createError?.message ?? 'Failed to create account.' }
  }

  const { error: profileError } = await admin.from('profiles').insert({
    id: newUser.user.id,
    role: 'tenant',
    full_name: fullName,
    phone: phone ?? null,
    unit_id: null,
  })

  if (profileError) {
    await admin.auth.admin.deleteUser(newUser.user.id)
    return { error: profileError.message }
  }

  return { email }
}

export async function lookupEmailByPhone(phone: string): Promise<string | null> {
  const admin = await createAdminClient()

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, phone')
    .eq('role', 'tenant')
    .not('phone', 'is', null)

  if (!profiles?.length) return null

  const normalize = (p: string) => p.replace(/\D/g, '')
  const normalizedInput = normalize(phone)
  const match = profiles.find(p => p.phone && normalize(p.phone) === normalizedInput)
  if (!match) return null

  const { data } = await admin.auth.admin.getUserById(match.id)
  return data.user?.email ?? null
}
