import { useState } from 'react'
import { supabase } from '../lib/supabase'
import SuccessScreen from './SuccessScreen'

// Set to false once Supabase is connected
const MOCK = true

const BUSINESS_NAME = 'YOUR_BUSINESS'

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const TIMES = ['Morning (8am–12pm)', 'Afternoon (12pm–5pm)', 'Evening (5pm–8pm)']
const HOME_SIZES = ['Studio', '1 Bedroom', '2 Bedrooms', '3 Bedrooms', '4+ Bedrooms', 'Commercial']
const FREQUENCIES = ['One-time', 'Weekly', 'Bi-weekly', 'Monthly']
const STEPS = ['About You', 'Your Schedule', 'Final Details']

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

function Step2({ form, toggleArray }) {
  return (
    <div className="space-y-6">
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
          {TIMES.map((time, i) => {
            const icons = ['☀️', '🌤️', '🌙']
            return (
              <button
                key={time}
                type="button"
                onClick={() => toggleArray('preferred_times', time)}
                className={`w-full p-3 rounded-xl text-left text-sm font-medium transition-all flex items-center gap-2 ${
                  form.preferred_times.includes(time)
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{icons[i]}</span>
                <span>{time}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Step3({ form, set }) {
  return (
    <div className="space-y-5">
      <div>
        <label className={label}>Service Address *</label>
        <input
          type="text"
          value={form.service_address}
          onChange={e => set('service_address', e.target.value)}
          placeholder="123 Main St, Chicago, IL 60601"
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
  const [step, setStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setFormState] = useState({
    type: 'customer',
    full_name: '',
    email: '',
    phone: '',
    city_zip: '',
    preferred_days: [],
    preferred_times: [],
    service_address: '',
    home_size: '',
    cleaning_frequency: '',
    has_pets_allergies: '',
    additional_notes: '',
  })

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
      if (MOCK) {
        await new Promise(r => setTimeout(r, 1000))
      } else {
        const { error: fnError } = await supabase.functions.invoke('submit-intake', {
          body: form,
        })
        if (fnError) throw fnError
      }
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
          <div className="inline-flex items-center justify-center w-14 h-14 bg-teal-600 rounded-2xl mb-4 shadow-lg">
            <span className="text-2xl">✨</span>
          </div>
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
                  {i < step ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : i + 1}
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
            <div className="mb-5 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-start gap-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {step === 0 && <Step1 form={form} set={set} />}
          {step === 1 && <Step2 form={form} toggleArray={toggleArray} />}
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
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting...
                  </span>
                ) : 'Submit'}
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
