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
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors text-sm font-medium"
      >
        <Plus className="h-4 w-4" /> New Request
      </button>
    )
  }

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b">
        <h2 className="font-semibold text-slate-900">New Maintenance Request</h2>
        <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Category *</label>
            <select
              value={category}
              onChange={e => handleCategoryChange(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="">Select category</option>
              {MAINTENANCE_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Urgency</label>
            <select
              value={urgency}
              onChange={e => setUrgency(e.target.value as Urgency)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        {category === 'safety' && (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Safety issue — flagged as high urgency by default
          </div>
        )}

        {category === 'other' && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Specify maintenance type *</label>
            <input
              type="text"
              value={otherText}
              onChange={e => setOtherText(e.target.value)}
              required
              placeholder="e.g. Door lock, Painting…"
              className="w-full border rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-500"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Description *</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            required
            placeholder="Describe the problem in detail…"
            className="w-full border rounded-lg px-3 py-2 text-sm text-slate-900 resize-none h-28 focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700">Photos (optional, up to 5)</label>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-500 hover:text-slate-700">
            <ImagePlus className="h-4 w-4" />
            {photos.length === 0 ? 'Add photos' : `${photos.length} photo(s) selected`}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
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
                  <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-lg object-cover border" />
                  <button
                    type="button"
                    onClick={() => setPhotos(ps => ps.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full h-4 w-4 flex items-center justify-center text-xs"
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-slate-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors disabled:opacity-60"
        >
          {pending ? 'Submitting…' : 'Submit Request'}
        </button>
      </form>
    </div>
  )
}
