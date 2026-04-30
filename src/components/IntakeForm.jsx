import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SuccessScreen from './SuccessScreen'
import CancelRescheduleForm from './CancelRescheduleForm'

// Singleton — injects the Maps script once, resolves when places library is ready
let _mapsPromise = null
function loadMapsApi() {
  if (_mapsPromise) return _mapsPromise
  if (window.google?.maps?.places) return (_mapsPromise = Promise.resolve())
  _mapsPromise = new Promise((resolve, reject) => {
    window.__mapsCallback = resolve
    const s = document.createElement('script')
    s.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_PLACES_API_KEY}&libraries=places&callback=__mapsCallback`
    s.async = true
    s.onerror = () => { _mapsPromise = null; reject() }
    document.head.appendChild(s)
  })
  return _mapsPromise
}

const MOCK = false

const BUSINESS_NAME = 'Kardama Cleaning'
const STORAGE_KEY = 'kardama_intake_draft'

const TIMES = ['8:00am', '9:00am', '10:00am', '11:00am', '1:00pm', '2:00pm']

const addMinutes = (timeStr, mins) => {
  const [, timePart, period] = timeStr.match(/^(\d+:\d+)(am|pm)$/)
  let [h, m] = timePart.split(':').map(Number)
  if (period === 'pm' && h !== 12) h += 12
  if (period === 'am' && h === 12) h = 0
  let total = ((h * 60 + m + mins) % (24 * 60) + 24 * 60) % (24 * 60)
  const newH = Math.floor(total / 60)
  const newM = total % 60
  const newPeriod = newH < 12 ? 'am' : 'pm'
  const displayH = newH % 12 === 0 ? 12 : newH % 12
  return `${displayH}:${String(newM).padStart(2, '0')}${newPeriod}`
}
const HOME_SIZES = ['Studio', '1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4+ Bedrooms', 'Commercial']
// Cleaning duration for a 2-person team, including a 30-min commute buffer.
const HOME_SIZE_DURATION_MIN = {
  'Studio': 120,
  '1 Bedroom': 150,
  '2 Bedrooms': 180,
  '3 Bedrooms': 210,
  '4+ Bedrooms': 270,
  'Commercial': 270,
}
const FREQUENCIES = ['One-time', 'Weekly', 'Bi-weekly', 'Monthly']
const PAYMENT_METHODS = ['Zelle', 'Venmo', 'PayPal', 'Cash']
const STEPS = ['About You', 'Your Schedule', 'Final Details']

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DOW_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const fmtDate = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const buildMonthGrid = (year, month) => {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const cells = []
  for (let i = 0; i < first.getDay(); i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

const BLANK_FORM = {
  full_name: '',
  email: '',
  phone: '',
  start_date: '',
  preferred_days: [],
  preferred_arrival_times: [],
  preferred_exit_times: [],
  service_address: '',
  unit: '',
  home_size: '',
  cleaning_frequency: '',
  has_pets_allergies: '',
  additional_notes: '',
  payment_method: '',
}

const input = "w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent transition-all text-gray-800 placeholder-gray-400 bg-white"
const label = "block text-sm font-medium text-gray-700 mb-1.5"

function Step1({ form, set }) {
  return (
    <div className="space-y-5">
      <div>
        <label className={label}>Full Name *</label>
        <input
          type="text"
          value={form.full_name}
          onChange={e => set('full_name', e.target.value)}
          placeholder="Jane Smith"
          className={input}
        />
      </div>

      <div>
        <label className={label}>Email Address *</label>
        <input
          type="email"
          value={form.email}
          onChange={e => set('email', e.target.value)}
          placeholder="jane@example.com"
          className={input}
        />
      </div>

      <div>
        <label className={label}>Phone Number *</label>
        <input
          type="tel"
          value={form.phone}
          onChange={e => set('phone', e.target.value)}
          placeholder="(555) 000-0000"
          className={input}
        />
      </div>

    </div>
  )
}

function Step2({ form, set, setFormState }) {
  const today = startOfDay(new Date())
  const minDate = new Date(today); minDate.setDate(minDate.getDate() + 1)

  const initial = form.start_date ? parseDate(form.start_date) : minDate
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() })
  const [bookedTimes, setBookedTimes] = useState([])

  const grid = buildMonthGrid(view.year, view.month)
  const selectedTime = form.preferred_arrival_times[0] || ''
  const durationMin = HOME_SIZE_DURATION_MIN[form.home_size]
  const showSchedule = !!durationMin

  useEffect(() => {
    if (!form.start_date || !durationMin) { setBookedTimes([]); return }
    supabase.rpc('get_booked_slots', {
      check_date: form.start_date,
      duration_minutes: durationMin,
    })
      .then(({ data }) => setBookedTimes(Array.isArray(data) ? data : []))
      .catch(() => setBookedTimes([]))
  }, [form.start_date, durationMin])

  // Clear selected time if the day just became fully booked
  useEffect(() => {
    const sel = form.preferred_arrival_times[0]
    if (sel && bookedTimes.includes(sel))
      setFormState(f => ({ ...f, preferred_arrival_times: [], preferred_exit_times: [] }))
  }, [bookedTimes])

  // If home size changes, recompute the exit time for any already-picked arrival
  useEffect(() => {
    const sel = form.preferred_arrival_times[0]
    if (!sel || !durationMin) return
    const expected = addMinutes(sel, durationMin)
    if (form.preferred_exit_times[0] !== expected) {
      setFormState(f => ({ ...f, preferred_exit_times: [expected] }))
    }
  }, [durationMin])

  const selectDate = (d) => {
    setFormState(f => ({
      ...f,
      start_date: fmtDate(d),
      preferred_days: [DOW_FULL[d.getDay()]],
      preferred_arrival_times: [],
      preferred_exit_times: [],
    }))
  }

  const selectTime = (t) => {
    setFormState(f => ({
      ...f,
      preferred_arrival_times: [t],
      preferred_exit_times: [addMinutes(t, durationMin)],
    }))
  }

  const canGoBack =
    view.year > today.getFullYear() ||
    (view.year === today.getFullYear() && view.month > today.getMonth())

  const prevMonth = () => setView(v =>
    v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 }
  )
  const nextMonth = () => setView(v =>
    v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 }
  )

  return (
    <div className="space-y-6">
      <div>
        <label className={label}>Home Size *</label>
        <select
          value={form.home_size}
          onChange={e => set('home_size', e.target.value)}
          className={input + " appearance-none cursor-pointer"}
        >
          <option value="">Select home size</option>
          {HOME_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <p className="text-xs text-gray-400 mt-1.5">
          We use this to find time slots that fit your home.
        </p>
      </div>

      {!showSchedule && (
        <div className="text-center text-sm text-gray-400 py-6">
          Pick your home size to see available times.
        </div>
      )}

      {showSchedule && (
      <>
      <div>
        <p className={label}>Select a date *</p>
        <div className="border border-gray-200 rounded-2xl p-3 sm:p-4">
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canGoBack}
              className="w-8 h-8 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-600"
              aria-label="Previous month"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-gray-800">
              {MONTHS[view.month]} {view.year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600"
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DOW_SHORT.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {grid.map((d, i) => {
              if (!d) return <div key={i} />
              const past = startOfDay(d) < minDate
              const sel = fmtDate(d) === form.start_date
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => !past && selectDate(d)}
                  disabled={past}
                  className={`aspect-square rounded-full text-sm font-medium transition-all ${
                    sel
                      ? 'bg-teal-500 text-white shadow-sm'
                      : past
                      ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-teal-50'
                  }`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {form.start_date && (
        <div>
          <p className={label}>Select a time *</p>
          <p className="text-xs text-gray-400 mb-3">
            {parseDate(form.start_date).toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {TIMES.map(t => {
              const booked = bookedTimes.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => !booked && selectTime(t)}
                  disabled={booked}
                  className={`py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                    booked
                      ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                      : selectedTime === t
                      ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400'
                  }`}
                >
                  {booked ? `${t} · Full` : `${t} → ${addMinutes(t, durationMin)}`}
                </button>
              )
            })}
          </div>
        </div>
      )}
      </>
      )}
    </div>
  )
}

function AddressInput({ value, onChange, className, placeholder }) {
  const [suggestions, setSuggestions] = useState([])
  const [ready, setReady] = useState(false)
  const svcRef = useRef(null)
  const timerRef = useRef(null)

  useEffect(() => {
    loadMapsApi()
      .then(() => {
        svcRef.current = new window.google.maps.places.AutocompleteService()
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [])

  const handleChange = (e) => {
    const val = e.target.value
    onChange(val)
    clearTimeout(timerRef.current)
    if (!val || val.length < 2) { setSuggestions([]); return }
    timerRef.current = setTimeout(() => {
      if (!svcRef.current) return
      svcRef.current.getPlacePredictions(
        { input: val, componentRestrictions: { country: 'us' } },
        (preds, status) => setSuggestions(status === 'OK' && preds ? preds.slice(0, 5) : [])
      )
    }, 300)
  }

  const pick = (pred) => {
    onChange(pred.description)
    setSuggestions([])
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={() => { clearTimeout(timerRef.current); setTimeout(() => setSuggestions([]), 150) }}
        onKeyDown={e => { if (e.key === 'Enter') e.preventDefault() }}
        placeholder={ready ? placeholder : 'Loading address search…'}
        className={className}
        autoComplete="off"
      />
      {suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {suggestions.map(pred => (
            <li key={pred.place_id}>
              <button
                type="button"
                onMouseDown={() => pick(pred)}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-teal-50 border-b border-gray-100 last:border-0"
              >
                <span className="font-medium">{pred.structured_formatting?.main_text}</span>
                <span className="text-gray-400 text-xs ml-1">{pred.structured_formatting?.secondary_text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Step3({ form, set }) {
  return (
    <div className="space-y-5">
      <div>
        <label className={label}>Service Address *</label>
        <AddressInput
          value={form.service_address}
          onChange={val => set('service_address', val)}
          placeholder="123 Main St, Chicago, IL 60601"
          className={input}
        />
      </div>

      <div>
        <label className={label}>Unit / Apt</label>
        <input
          type="text"
          value={form.unit}
          onChange={e => set('unit', e.target.value)}
          placeholder="Apt 4B"
          className={input}
        />
      </div>

      <div>
        <label className={label}>How often do you need cleaning? *</label>
        <select
          value={form.cleaning_frequency}
          onChange={e => set('cleaning_frequency', e.target.value)}
          className={input + " appearance-none cursor-pointer"}
        >
          <option value="">Select frequency</option>
          {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      <div>
        <label className={label}>Pets or allergies we should know about?</label>
        <input
          type="text"
          value={form.has_pets_allergies}
          onChange={e => set('has_pets_allergies', e.target.value)}
          placeholder="e.g. 2 cats, allergic to bleach"
          className={input}
        />
      </div>

      <div>
        <label className={label}>Preferred payment method *</label>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => set('payment_method', m)}
              className={`py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                form.payment_method === m
                  ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={label}>Additional notes or special requests</label>
        <textarea
          value={form.additional_notes}
          onChange={e => set('additional_notes', e.target.value)}
          placeholder="Anything else we should know?"
          rows={3}
          className={input + " resize-none"}
        />
      </div>
    </div>
  )
}

