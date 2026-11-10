'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { emailLayout, sendEmail } from '@/lib/email'
import { publicOriginFromHeaders } from '@/lib/public-origin'

export async function signOut() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    redirect('/login')
  }
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// Same message whether or not the account exists, so the login form cannot be
// used to find out who has an account.
const GENERIC_ERROR = 'Invalid credentials. Check your email/phone and password.'
const NETWORK_ERROR = 'Could not reach the server. Check your connection and try again.'

async function tenantEmailForPhone(phone: string): Promise<string | null> {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 6) return null
  const admin = await createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, phone')
    .eq('role', 'tenant')
    .not('phone', 'is', null)
  const matches = (profiles ?? []).filter(p => p.phone && p.phone.replace(/\D/g, '') === digits)
  if (matches.length !== 1) return null
  const { data } = await admin.auth.admin.getUserById(matches[0].id)
  return data.user?.email ?? null
}

/**
 * Signs in with an email or a phone number. The email for a phone number is
 * looked up and used here on the server; it is never sent to the browser.
 */
export async function signInWithIdentifier(identifier: string, password: string): Promise<{ error?: string }> {
  const id = (identifier ?? '').trim()
  if (!id || !password) return { error: GENERIC_ERROR }
  try {
    const email = id.includes('@') ? id : await tenantEmailForPhone(id)
    if (!email) return { error: GENERIC_ERROR }
    const supabase = await createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.status && error.status >= 500 ? NETWORK_ERROR : GENERIC_ERROR }
    return {}
  } catch {
    return { error: NETWORK_ERROR }
  }
}

export async function registerTenant(formData: FormData): Promise<{ error?: string; email?: string }> {
  const email    = ((formData.get('email')     as string) ?? '').trim()
  const password = formData.get('password')   as string
  const fullName = ((formData.get('full_name') as string) ?? '').trim()
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

export async function sendPasswordResetEmail(email: string): Promise<{ error?: string }> {
  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
    return { error: 'Email service not configured. Contact your property manager to reset your password.' }
  }

  const admin = await createAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim(),
  })

  // Generic success to avoid revealing whether the email is registered
  if (error || !data?.properties?.hashed_token) return {}

  // Link straight to our own /auth/confirm, which verifies the token server-side and sets the
  // session cookies. Supabase's action_link instead returns tokens in the URL hash (implicit
  // flow), which the PKCE browser client rejects — every reset showed "link expired".
  const origin = await publicOriginFromHeaders()
  const resetLink = `${origin}/auth/confirm?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery&next=/reset-password`

  const ok = await sendEmail(email.trim(), 'Reset your Tenant Portal password', emailLayout(
    'Password Reset',
    'Click the button below to set a new password for your Tenant Portal account. This link expires in 24&nbsp;hours. If you did not request this, you can safely ignore this email.',
    { href: resetLink, label: 'Reset Password' },
  ))
  if (!ok) return { error: 'Failed to send email. Please try again.' }
  return {}
}
