'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Building2 } from 'lucide-react'

export default function AuthCallbackPage() {
  useEffect(() => {
    const supabase = createClient()

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.replace('/reset-password')
        return
      }

      const code = new URLSearchParams(window.location.search).get('code')
      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
          if (error) window.location.replace('/login?error=invalid_link')
          else window.location.replace('/reset-password')
        })
      } else {
        window.location.replace('/login?error=invalid_link')
      }
    })
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-[var(--ink)] rounded-2xl p-3 shadow-lg">
          <Building2 className="h-7 w-7 text-[var(--metal)]" />
        </div>
        <p className="text-slate-500 text-sm">Verifying your link…</p>
      </div>
    </div>
  )
}
