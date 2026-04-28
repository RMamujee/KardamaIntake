import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FormData {
  type: 'cleaner' | 'customer'
  full_name: string
  email: string
  phone: string
  city_zip: string
  preferred_days: string[]
  preferred_times: string[]
  has_transportation?: string
  years_experience?: string
  service_address?: string
  home_size?: string
  cleaning_frequency?: string
  has_pets_allergies?: string
  additional_notes?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const form: FormData = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: row, error: dbError } = await supabase
      .from('intake_submissions')
      .insert({
        type: form.type,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        city_zip: form.city_zip,
        preferred_days: form.preferred_days,
        preferred_times: form.preferred_times,
        has_transportation: form.has_transportation
          ? form.has_transportation === 'Yes'
          : null,
        years_experience: form.years_experience || null,
        service_address: form.service_address || null,
        home_size: form.home_size || null,
        cleaning_frequency: form.cleaning_frequency || null,
        has_pets_allergies: form.has_pets_allergies || null,
        additional_notes: form.additional_notes || null,
      })
      .select()
      .single()

    if (dbError) throw new Error(`DB insert failed: ${dbError.message}`)

    // Google Calendar — non-fatal if it fails
    try {
      const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL')!
      const privateKey = (Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')
      const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID')!

      const accessToken = await getGoogleAccessToken(clientEmail, privateKey)
      const eventId = await createCalendarEvent(accessToken, calendarId, form)

      await supabase
        .from('intake_submissions')
        .update({ calendar_event_id: eventId })
        .eq('id', row.id)
    } catch (calErr) {
      console.error('Calendar error (non-fatal):', calErr)
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    console.error('Fatal error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})

// ── Google Auth ────────────────────────────────────────────────────────────────

function base64UrlEncode(data: string | ArrayBuffer): string {
  let binary: string
  if (data instanceof ArrayBuffer) {
    binary = Array.from(new Uint8Array(data), b => String.fromCharCode(b)).join('')
  } else {
    binary = Array.from(new TextEncoder().encode(data), b => String.fromCharCode(b)).join('')
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function pemToArrayBuffer(pem: string): Promise<ArrayBuffer> {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const buf = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i)
  return buf.buffer
}

async function createJWT(clientEmail: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = base64UrlEncode(JSON.stringify({
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/calendar',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }))

  const signingInput = `${header}.${payload}`
  const keyBuffer = await pemToArrayBuffer(privateKeyPem)

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${base64UrlEncode(signature)}`
}

async function getGoogleAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const jwt = await createJWT(clientEmail, privateKey)

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  const data = await resp.json()
  if (!data.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(data)}`)
  }
  return data.access_token
}

// ── Calendar Event ─────────────────────────────────────────────────────────────

function getEventTimes(preferredDays: string[], preferredTimes: string[]): { start: string; end: string } {
  const dayIndex: Record<string, number> = {
    Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4,
    Friday: 5, Saturday: 6, Sunday: 0,
  }

  const firstDay = preferredDays[0] ?? 'Monday'
  const firstTime = preferredTimes[0] ?? 'Morning (8am–12pm)'

  const targetDay = dayIndex[firstDay] ?? 1
  const now = new Date()
  let daysUntil = targetDay - now.getDay()
  if (daysUntil <= 0) daysUntil += 7

  const eventDate = new Date(now)
  eventDate.setDate(now.getDate() + daysUntil)

  let startHour = 9, endHour = 10
  if (firstTime.includes('Afternoon')) { startHour = 13; endHour = 14 }
  else if (firstTime.includes('Evening')) { startHour = 17; endHour = 18 }

  const start = new Date(eventDate)
  start.setHours(startHour, 0, 0, 0)
  const end = new Date(eventDate)
  end.setHours(endHour, 0, 0, 0)

  return { start: start.toISOString(), end: end.toISOString() }
}

async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  form: FormData,
): Promise<string> {
  const { start, end } = getEventTimes(form.preferred_days, form.preferred_times)
  const isCustomer = form.type === 'customer'

  const lines = isCustomer
    ? [
        'NEW CUSTOMER REQUEST',
        '',
        `Name: ${form.full_name}`,
        `Email: ${form.email}`,
        `Phone: ${form.phone}`,
        '',
        `Service Address: ${form.service_address}`,
        `Home Size: ${form.home_size}`,
        `Frequency: ${form.cleaning_frequency}`,
        '',
        `Preferred Days: ${form.preferred_days.join(', ')}`,
        `Preferred Times: ${form.preferred_times.join(', ')}`,
        '',
        `Pets / Allergies: ${form.has_pets_allergies || 'None'}`,
        `Notes: ${form.additional_notes || 'None'}`,
      ]
    : [
        'NEW CLEANER APPLICATION',
        '',
        `Name: ${form.full_name}`,
        `Email: ${form.email}`,
        `Phone: ${form.phone}`,
        `Location: ${form.city_zip}`,
        '',
        `Available Days: ${form.preferred_days.join(', ')}`,
        `Available Times: ${form.preferred_times.join(', ')}`,
        '',
        `Transportation: ${form.has_transportation}`,
        `Experience: ${form.years_experience}`,
        `Notes: ${form.additional_notes || 'None'}`,
      ]

  const event = {
    summary: isCustomer
      ? `Customer Intake: ${form.full_name}`
      : `Cleaner Intake: ${form.full_name}`,
    description: lines.join('\n'),
    start: { dateTime: start, timeZone: 'UTC' },
    end: { dateTime: end, timeZone: 'UTC' },
    colorId: isCustomer ? '6' : '2',
  }

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    },
  )

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Calendar API ${resp.status}: ${err}`)
  }

  const data = await resp.json()
  return data.id
}
