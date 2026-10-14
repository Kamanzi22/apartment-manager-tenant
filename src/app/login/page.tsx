'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { lookupEmailByPhone, registerTenant, sendPasswordResetEmail } from '@/app/actions/auth'
import { Building2, ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react'

type Mode = 'signin' | 'register' | 'forgot'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [forgotEmail, setForgotEmail] = useState('')
  const [resetSent, setResetSent] = useState(false)

  // Safety net: if user lands here with a ?code= (old reset link flow), exchange it
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') return
    const code = new URLSearchParams(window.location.search).get('code')
    const linkError = new URLSearchParams(window.location.search).get('error')
    if (linkError) { setError('This reset link has expired. Please request a new one.'); return }
    if (!code) return
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) { window.location.replace('/reset-password'); return }
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (!error) window.location.replace('/reset-password')
      })
    })
  }, [])

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setIdentifier('')
    setPassword('')
    setFullName('')
    setPhone('')
    setForgotEmail('')
    setResetSent(false)
  }

  async function handleSignIn(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      window.location.replace('/')
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
      window.location.replace('/')
    }
  }

  async function handleRegister(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      window.location.replace('/')
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
      window.location.replace('/')
    }
  }

  async function handleSendReset(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
      setResetSent(true)
      setLoading(false)
      return
    }

    const result = await sendPasswordResetEmail(forgotEmail)
    if (result.error) {
      setError(result.error)
    } else {
      setResetSent(true)
    }
    setLoading(false)
  }

  const inputCls = 'w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500'
  const labelCls = 'block text-sm font-medium text-slate-700'
  const btnPrimary = 'w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-60'
  const btnBack = 'flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 -mt-1'

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-slate-900 rounded-xl p-3 mb-3">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Tenant Portal</h1>
          <p className="text-sm text-slate-500 mt-1">
            {mode === 'signin' ? 'Sign in to your account'
              : mode === 'register' ? 'Create your account'
              : 'Reset your password'}
          </p>
        </div>

        {(mode === 'signin' || mode === 'register') && (
          <div className="flex rounded-xl bg-slate-100 p-1 mb-4">
            {(['signin', 'register'] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => switchMode(m)}
                className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  mode === m
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {m === 'signin' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* SIGN IN */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Email or Phone</label>
                <input type="text" required value={identifier} onChange={e => setIdentifier(e.target.value)} className={inputCls} placeholder="you@example.com or +1 555 000 0000" autoComplete="username" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} className={inputCls + ' pr-10'} autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'Signing in…' : 'Sign In'}
              </button>
              <button type="button" onClick={() => switchMode('forgot')} className="w-full text-sm text-slate-500 hover:text-slate-700 text-center transition-colors">
                Forgot your password?
              </button>
            </form>
          )}

          {/* REGISTER */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className={labelCls}>Full name *</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} placeholder="Jane Doe" autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Email *</label>
                <input type="email" required value={identifier} onChange={e => setIdentifier(e.target.value)} className={inputCls} placeholder="you@example.com" autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Password * <span className="text-slate-400 font-normal">(min 8 chars)</span></label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className={inputCls + ' pr-10'} autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelCls}>Phone <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className={inputCls} placeholder="+1 555 000 0000" autoComplete="tel" />
              </div>
              <button type="submit" disabled={loading} className={btnPrimary}>
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
              <p className="text-xs text-center text-slate-400">Your manager will link your account to your unit.</p>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {mode === 'forgot' && (
            <div className="space-y-4">
              <button type="button" onClick={() => switchMode('signin')} className={btnBack}>
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </button>

              {!resetSent ? (
                <form onSubmit={handleSendReset} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Your email address</label>
                    <input type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className={inputCls} placeholder="you@example.com" autoComplete="email" />
                    <p className="text-xs text-slate-400">We'll email you a link to reset your password.</p>
                  </div>
                  <button type="submit" disabled={loading} className={btnPrimary}>
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4 text-center">
                  <div className="bg-slate-100 rounded-full p-3">
                    <Mail className="h-6 w-6 text-slate-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-900">Check your email</p>
                  <p className="text-sm text-slate-500">
                    If an account exists for <strong>{forgotEmail}</strong>, a reset link has been sent. Click it to set a new password.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setResetSent(false); setError('') }}
                    className="text-sm text-slate-500 hover:text-slate-700"
                  >
                    Use a different email
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
