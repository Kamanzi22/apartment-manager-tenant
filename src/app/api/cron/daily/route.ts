import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { emailConfigured, emailLayout, escapeHtml, sendEmail } from '@/lib/email'
import { sendPush } from '@/lib/push'
import { kigaliDateString } from '@/lib/rent-utils'

// Daily alerts. Call once a day (Render cron job or Supabase pg_cron, see
// supabase/README.md) with the header  x-cron-secret: $CRON_SECRET.
//   Tenants:   rent due in 3 days, rent overdue 1 and 7 days after the due
//              date, lease ending in 30 days.
//   Landlord:  receipt waiting more than 3 days, repair open more than 7 days.
// public.due_alerts() picks the alerts; sent_alerts makes reruns safe.

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

  const dateParam = request.nextUrl.searchParams.get('date')
  const today = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : kigaliDateString()

  const admin = await createAdminClient()
  const { data: alerts, error } = await admin.rpc('due_alerts', { p_today: today })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = { date: today, due: alerts?.length ?? 0, sent: 0, alreadySent: 0, emailed: 0, pushed: 0, errors: [] as string[] }
  const emails = new Map<string, string | null>()

  for (const alert of alerts ?? []) {
    // Claim the key first: if another run already sent it, skip.
    const { error: claimError } = await admin.from('sent_alerts').insert({ key: alert.key })
    if (claimError) {
      if (claimError.code === '23505') result.alreadySent++
      else result.errors.push(`${alert.key}: ${claimError.message}`)
      continue
    }

    const { error: notifyError } = await admin.from('notifications').insert({
      user_id: alert.user_id,
      type: `alert_${alert.key.split(':')[0]}`,
      title: alert.title,
      body: alert.body,
      link: alert.link,
    })
    if (notifyError) {
      // Release the key so tomorrow's run tries again.
      await admin.from('sent_alerts').delete().eq('key', alert.key)
      result.errors.push(`${alert.key}: ${notifyError.message}`)
      continue
    }
    result.sent++

    if (emailConfigured()) {
      if (!emails.has(alert.user_id)) {
        const { data } = await admin.auth.admin.getUserById(alert.user_id)
        emails.set(alert.user_id, data.user?.email ?? null)
      }
      const to = emails.get(alert.user_id)
      const base = alert.audience === 'landlord' ? LANDLORD_APP : TENANT_APP
      if (to && await sendEmail(to, alert.title, emailLayout(alert.title, escapeHtml(alert.body), { href: `${base}${alert.link}`, label: 'Open' }))) {
        result.emailed++
      }
    }

    result.pushed += await sendPush([alert.user_id], { title: alert.title, body: alert.body, url: alert.link, tag: alert.key })
      .catch(() => 0)
  }

  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 })
}

export const GET = run
export const POST = run
