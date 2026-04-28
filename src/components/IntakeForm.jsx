import { useState, useEffect } from 'react'
import Autocomplete from 'react-google-autocomplete'
import { supabase } from '../lib/supabase'
import SuccessScreen from './SuccessScreen'

const MOCK = false

const BUSINESS_NAME = 'YOUR_BUSINESS'
const STORAGE_KEY = 'kardama_intake_draft'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIMES = ['Morning (8am–12pm)', 'Afternoon (12pm–5pm)', 'Evening (5pm–8pm)']
const HOME_SIZES = ['Studio', '1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4+ Bedrooms', 'Commercial']
const FREQUENCIES = ['One-time', 'Weekly', 'Bi-weekly', 'Monthly']
const STEPS = ['About You', 'Your Schedule', 'Final Details']

const tomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

const BLANK_FORM = {
  type: 'customer',
  full_name: '',
  email: '',
  phone: '',
  city_zip: '',
  start_date: '',
  preferred_days: [],
  preferred_times: [],
  service_address: '',
  unit: '',
  home_size: '',
  cleaning_frequency: '',
  has_pets_allergies: '',
  additional_notes: '',
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

      <div>
        <label className={label}>City / ZIP Code *</label>
        <input
          type="text"
          value={form.city_zip}
          onChange={e => set('city_zip', e.target.value)}
          placeholder="Chicago, IL 60601"
          className={input}
        />
      </div>
    </div>
  )
}

function Step2({ form, set, toggleArray }) {
  return (
    <div className="space-y-6">
      <div>
        <label className={label}>Preferred Start Date *</label>
        <input
          type="date"
          value={form.start_date}
          min={tomorrow()}
          onChange={e => set('start_date', e.target.value)}
          className={input}
        />
      </div>

      <div>
        <p className={label}>Preferred Days *</p>
        <p className="text-xs text-gray-400 mb-3">Select all that apply</p>
        <div className="grid grid-cols-4 gap-2">
          {DAYS.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => toggleArray('preferred_days', day)}
              className={`py-2 px-1 rounded-lg text-sm font-medium transition-all ${
                form.preferred_days.includes(day)
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className={label}>Preferred Time of Day *</p>
        <p className="text-xs text-gray-400 mb-3">Select all that apply</p>
        <div className="space-y-2">
          {TIMES.map(time => (
            <button
              key={time}
              type="button"
              onClick={() => toggleArray('preferred_times', time)}
              className={`w-full p-3 rounded-xl text-left text-sm font-medium transition-all ${
                form.preferred_times.includes(time)
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

function AddressInput({ value, onChange, className, placeholder }) {
  if (GOOGLE_API_KEY) {
    return (
      <Autocomplete
        apiKey={GOOGLE_API_KEY}
        onPlaceSelected={place => onChange(place.formatted_address ?? value)}
        onChange={e => onChange(e.target.value)}
        options={{ types: ['address'], componentRestrictions: { country: 'us' } }}
        defaultValue={value}
        placeholder={placeholder}
        className={className}
      />
    )
  }
  return (
    <input
      type="text"
      value={value}
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
      if (!form.city_zip.trim()) return 'City / ZIP Code is required.'
    }
    if (s === 1) {
      if (!form.start_date) return 'Please select a preferred start date.'
      if (form.preferred_days.length === 0) return 'Please select at least one preferred day.'
      if (form.preferred_times.length === 0) return 'Please select at least one preferred time.'
    }
    if (s === 2) {
      if (!form.service_address.trim()) return 'Service address is required.'
      if (!form.home_size) return 'Please select your home size.'
      if (!form.cleaning_frequency) return 'Please select a cleaning frequency.'
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
      const { error: dbError } = await supabase.from('intake_submissions').insert({
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        city_zip: form.city_zip,
        start_date: form.start_date,
        preferred_days: form.preferred_days,
        preferred_times: form.preferred_times,
        service_address: form.service_address,
        unit: form.unit || null,
        home_size: form.home_size,
        cleaning_frequency: form.cleaning_frequency,
        has_pets_allergies: form.has_pets_allergies || null,
        additional_notes: form.additional_notes || null,
      })
      if (dbError) throw dbError
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
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{BUSINESS_NAME}</h1>
          <p className="text-gray-500 mt-1">Request a cleaning</p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-start justify-center mb-8">
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
                <div className={`w-14 h-0.5 mx-1 mb-4 transition-all ${
                  i < step ? 'bg-teal-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-teal-100/50 p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">{STEPS[step]}</h2>

          {error && (
            <div className="mb-5 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}

          {step === 0 && <Step1 form={form} set={set} />}
          {step === 1 && <Step2 form={form} set={set} toggleArray={toggleArray} />}
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
