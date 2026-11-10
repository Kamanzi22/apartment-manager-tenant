import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'
import { publicOrigin } from '@/lib/public-origin'
import { getLandlordId } from '@/lib/landlord'
import { notify } from '@/lib/notify'

// After Google sign-in. A first-time Google user becomes a tenant with no unit
// yet, and the landlord is told to add them to one. A landlord account is
// signed out again: this is the tenant app.
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login?error=google_failed`)

  const admin = await createAdminClient()
  const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()

  if (profile?.role === 'landlord') {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_tenant`)
  }

  if (!profile) {
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const fullName = String(meta.full_name || meta.name || user.email?.split('@')[0] || 'New tenant').trim().slice(0, 120)
    const { error } = await admin.from('profiles').insert({
      id: user.id, role: 'tenant', full_name: fullName, phone: null, unit_id: null,
    })
    if (error) {
      await supabase.auth.signOut()
      return NextResponse.redirect(`${origin}/login?error=google_failed`)
    }
    const landlordId = await getLandlordId(admin)
    if (landlordId) {
      await notify(admin, {
        user_id: landlordId,
        type: 'new_tenant',
        title: 'New tenant needs a unit',
        body: `${fullName}${user.email ? ` (${user.email})` : ''} signed in with Google. Add them to a unit with "Add Tenant" using this email.`,
        link: '/landlord',
      })
    }
  }

  return NextResponse.redirect(`${origin}/`)
}
