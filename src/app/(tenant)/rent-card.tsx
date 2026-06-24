'use client'

import { useRef, useState, useTransition } from 'react'
import { submitPayment } from '@/app/actions/payments'
import { Upload, CheckCircle2, Clock, XCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

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
    confirmed: { icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, label: 'Confirmed', cls: 'bg-green-50 border-green-200' },
    pending_review: { icon: <Clock className="h-5 w-5 text-amber-500" />, label: 'Pending Review', cls: 'bg-amber-50 border-amber-200' },
    rejected: { icon: <XCircle className="h-5 w-5 text-red-500" />, label: 'Rejected', cls: 'bg-red-50 border-red-200' },
  }

  const st = currentPayment ? statusConfig[currentPayment.status as keyof typeof statusConfig] : null

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 px-5 py-4 text-white">
        <p className="text-sm text-slate-400">{periodLabel}</p>
        <p className="text-3xl font-bold mt-1">${monthlyRent.toFixed(2)}</p>
        <p className="text-xs text-slate-400 mt-1">Due {dueDate}</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Current status */}
        {currentPayment && st && (
          <div className={`flex items-start gap-3 rounded-xl border p-3 ${st.cls}`}>
            {st.icon}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800">{st.label}</p>
              {currentPayment.landlord_notes && (
                <p className="text-sm text-slate-600 mt-0.5">{currentPayment.landlord_notes}</p>
              )}
              {currentPayment.receipt_file_url && (
                <a href={currentPayment.receipt_file_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 mt-1">
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
              <label className="block text-sm font-medium text-slate-700">Amount paid ($)</label>
              <input
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-sm font-medium text-slate-700">Payment receipt *</label>
              <label className="flex flex-col items-center gap-2 border-2 border-dashed rounded-xl p-4 cursor-pointer hover:bg-slate-50 transition-colors">
                <Upload className="h-6 w-6 text-slate-400" />
                <span className="text-sm text-slate-500">
                  {file ? file.name : 'Tap to attach receipt (image or PDF)'}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              {pending ? 'Submitting…' : 'Submit Payment'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
