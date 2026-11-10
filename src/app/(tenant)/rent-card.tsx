'use client'

import { useRef, useState, useTransition } from 'react'
import { submitPayment } from '@/app/actions/payments'
import { Upload, CheckCircle2, Clock, XCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { PaymentCardShell, fieldLabelCls, uploadBoxCls, statusBoxCls } from '@/components/tenant-ui'

interface Payment {
  id: string
  amount: number
  status: string
  submitted_at: string | null
  receipt_file_url: string | null
  landlord_notes: string | null
}

interface Props {
  leaseId: string
  monthlyRent: number
  periodMonth: string
  periodLabel: string
  dueDate: string
  currentPayment: Payment | null | undefined
}

export function RentCard({ leaseId, monthlyRent, periodMonth, periodLabel, dueDate, currentPayment }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [amount, setAmount] = useState(monthlyRent.toString())
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { toast.error('Please attach your payment receipt'); return }
    const fd = new FormData()
    fd.append('lease_id', leaseId)
    fd.append('period_month', periodMonth)
    fd.append('amount', amount)
    fd.append('receipt', file)
    startTransition(async () => {
      const result = await submitPayment(fd)
      if (result?.error) toast.error(result.error)
      else { toast.success('Payment submitted for review'); setFile(null); if (fileRef.current) fileRef.current.value = '' }
    })
  }

  const statusConfig = {
    confirmed: { icon: <CheckCircle2 className="h-5 w-5" />, label: 'Confirmed', cls: statusBoxCls.confirmed },
    pending_review: { icon: <Clock className="h-5 w-5" />, label: 'Pending Review', cls: statusBoxCls.pending_review },
    rejected: { icon: <XCircle className="h-5 w-5" />, label: 'Rejected', cls: statusBoxCls.rejected },
  }

  const st = currentPayment ? statusConfig[currentPayment.status as keyof typeof statusConfig] : null

  return (
    <PaymentCardShell periodLabel={periodLabel} amount={monthlyRent} dueDate={dueDate}>
        {/* Current status */}
        {currentPayment && st && (
          <div className={`flex items-start gap-3 rounded-2xl p-3.5 ${st.cls}`}>
            {st.icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{st.label}</p>
              {currentPayment.landlord_notes && (
                <p className="text-sm mt-0.5">{currentPayment.landlord_notes}</p>
              )}
              {currentPayment.receipt_file_url && (
                <a href={currentPayment.receipt_file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 mt-1">
                  <ExternalLink className="h-3 w-3" /> View receipt
                </a>
              )}
            </div>
          </div>
        )}

        {/* Upload form — show when no payment or rejected */}
        {(!currentPayment || currentPayment.status === 'rejected') && (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="rent-amount" className={fieldLabelCls}>Amount paid (RWF)</label>
              <input
                id="rent-amount"
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="glass-input text-sm"
              />
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
            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full"
            >
              {pending ? 'Submitting…' : 'Submit Payment'}
            </button>
          </form>
        )}
    </PaymentCardShell>
  )
}
