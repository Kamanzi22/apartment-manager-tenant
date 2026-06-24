'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { lookupEmailByPhone, registerTenant } from '@/app/actions/auth'
import { useRouter } from 'next/navigation'
import { Building2 } from 'lucide-react'

type Mode = 'signin' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setIdentifier('')
    setPassword('')
    setFullName('')
    setPhone('')
  }

  async function handleSignIn(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      router.push('/')
      return
    }

    const supabase = createClient()
    const isPhone = !identifier.includes('@')

    let email = identifier
    if (isPhone) {
      const resolved = await lookupEmailByPhone(identifier)
      if (!resolved) {
        setError('No account found with this phone number.')
        setLoading(false)
        return
      }
      email = resolved
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Invalid credentials. Check your email/phone and password.')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  async function handleRegister(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      router.push('/')
      return
    }

    const fd = new FormData()
    fd.set('email', identifier)
    fd.set('password', password)
    fd.set('full_name', fullName)
    fd.set('phone', phone)

    const result = await registerTenant(fd)
    if (result.error) {
      setError(result.error)
      setLoading(false)
      return
    }

    // Auto sign-in with the new account
    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: result.email!,
      password,
    })
    if (signInError) {
      setError('Account created — please sign in.')
      switchMode('signin')
      setLoading(false)
    } else {
      router.push('/')
    }
  }

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500'
  const labelCls = 'block text-sm font-medium text-slate-700'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="bg-slate-900 rounded-xl p-3 mb-3">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-4">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'signin'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              mode === 'register'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Create Account
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {mode === 'signin' ? (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Email or Phone</label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className={inputCls}
                  placeholder="you@example.com or +1 555 000 0000"
                  autoComplete="username"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputCls}
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
              >
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Full name *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className={inputCls}
                  placeholder="Jane Doe"
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Email *</label>
                <input
                  type="email"
                  required
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  className={inputCls}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Password * <span className="text-slate-400 font-normal">(min 8 chars)</span></label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputCls}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={inputCls}
                  placeholder="+1 555 000 0000"
                  autoComplete="tel"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
              <p className="text-xs text-center text-slate-400">
                Your manager will link your account to your unit.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
