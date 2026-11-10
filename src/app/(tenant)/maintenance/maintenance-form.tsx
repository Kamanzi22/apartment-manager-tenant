'use client'

import { useState, useRef, useTransition } from 'react'
import { submitMaintenanceRequest } from '@/app/actions/maintenance'
import { MAINTENANCE_CATEGORIES, defaultUrgency, type MaintenanceCategory, type Urgency } from '@/lib/categories'
import { Plus, X, ImagePlus, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

export function MaintenanceForm() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<MaintenanceCategory | ''>('')
  const [urgency, setUrgency] = useState<Urgency>('medium')
  const [description, setDescription] = useState('')
  const [otherText, setOtherText] = useState('')
  const [photos, setPhotos] = useState<File[]>([])
  const [pending, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  function handleCategoryChange(value: string) {
    const cat = value as MaintenanceCategory
    setCategory(cat)
    if (cat) setUrgency(defaultUrgency(cat))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!category || !description.trim()) { toast.error('Please fill in all required fields'); return }
    if (category === 'other' && !otherText.trim()) { toast.error('Please specify the maintenance type'); return }
    const fd = new FormData()
    fd.append('category', category)
    fd.append('urgency', urgency)
    fd.append('description', category === 'other' ? `${otherText.trim()}: ${description}` : description)
    photos.forEach(p => fd.append('photos', p))
    startTransition(async () => {
      const result = await submitMaintenanceRequest(fd)
      if (result?.error) toast.error(result.error)
      else {
        toast.success('Request submitted')
        setOpen(false)
        setCategory('')
        setUrgency('medium')
        setDescription('')
        setOtherText('')
        setPhotos([])
      }
    })
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hero-card lift w-full flex items-center justify-center gap-2 min-h-14 rounded-[var(--radius-btn)]! text-sm font-semibold"
      >
        <Plus className="h-4 w-4" /> New Request
      </button>
    )
  }

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/70">
        <h2 className="font-semibold">New Maintenance Request</h2>
        <button onClick={() => setOpen(false)} aria-label="Close form" className="h-11 w-11 -mr-2 inline-flex items-center justify-center rounded-full text-[var(--muted-2)] hover:bg-white/70">
          <X className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[var(--ink)]">Category *</label>
            <select
              value={category}
              onChange={e => handleCategoryChange(e.target.value)}
              required
              className="glass-input text-sm"
            >
              <option value="">Select category</option>
              {MAINTENANCE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[var(--ink)]">Urgency</label>
            <select
              value={urgency}
              onChange={e => setUrgency(e.target.value as Urgency)}
              className="glass-input text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {category === 'safety' && (
          <div className="flex items-center gap-2 rounded-2xl bg-[var(--danger-bg)] px-3.5 py-2.5 text-sm font-medium text-[var(--danger-text)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Safety issue — flagged as high urgency by default
          </div>
        )}

        {category === 'other' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[var(--ink)]">Specify maintenance type *</label>
            <input
              type="text"
              value={otherText}
              onChange={e => setOtherText(e.target.value)}
              required
              placeholder="e.g. Door lock, Painting…"
              className="glass-input text-sm"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-[var(--ink)]">Description *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            placeholder="Describe the problem in detail…"
            className="glass-input text-sm resize-none h-28! py-3"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-semibold text-[var(--ink)]">Photos (optional, up to 5)</label>
          <label className="flex items-center justify-center gap-2 min-h-12 cursor-pointer rounded-2xl border-[1.5px] border-dashed border-[rgba(30,39,48,0.22)] bg-white/40 text-sm font-medium text-[var(--muted-2)] hover:bg-white/60 focus-within:ring-3 focus-within:ring-[var(--accent)]/40">
            <ImagePlus className="h-4 w-4" />
            {photos.length === 0 ? 'Add photos' : `${photos.length} photo(s) selected`}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              onChange={e => {
                const files = Array.from(e.target.files ?? []).slice(0, 5)
                setPhotos(files)
              }}
            />
          </label>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {photos.map((f, i) => (
                <div key={i} className="relative">
                  <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-xl object-cover border border-white/85" />
                  <button
                    type="button"
                    onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))}
                    aria-label="Remove photo" className="absolute -top-2 -right-2 bg-[var(--danger-text)] text-white rounded-full h-6 w-6 flex items-center justify-center text-sm shadow"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="btn-primary w-full"
        >
          {pending ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
