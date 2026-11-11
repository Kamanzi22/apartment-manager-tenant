import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from '@/lib/email'
import { sendPush } from '@/lib/push'

// Scheduled alerts. Call it EVERY HOUR (Render cron job or Supabase pg_cron,
// see supabase/README.md) with the header  x-cron-secret: $CRON_SECRET.
// public.due_alerts() (migration 13) returns nothing except in the landlord's
// send hour (Kigali time), and then the rent reminders and warnings from the
// landlord's settings, plus the landlord's daily late list, over-limit and
// payment-plan alerts, lease ending, receipts waiting and repairs still open.
// Every alert is claimed in sent_alerts (key + channel) BEFORE it is sent,
// so a rerun, or two runs in the same hour, never sends anything twice.

const TENANT_APP = (process.env.TENANT_APP_URL ?? 'https://apartment-manager-tenant.onrender.com').replace(/\/+$/, '')
const LANDLORD_APP = (process.env.LANDLORD_APP_URL ?? 'https://apartment-manager-landlord.onrender.com').replace(/\/+$/, '')

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = request.headers.get('x-cron-secret')
    ?? request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function run(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ?at=2027-02-28T09:00:00+02:00 runs the job as if it were that moment (for testing).
  const atParam = request.nextUrl.searchParams.get('at')
  const at = atParam && !Number.isNaN(Date.parse(atParam)) ? new Date(atParam).toISOString() : new Date().toISOString()

  const admin = await createAdminClient()
  const { data: alerts, error } = await admin.rpc('due_alerts', { p_now: at })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = { at, due: alerts?.length ?? 0, inApp: 0, emailed: 0, pushed: 0, alreadySent: 0, skipped: 0, errors: [] as string[] }
  const people = new Map<string, { email: string | null; emailOn: boolean }>()

  async function person(id: string) {
    if (!people.has(id)) {
      const [{ data: u }, { data: p }] = await Promise.all([
        admin.auth.admin.getUserById(id),
        admin.from('profiles').select('email_notifications').eq('id', id).maybeSingle(),
      ])
      people.set(id, { email: u.user?.email ?? null, emailOn: p?.email_notifications ?? true })
    }
    return people.get(id)!
  }

  for (const a of alerts ?? []) {
    for (const channel of a.channels) {
      if (channel !== 'in_app' && channel !== 'email') { result.skipped++; continue } // sms: not built yet
      const key = `${a.key}:${channel}`

      // Claim first: if this key was already sent, skip it.
      const { error: claimError } = await admin.from('sent_alerts').insert({
        key, level: a.level, days_offset: a.days_offset, channel, lease_id: a.lease_id,
        period_month: a.period_month, user_id: a.user_id, sent_at: at,
      })
      if (claimError) {
        if (claimError.code === '23505') result.alreadySent++
        else result.errors.push(`${key}: ${claimError.message}`)
        continue
      }
      const release = () => admin.from('sent_alerts').delete().eq('key', key)

      if (channel === 'in_app') {
        const { error: notifyError } = await admin.from('notifications').insert({
          user_id: a.user_id, type: a.notif_type, title: a.title, body: a.body, link: a.link,
        })
        if (notifyError) { await release(); result.errors.push(`${key}: ${notifyError.message}`); continue }
        result.inApp++
        result.pushed += await sendPush([a.user_id], { title: a.title, body: a.body, url: a.link, tag: a.key }).catch(() => 0)
        continue
      }

      // Email
      const who = await person(a.user_id)
      if (!emailConfigured() || !who.email || (a.audience === 'tenant' && !who.emailOn)) { result.skipped++; continue }
      const base = a.audience === 'landlord' ? LANDLORD_APP : TENANT_APP
      const href = `${base}${a.link.startsWith('/') ? a.link : `/${a.link}`}`
      if (await sendEmail(who.email, a.title, emailLayout(a.title, escapeHtml(a.body), { href, label: 'Open' }))) {
        result.emailed++
      } else {
        await release()
        result.errors.push(`${key}: email failed`)
      }
    }
  }

  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 })
}

export const GET = run
export const POST = run
