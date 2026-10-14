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

export async function sendPasswordResetEmail(email: string): Promise<{ error?: string }> {
  const brevoKey = process.env.BREVO_API_KEY
  const fromEmail = process.env.EMAIL_FROM
  const fromName = process.env.EMAIL_FROM_NAME ?? 'Tenant Portal'

  if (!brevoKey || !fromEmail) {
    return { error: 'Email service not configured. Contact your property manager to reset your password.' }
  }

  const admin = await createAdminClient()

  // Admin generateLink always respects the redirectTo — bypasses the Supabase Site URL restriction
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: email.trim(),
    options: { redirectTo: 'https://apartment-manager-tenant.onrender.com/auth/callback' },
  })

  // Generic success to avoid revealing whether the email is registered
  if (error || !data?.properties?.action_link) return {}

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': brevoKey,
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: email.trim() }],
      subject: 'Reset your Tenant Portal password',
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h2 style="color:#1e293b;margin:0 0 12px">Password Reset</h2>
          <p style="color:#475569;margin:0 0 24px">
            Click the button below to set a new password for your Tenant Portal account.
            This link expires in 24&nbsp;hours.
          </p>
          <a href="${data.properties.action_link}"
             style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;
                    padding:12px 28px;border-radius:8px;font-weight:600;font-size:15px">
            Reset Password
          </a>
          <p style="color:#94a3b8;font-size:13px;margin:24px 0 0">
            If you did not request this, you can safely ignore this email.
          </p>
        </div>
      `,
    }),
  })

  if (!res.ok) return { error: 'Failed to send email. Please try again.' }
  return {}
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
