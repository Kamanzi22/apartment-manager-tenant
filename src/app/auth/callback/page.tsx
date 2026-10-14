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
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="bg-slate-900 rounded-xl p-3">
          <Building2 className="h-7 w-7 text-white" />
        </div>
        <p className="text-slate-500 text-sm">Verifying your link…</p>
      </div>
    </div>
  )
}