export default function IntakeForm() {
  const _qs = new URLSearchParams(window.location.search)
  if (_qs.has('manage') || _qs.has('cancel'))
    return <CancelRescheduleForm />

  const [step, setStep] = useState(() => {
    try { return Number(localStorage.getItem(STORAGE_KEY + '_step') ?? 0) } catch { return 0 }
  })
  const [submitted, setSubmitted] = useState(false)
  const [bookingId, setBookingId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setFormState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...BLANK_FORM, ...JSON.parse(saved) } : BLANK_FORM
    } catch { return BLANK_FORM }
  })

  // Kick off Maps API load immediately so it's ready before the user hits step 3
  useEffect(() => { loadMapsApi().catch(() => {}) }, [])

  // Persist draft on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(form))
      localStorage.setItem(STORAGE_KEY + '_step', String(step))
    } catch {}
  }, [form, step])

  const set = (key, value) => setFormState(f => ({ ...f, [key]: value }))
  const toggleArray = (key, value) => setFormState(f => ({
    ...f,
    [key]: f[key].includes(value)
      ? f[key].filter(v => v !== value)
      : [...f[key], value],
  }))

  const validate = (s) => {
    if (s === 0) {
      if (!form.full_name.trim()) return 'Full name is required.'
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email))
        return 'Please enter a valid email address (e.g. jane@example.com).'
      if (form.phone.replace(/\D/g, '').length < 10)
        return 'Please enter a valid 10-digit phone number.'
      const _digits = form.phone.replace(/\D/g, '')
      const _base = _digits.length === 11 && _digits.startsWith('1') ? _digits.slice(1) : _digits
      if (['911', '112', '999', '000', '411', '611', '711', '811'].some(p => _base === p || _base.startsWith(p)))
        return 'Please enter a valid phone number.'
    }
    if (s === 1) {
      if (!form.home_size) return 'Please select your home size.'
      if (!form.start_date) return 'Please select a date.'
      if (form.preferred_arrival_times.length === 0) return 'Please select a time.'
    }
    if (s === 2) {
      if (!form.service_address.trim()) return 'Service address is required.'
      if (!form.cleaning_frequency) return 'Please select a cleaning frequency.'
      if (!form.payment_method) return 'Please select a payment method.'
    }
    return null
  }

  const next = () => {
    const err = validate(step)
    if (err) { setError(err); return }
    setError('')
    setStep(s => s + 1)
  }

  const back = () => { setError(''); setStep(s => s - 1) }

  const handleSubmit = async () => {
    const err = validate(2)
    if (err) { setError(err); return }
    setError('')
    setLoading(true)
    try {
      // Normalize arrival time from 12h display (e.g. '8:00am') to 24h ('08:00')
      const rawTime = form.preferred_arrival_times[0] || ''
      const to24h = (t) => {
        const m = t.match(/^(\d{1,2}):(\d{2})(am|pm)$/i)
        if (!m) return t
        let h = parseInt(m[1]), min = parseInt(m[2])
        const p = m[3].toLowerCase()
        if (p === 'pm' && h !== 12) h += 12
        if (p === 'am' && h === 12) h = 0
        return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
      }

      // Extract city from Google Places address ("123 Main St, Long Beach, CA 90802, USA")
      const parts = form.service_address.split(',')
      const city = parts.length >= 3 ? parts[parts.length - 3]?.trim() || null : null

      const payload = {
        customer_name:      form.full_name.trim(),
        customer_email:     form.email.trim(),
        customer_phone:     form.phone.trim(),
        address:            form.service_address.trim(),
        city,
        service_type:       'standard',
        preferred_date:     form.start_date,
        preferred_time:     to24h(rawTime),
        home_size:          form.home_size || null,
        cleaning_frequency: form.cleaning_frequency || null,
        notes: [
          form.unit               && `Unit: ${form.unit}`,
          form.has_pets_allergies && `Pets/allergies: ${form.has_pets_allergies}`,
          form.payment_method     && `Payment: ${form.payment_method}`,
          form.additional_notes,
        ].filter(Boolean).join('\n'),
      }

      const res = await fetch('https://kardama-ai.vercel.app/api/intake', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Something went wrong.')

      setBookingId(data?.id || null)
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY + '_step') } catch {}
      setSubmitted(true)
    } catch (e) {
      console.error(e)
      setError((e instanceof Error ? e.message : null) || 'Something went wrong. Please try again or contact us directly.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return <SuccessScreen name={form.full_name} businessName={BUSINESS_NAME} bookingId={bookingId} />

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{BUSINESS_NAME}</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1">Request a cleaning</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-start justify-center mb-6 sm:mb-8">
          {STEPS.map((stepLabel, i) => (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  i < step
                    ? 'bg-teal-600 text-white'
                    : i === step
                    ? 'bg-teal-500 text-white shadow-md ring-4 ring-teal-100'
                    : 'bg-gray-100 text-gray-400'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs mt-1.5 font-medium hidden sm:block ${
                  i === step ? 'text-teal-600' : 'text-gray-400'
                }`}>
                  {stepLabel}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-10 sm:w-14 h-0.5 mx-1 sm:mb-4 transition-all ${
                  i < step ? 'bg-teal-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-teal-100/50 p-5 sm:p-8">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-800 mb-5 sm:mb-6">{STEPS[step]}</h2>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          {step === 0 && <Step1 form={form} set={set} />}
          {step === 1 && <Step2 form={form} set={set} setFormState={setFormState} />}
          {step === 2 && <Step3 form={form} set={set} />}

          <div className="flex gap-3 mt-8">
            {step > 0 && (
              <button
                onClick={back}
                className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-all"
              >
                ← Back
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={next}
                className="flex-1 py-3 px-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 active:scale-95 transition-all shadow-sm"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 active:scale-95 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit'}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          By submitting, you agree to be contacted by {BUSINESS_NAME}.
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          Need to <a href="/?cancel=1" className="text-teal-500 hover:underline">cancel or reschedule</a>?
        </p>
        <p className="text-center text-xs text-gray-300 mt-2">
          Powered by <span className="font-medium text-teal-400">Kardama</span>
        </p>
      </div>
    </div>
  )
}
