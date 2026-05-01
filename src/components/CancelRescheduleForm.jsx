import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const API_BASE = 'https://kardama-ai.vercel.app'

const TIMES = ['8:00am', '9:00am', '10:00am', '11:00am', '1:00pm', '2:00pm']
const HOME_SIZE_DURATION_MIN = {
  Studio: 120, '1 Bedroom': 150, '2 Bedrooms': 180,
  '3 Bedrooms': 210, '4+ Bedrooms': 270, Commercial: 270,
}

const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

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
const to12h = (t) => {
  if (!t) return ''
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return t
  let h = parseInt(m[1]); const min = m[2]
  const period = h < 12 ? 'am' : 'pm'
  if (h === 0) h = 12; else if (h > 12) h -= 12
  return `${h}:${min}${period}`
}
const to24h = (t) => {
  const m = t.match(/^(\d{1,2}):(\d{2})(am|pm)$/i)
  if (!m) return t
  let h = parseInt(m[1]); const p = m[3].toLowerCase()
  if (p === 'pm' && h !== 12) h += 12
  if (p === 'am' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}:${String(m[2]).padStart(2, '0')}`
}
const fmtLong = (dateStr) =>
  parseDate(dateStr).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

const label = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function CancelRescheduleForm() {
  const _qs = new URLSearchParams(window.location.search)
  const bookingId = _qs.get('manage')
  const initialView = _qs.get('action') === 'reschedule' ? 'reschedule'
    : _qs.get('action') === 'cancel' ? 'confirming-cancel'
    : 'choice'

  const [booking, setBooking] = useState(null)
  const [fetchState, setFetchState] = useState('loading') // 'loading' | 'ready' | 'error'
  const [view, setView] = useState(initialView) // 'choice' | 'reschedule' | 'confirming-cancel' | 'done'
  const [doneAction, setDoneAction] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const today = startOfDay(new Date())
  const minDate = new Date(today); minDate.setDate(today.getDate() + 1)
  const [calView, setCalView] = useState({ year: minDate.getFullYear(), month: minDate.getMonth() })
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [bookedTimes, setBookedTimes] = useState([])

  useEffect(() => {
    if (!bookingId) { setFetchState('error'); return }
    fetch(`${API_BASE}/api/intake/${bookingId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setFetchState('error'); else { setBooking(d); setFetchState('ready') } })
      .catch(() => setFetchState('error'))
  }, [bookingId])

  useEffect(() => {
    if (!selectedDate) { setBookedTimes([]); return }
    const dur = HOME_SIZE_DURATION_MIN[booking?.home_size] ?? 180
    supabase.rpc('get_booked_slots', { check_date: selectedDate, duration_minutes: dur })
      .then(({ data }) => setBookedTimes(Array.isArray(data) ? data : []))
      .catch(() => setBookedTimes([]))
  }, [selectedDate, booking?.home_size])

  const handleCancel = async () => {
    setSubmitting(true); setSubmitError('')
    try {
      const res = await fetch(`${API_BASE}/api/intake/${bookingId}/cancel`, { method: 'POST' })
      if (!res.ok) throw new Error()
      setDoneAction('cancel'); setView('done')
    } catch {
      setSubmitError('Could not cancel. Please contact us directly.')
    } finally { setSubmitting(false) }
  }

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime) { setSubmitError('Please select a date and time.'); return }
    setSubmitting(true); setSubmitError('')
    try {
      const res = await fetch(`${API_BASE}/api/intake/${bookingId}/reschedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferred_date: selectedDate, preferred_time: to24h(selectedTime) }),
      })
      if (!res.ok) throw new Error()
      setDoneAction('reschedule'); setView('done')
    } catch {
      setSubmitError('Could not reschedule. Please contact us directly.')
    } finally { setSubmitting(false) }
  }

  const shell = (children) => (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )

  const bookingDateStr = booking?.preferred_date ? fmtLong(booking.preferred_date) : '—'
  const bookingTimeStr = to12h(booking?.preferred_time || '')

  if (fetchState === 'loading') return shell(
    <div className="text-center py-20 text-gray-400 text-sm">Loading your booking…</div>
  )

  if (fetchState === 'error') return shell(
    <div className="bg-white rounded-2xl shadow-xl shadow-teal-100/50 p-8 text-center space-y-4">
      <p className="text-gray-600 text-sm">Booking not found. Please use the link from your confirmation email.</p>
      <a href="/" className="text-teal-500 hover:underline text-sm">← Book a new cleaning</a>
    </div>
  )

  if (view === 'done') return shell(
    <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-teal-100 p-6 sm:p-10 text-center">
      <div className="w-14 h-14 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
      <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3">
        {doneAction === 'cancel' ? 'Booking cancelled' : 'Booking rescheduled'}
      </h2>
      <p className="text-gray-500 mb-6 text-sm leading-relaxed">
        {doneAction === 'cancel'
          ? 'Your booking has been cancelled and the slot is now available.'
          : `Your cleaning has been moved to ${fmtLong(selectedDate)} at ${selectedTime}.`}
      </p>
      <a href="/" className="text-teal-500 hover:underline text-sm">← Book a new cleaning</a>
    </div>
  )

  if (view === 'reschedule') {
    const grid = buildMonthGrid(calView.year, calView.month)
    const canGoBack = calView.year > today.getFullYear() ||
      (calView.year === today.getFullYear() && calView.month > today.getMonth())

    return shell(
      <>
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Pick a New Time</h1>
          <p className="text-sm text-gray-500 mt-1">{booking.customer_name}</p>
        </div>
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-teal-100/50 p-5 sm:p-8">
          {submitError && (
            <div className="mb-5 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{submitError}</div>
          )}

          {/* Month calendar */}
          <div>
            <p className={label}>Select a date *</p>
            <div className="border border-gray-200 rounded-2xl p-3 sm:p-4 mb-5">
              <div className="flex items-center justify-between mb-4">
                <button type="button"
                  onClick={() => setCalView(v => v.month === 0 ? { year: v.year - 1, month: 11 } : { year: v.year, month: v.month - 1 })}
                  disabled={!canGoBack}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-gray-600">
                  ‹
                </button>
                <span className="text-sm font-semibold text-gray-800">{MONTHS[calView.month]} {calView.year}</span>
                <button type="button"
                  onClick={() => setCalView(v => v.month === 11 ? { year: v.year + 1, month: 0 } : { year: v.year, month: v.month + 1 })}
                  className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-600">
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
                  const sel = fmtDate(d) === selectedDate
                  return (
                    <button key={i} type="button"
                      onClick={() => { if (!past) { setSelectedDate(fmtDate(d)); setSelectedTime('') } }}
                      disabled={past}
                      className={`aspect-square rounded-full text-sm font-medium transition-all ${
                        sel ? 'bg-teal-500 text-white shadow-sm'
                        : past ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-700 hover:bg-teal-50'
                      }`}>
                      {d.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Time picker */}
          {selectedDate && (
            <div className="mb-6">
              <p className={label}>Select a time *</p>
              <p className="text-xs text-gray-400 mb-3">
                {parseDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TIMES.map(t => {
                  const booked = bookedTimes.includes(t)
                  return (
                    <button key={t} type="button"
                      onClick={() => !booked && setSelectedTime(t)}
                      disabled={booked}
                      className={`py-3 px-4 rounded-xl text-sm font-medium transition-all border-2 ${
                        booked ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                        : selectedTime === t ? 'bg-teal-500 text-white border-teal-500 shadow-sm'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-teal-400'
                      }`}>
                      {booked ? `${t} · Full` : t}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setView('choice'); setSubmitError('') }}
              className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-all">
              ← Back
            </button>
            <button onClick={handleReschedule} disabled={submitting || !selectedDate || !selectedTime}
              className="flex-1 py-3 px-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 active:scale-95 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? 'Saving…' : 'Confirm New Time'}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          <a href="/" className="hover:text-teal-500 transition-colors">← Back to booking form</a>
        </p>
        <p className="text-center text-xs text-gray-300 mt-2">
          Powered by <span className="font-medium text-teal-400">Kardama</span>
        </p>
      </>
    )
  }

  // 'confirming-cancel' view — one-tap confirm so email link doesn't cancel accidentally
  if (view === 'confirming-cancel') return shell(
    <>
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cancel Booking</h1>
        <p className="text-sm sm:text-base text-gray-500 mt-1">{booking.customer_name}</p>
      </div>
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-teal-100/50 p-5 sm:p-8">
        <div className="p-4 bg-teal-50 rounded-xl mb-6">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">Booking to cancel</p>
          <p className="text-teal-800 font-medium text-sm">{bookingDateStr}</p>
          {bookingTimeStr && <p className="text-teal-700 text-sm mt-0.5">Arrival: {bookingTimeStr}</p>}
        </div>

        {submitError && (
          <div className="mb-5 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{submitError}</div>
        )}

        {booking.status === 'cancelled' ? (
          <p className="text-center text-gray-500 text-sm py-4">This booking has already been cancelled.</p>
        ) : (
          <div className="space-y-3">
            <button onClick={handleCancel} disabled={submitting}
              className="w-full py-3 px-4 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 active:scale-95 transition-all shadow-sm disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? 'Cancelling…' : 'Yes, cancel my booking'}
            </button>
            <button onClick={() => setView('choice')}
              className="w-full py-3 px-4 border-2 border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-all">
              Keep my booking
            </button>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-gray-400 mt-4">
        <a href="/" className="hover:text-teal-500 transition-colors">← Back to booking form</a>
      </p>
      <p className="text-center text-xs text-gray-300 mt-2">
        Powered by <span className="font-medium text-teal-400">Kardama</span>
      </p>
    </>
  )

  // 'choice' view — default
  return shell(
    <>
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Manage Booking</h1>
        <p className="text-sm sm:text-base text-gray-500 mt-1">{booking.customer_name}</p>
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl shadow-teal-100/50 p-5 sm:p-8">
        <div className="p-4 bg-teal-50 rounded-xl mb-6">
          <p className="text-xs font-semibold text-teal-600 uppercase tracking-wide mb-2">Your upcoming cleaning</p>
          <p className="text-teal-800 font-medium text-sm">{bookingDateStr}</p>
          {bookingTimeStr && <p className="text-teal-700 text-sm mt-0.5">Arrival: {bookingTimeStr}</p>}
        </div>

        {submitError && (
          <div className="mb-5 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">{submitError}</div>
        )}

        {booking.status === 'cancelled' ? (
          <p className="text-center text-gray-500 text-sm py-4">This booking has already been cancelled.</p>
        ) : (
          <div className="space-y-3">
            <button onClick={() => { setView('reschedule'); setSubmitError('') }}
              className="w-full py-3 px-4 bg-teal-600 text-white rounded-xl font-semibold hover:bg-teal-700 active:scale-95 transition-all shadow-sm">
              Reschedule
            </button>
            <button onClick={() => setView('confirming-cancel')} disabled={submitting}
              className="w-full py-3 px-4 border-2 border-red-200 text-red-500 rounded-xl font-medium hover:bg-red-50 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
              Cancel Booking
            </button>
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 mt-4">
        <a href="/" className="hover:text-teal-500 transition-colors">← Book a new cleaning</a>
      </p>
      <p className="text-center text-xs text-gray-300 mt-2">
        Powered by <span className="font-medium text-teal-400">Kardama</span>
      </p>
    </>
  )
}
