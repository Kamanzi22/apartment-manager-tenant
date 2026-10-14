import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './database.types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
      // Never let a slow Supabase response hang the middleware (Vercel kills it → 504)
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(5000) }),
      },
    }
  )

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    // Supabase unreachable — let the request through; the (tenant) layout re-checks auth
    return supabaseResponse
  }
  const { pathname } = request.nextUrl

  // Let auth callback and reset-password through without session checks
  if (pathname.startsWith('/auth/') || pathname === '/reset-password' || pathname === '/auth/callback') {
    return supabaseResponse
  }

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    // If a PKCE code is present the user arrived via a password reset email —
    // send them to the reset form instead of the home page
    const code = request.nextUrl.searchParams.get('code')
    return NextResponse.redirect(new URL(code ? '/reset-password' : '/', request.url))
  }

  return supabaseResponse
}
