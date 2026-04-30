import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TIMES = ['7:00am', '8:00am', '9:00am', '10:00am']

const input = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 bg-white"
const label = "block text-sm font-medium text-gray-700 mb-1.5"

const tomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

export default function CancelRescheduleForm() {
  const [form, setForm] = useState({
    full_name: '', email: '', phone: '',
    original_date: '', action: '',
    new_date: '', new_time: '', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const validate = () => {
    if (!form.full_name.trim()) return 'Full name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email))
      return 'Please enter a valid email address.'
    if (form.phone.replace(/\D/g, '').length < 10)
      return 'Please enter a valid 10-digit phone number.'
    if (!form.original_date) return 'Please enter your original booking date.'
    if (!form.action) return 'Please select Cancel or Reschedule.'
    if (form.action === 'reschedule') {
      if (!form.new_date) return 'Please select a new date.'
      if (!form.new_time) return 'Please select a new arrival time.'
    }
    return null
  }

  const handleSubmit = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setError('')
    setLoading(true)
    try {
      const { error: fnError, data } = await supabase.functions.invoke('cancel-reschedule', {
        body: form,
      })
      if (fnError) throw new Error(data?.error || fnError.message)
      setSubmitted(true)
    } catch (e) {
      setError(e?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-3 sm:p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-teal-100 p-6 sm:p-10">
            <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
              ✓
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">Request received</h2>
            <p className="text-gray-500 mb-6 text-sm sm:text-base leading-relaxed">
              {form.action === 'cancel'
                ? "Your cancellation request has been submitted. We'll confirm via email or phone shortly."
                : "Your reschedule request has been submitted. We'll confirm your new time via email or phone shortly."}
            </p>
            <div className="p-4 bg-teal-50 rounded-2xl">
              <p className="text-teal-700 text-sm font-medium">We'll be in touch within one business day.</p>
            </div>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            <a href="/" className="hover:text-teal-500 transition-colors">← Book a new cleaning</a>
          </p>
          <p className="text-center text-xs text-gray-300 mt-2">
            Powered by <span className="font-medium text-teal-400">Kardama</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">

        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cancel or Reschedule</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Submit your request below</p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-teal-100/50 p-5 sm:p-8">
          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className={label}>Full Name *</label>
              <input type="text" value={form.full_name}
                onChange={e => set('full_name', e.target.value)}
                placeholder="Jane Smith" className={input} />
            </div>

            <div>
              <label className={label}>Email Address *</label>
              <input type="email" value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="jane@example.com" className={input} />
            </div>

            <div>
              <label className={label}>Phone Number *</label>
              <input type="tel" value={form.phone}
                onChange={e => set('phone', e.target.value)}
                placeholder="(555) 000-0000" className={input} />
            </div>

            <div>
              <label className={label}>Original Booking Date *</label>
              <input type="date" value={form.original_date}
                onChange={e => set('original_date', e.target.value)}
                className={input} />
            </div>

            <div>
              <label className={label}>What would you like to do? *</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'cancel',     label: 'Cancel' },
                  { key: 'reschedule', label: 'Reschedule' },
                ].map(({ key, label: lbl }) => (
                  <button key={key} type="button" onClick={() => set('action', key)}
                    className={`py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                      form.action === key
                        ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400'
                    }`}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {form.action === 'reschedule' && (
              <>
                <div>
                  <label className={label}>Preferred New Date *</label>
                  <input type="date" value={form.new_date}
                    onChange={e => set('new_date', e.target.value)}
                    min={tomorrow()} className={input} />
                </div>

                <div>
                  <label className={label}>Preferred New Arrival Time *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIMES.map(t => (
                      <button key={t} type="button" onClick={() => set('new_time', t)}
                        className={`py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                          form.new_time === t
                            ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className={label}>Notes (optional)</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Anything else we should know?" rows={3}
                className={input + ' resize-none'} />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={loading}
            className="w-full mt-8 py-3 px-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 active:scale-95 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
            {loading ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          <a href="/" className="hover:text-teal-500 transition-colors">← Back to booking form</a>
        </p>
        <p className="text-center text-xs text-gray-300 mt-2">
          Powered by <span className="font-medium text-teal-400">Kardama</span>
        </p>
      </div>
    </div>
  )
}
