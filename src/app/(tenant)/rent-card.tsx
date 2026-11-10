'use client'

import { useRef, useState, useTransition } from 'react'
import { submitPayment } from '@/app/actions/payments'
import { Upload, CheckCircle2, Clock, XCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { PaymentCardShell, fieldLabelCls, uploadBoxCls, statusBoxCls } from '@/components/tenant-ui'
import { formatRWF } from '@/lib/currency'
import { fileUrl } from '@/lib/storage-url'

export interface MonthPayment {
  id: string
  amount: number
  status: string
  submitted_at: string | null
  receipt_file_url: string | null
  landlord_notes: string | null
}

interface Props {
  leaseId: string
  periodMonth: string
  periodLabel: string
  dueDate: string
  /** Rent for the month (from rent_schedule). */
  expected: number
  confirmed: number
  pending: number
  /** Every payment already submitted for this month. */
  payments: MonthPayment[]
  /** Former tenants may pay at most what is still owed. */
  maxAmount?: number
}

const statusConfig = {
  confirmed: { icon: <CheckCircle2 className="h-4 w-4" />, label: 'Confirmed', cls: statusBoxCls.confirmed },
  pending_review: { icon: <Clock className="h-4 w-4" />, label: 'Pending review', cls: statusBoxCls.pending_review },
  rejected: { icon: <XCircle className="h-4 w-4" />, label: 'Rejected', cls: statusBoxCls.rejected },
}

export function RentCard({ leaseId, periodMonth, periodLabel, dueDate, expected, confirmed, pending, payments, maxAmount }: Props) {
  const remaining = Math.max(expected - confirmed - pending, 0)
  const [file, setFile] = useState<File | null>(null)
  const [amount, setAmount] = useState(String(remaining || expected))
  const [busy, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast.error('Please attach your payment receipt'); return }
    const value = Number(amount)
    if (!(value > 0)) { toast.error('Enter the amount you paid'); return }
    if (maxAmount !== undefined && value > maxAmount) { toast.error(`You can pay at most ${formatRWF(maxAmount)} for this month`); return }
    const fd = new FormData()
    fd.append('lease_id', leaseId)
    fd.append('period_month', periodMonth)
    fd.append('amount', String(Math.round(value)))
    fd.append('receipt', file)
    startTransition(async () => {
      const result = await submitPayment(fd)
      if (result?.error) toast.error(result.error)
      else { toast.success('Payment submitted for review'); setFile(null); if (fileRef.current) fileRef.current.value = '' }
    })
  }

  return (
    <PaymentCardShell periodLabel={periodLabel} amount={expected} dueDate={dueDate}>
      {payments.length > 0 && (
        <ul className="space-y-2" aria-label={`Payments for ${periodLabel}`}>
          {payments.map(p => {
            const st = statusConfig[p.status as keyof typeof statusConfig]
            const receipt = fileUrl('receipts', p.receipt_file_url)
            return (
              <li key={p.id} className={`flex items-start gap-3 rounded-2xl p-3 ${st?.cls ?? ''}`}>
                {st?.icon}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">
                    {formatRWF(p.amount)} · {st?.label ?? p.status}
                  </p>
                  <p className="text-xs opacity-90">
                    Submitted {p.submitted_at ? format(new Date(p.submitted_at), 'MMM d, yyyy') : '—'}
                  </p>
                  {p.landlord_notes && <p className="text-sm mt-0.5">{p.landlord_notes}</p>}
                  {receipt && (
                    <a href={receipt} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 min-h-8 text-xs font-semibold underline underline-offset-2">
                      <ExternalLink className="h-3 w-3" /> View receipt
                    </a>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {remaining === 0 ? (
        <p className="text-sm font-semibold text-[var(--muted-2)]">
          {confirmed >= expected
            ? 'This month is paid in full.'
            : 'The rest is covered by receipts waiting for your landlord to review.'}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {(confirmed > 0 || pending > 0) && (
            <p className="text-sm text-[var(--muted-2)]">
              {formatRWF(confirmed + pending)} of {formatRWF(expected)} paid so far · {formatRWF(remaining)} left
            </p>
          )}
          <div className="space-y-1">
            <label htmlFor="rent-amount" className={fieldLabelCls}>Amount paid (RWF)</label>
            <input
              id="rent-amount"
              type="number"
              min="1"
              step="1"
              max={maxAmount}
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              className="glass-input text-sm"
            />
            <p className="text-xs text-[var(--muted)]">
              You can pay part now and top up later.{maxAmount !== undefined && ` At most ${formatRWF(maxAmount)}.`}
            </p>
          </div>
          <div className="space-y-1">
            <p className={fieldLabelCls}>Payment receipt *</p>
            <label className={uploadBoxCls}>
              <Upload className="h-6 w-6 text-[var(--muted)]" />
              <span className="text-sm text-[var(--muted)]">
                {file ? file.name : 'Tap to attach receipt (image or PDF)'}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <button type="submit" disabled={busy} className="btn-primary w-full">
            {busy ? 'Submitting…' : 'Submit Payment'}
          </button>
        </form>
      )}
    </PaymentCardShell>
  )
}
