import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const reason = request.nextUrl.searchParams.get('reason')
  return NextResponse.redirect(new URL(reason ? `/login?error=${encodeURIComponent(reason)}` : '/login', request.url))
}
