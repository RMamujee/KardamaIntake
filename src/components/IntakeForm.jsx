import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import SuccessScreen from './SuccessScreen'

const MOCK = false

const BUSINESS_NAME = 'Your company name here'
const STORAGE_KEY = 'kardama_intake_draft'

const TIMES = ['7:00am', '8:00am', '9:00am', '10:00am', '11:00am', '12:00pm', '1:00pm']
const HOME_SIZES = ['Studio', '1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4+ Bedrooms', 'Commercial']
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

function Step2({ form, setFormState }) {
  const today = startOfDay(new Date())
  const minDate = new Date(today); minDate.setDate(minDate.getDate() + 1)

  const initial = form.start_date ? parseDate(form.start_date) : minDate
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() })

  const grid = buildMonthGrid(view.year, view.month)
  const selectedTime = form.preferred_arrival_times[0] || ''

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
    setFormState(f => ({ ...f, preferred_arrival_times: [t] }))
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
            {TIMES.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => selectTime(t)}
                className={`py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                  selectedTime === t
                    ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AddressInput({ value, onChange, className, placeholder }) {
  const ref = useRef(null)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange })

  useEffect(() => {
    if (!ref.current) return
    let ac, timer

    const tryInit = () => {
      if (!window.google?.maps?.places?.Autocomplete) {
        timer = setTimeout(tryInit, 200)
        return
      }
      try {
        ac = new window.google.maps.places.Autocomplete(ref.current, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address'],
        })
        ac.addListener('place_changed', () => {
          const place = ac.getPlace()
          // Fall back to the text Google already wrote into the input if
          // formatted_address is missing (avoids saving "undefined")
          const addr = place?.formatted_address || ref.current?.value || ''
          if (addr) onChangeRef.current(addr)
        })
      } catch {}
    }

    tryInit()

    return () => {
      clearTimeout(timer)
      try {
        if (ac && window.google) window.google.maps.event.clearInstanceListeners(ac)
      } catch {}
    }
  }, [])

  return (
    <input
      ref={ref}
      type="text"
      defaultValue={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
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
        <label className={label}>Home Size *</label>
        <select
          value={form.home_size}
          onChange={e => set('home_size', e.target.value)}
          className={input + " appearance-none cursor-pointer"}
        >
          <option value="">Select home size</option>
          {HOME_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
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
  const [step, setStep] = useState(() => {
    try { return Number(localStorage.getItem(STORAGE_KEY + '_step') ?? 0) } catch { return 0 }
  })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setFormState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? { ...BLANK_FORM, ...JSON.parse(saved) } : BLANK_FORM
    } catch { return BLANK_FORM }
  })

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
      if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        return 'A valid email address is required.'
      if (!form.phone.trim()) return 'Phone number is required.'
    }
    if (s === 1) {
      if (!form.start_date) return 'Please select a date.'
      if (form.preferred_arrival_times.length === 0) return 'Please select a time.'
    }
    if (s === 2) {
      if (!form.service_address.trim()) return 'Service address is required.'
      if (!form.home_size) return 'Please select your home size.'
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
      const { error: fnError } = await supabase.functions.invoke('submit-intake', {
        body: form,
      })
      if (fnError) throw fnError
      try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(STORAGE_KEY + '_step') } catch {}
      setSubmitted(true)
    } catch (e) {
      console.error(e)
      setError('Something went wrong. Please try again or contact us directly.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) return <SuccessScreen name={form.full_name} businessName={BUSINESS_NAME} />

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
          {step === 1 && <Step2 form={form} setFormState={setFormState} />}
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
        <p className="text-center text-xs text-gray-300 mt-2">
          Powered by <span className="font-medium text-teal-400">Kardama</span>
        </p>
      </div>
    </div>
  )
}
