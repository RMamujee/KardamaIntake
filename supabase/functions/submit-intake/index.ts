import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FormData {
  full_name: string
  email: string
  phone: string
  city_zip: string
  start_date: string
  preferred_days: string[]
  preferred_times: string[]
  service_address: string
  unit?: string
  home_size: string
  cleaning_frequency: string
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
      .select()
      .single()

    if (dbError) throw new Error(`DB insert failed: ${dbError.message}`)

    // Non-fatal notifications — log errors but never block the submission
    await Promise.allSettled([
      sendOwnerEmail(form).catch(e => console.error('Email error:', e)),
      sendOwnerSms(form).catch(e => console.error('SMS error:', e)),
      createCalendarEvent(form)
        .then(eventId =>
          supabase.from('intake_submissions').update({ calendar_event_id: eventId }).eq('id', row.id)
        )
        .catch(e => console.error('Calendar error:', e)),
    ])

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

// ── Helpers ────────────────────────────────────────────────────────────────────

function fullAddress(form: FormData): string {
  return form.unit ? `${form.service_address}, ${form.unit}` : form.service_address
}

// ── Email (Resend) ─────────────────────────────────────────────────────────────

async function sendOwnerEmail(form: FormData): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const ownerEmail = Deno.env.get('OWNER_EMAIL')!
  const businessName = Deno.env.get('BUSINESS_NAME') || 'Your Business'

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">New Cleaning Request</h2>
      <p style="color:#555;margin-top:0">Submitted via ${businessName} intake form</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>

      <h3 style="margin-bottom:8px">Contact</h3>
      <p style="margin:4px 0"><strong>Name:</strong> ${form.full_name}</p>
      <p style="margin:4px 0"><strong>Email:</strong> <a href="mailto:${form.email}">${form.email}</a></p>
      <p style="margin:4px 0"><strong>Phone:</strong> <a href="tel:${form.phone}">${form.phone}</a></p>
      <p style="margin:4px 0"><strong>City / ZIP:</strong> ${form.city_zip}</p>

      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>

      <h3 style="margin-bottom:8px">Service Details</h3>
      <p style="margin:4px 0"><strong>Address:</strong> ${fullAddress(form)}</p>
      <p style="margin:4px 0"><strong>Home Size:</strong> ${form.home_size}</p>
      <p style="margin:4px 0"><strong>Frequency:</strong> ${form.cleaning_frequency}</p>
      <p style="margin:4px 0"><strong>Start Date:</strong> ${form.start_date}</p>
      <p style="margin:4px 0"><strong>Preferred Days:</strong> ${form.preferred_days.join(', ')}</p>
      <p style="margin:4px 0"><strong>Preferred Times:</strong> ${form.preferred_times.join(', ')}</p>
      ${form.has_pets_allergies ? `<p style="margin:4px 0"><strong>Pets / Allergies:</strong> ${form.has_pets_allergies}</p>` : ''}
      ${form.additional_notes ? `<p style="margin:4px 0"><strong>Notes:</strong> ${form.additional_notes}</p>` : ''}

      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
      <p style="color:#aaa;font-size:12px">Powered by Kardama</p>
    </div>
  `

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${businessName} Intake <onboarding@resend.dev>`,
      to: ownerEmail,
      reply_to: form.email,
      subject: `New cleaning request — ${form.full_name}`,
      html,
    }),
  })

  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`)
}

// ── SMS (Twilio) ───────────────────────────────────────────────────────────────

async function sendOwnerSms(form: FormData): Promise<void> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')!
  const fromNumber = Deno.env.get('TWILIO_FROM_NUMBER')!
  const ownerPhone = Deno.env.get('OWNER_PHONE')!

  const body = [
    `New cleaning request:`,
    `${form.full_name} | ${form.phone}`,
    `Start: ${form.start_date}`,
    `${fullAddress(form)}`,
    `${form.home_size} | ${form.cleaning_frequency}`,
  ].join('\n')

  const resp = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: fromNumber, To: ownerPhone, Body: body }),
    },
  )

  if (!resp.ok) throw new Error(`Twilio ${resp.status}: ${await resp.text()}`)
}

// ── Google Calendar ────────────────────────────────────────────────────────────

async function createCalendarEvent(form: FormData): Promise<string> {
  const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL')!
  const privateKey = (Deno.env.get('GOOGLE_PRIVATE_KEY') ?? '').replace(/\\n/g, '\n')
  const calendarId = Deno.env.get('GOOGLE_CALENDAR_ID')!

  const accessToken = await getGoogleAccessToken(clientEmail, privateKey)

  // Use the customer's chosen start date + first preferred time for the event
  const firstTime = form.preferred_times[0] ?? 'Morning (8am–12pm)'
  let startHour = 9, endHour = 10
  if (firstTime.includes('Afternoon')) { startHour = 13; endHour = 14 }
  else if (firstTime.includes('Evening')) { startHour = 17; endHour = 18 }

  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${form.start_date}T${pad(startHour)}:00:00`
  const end = `${form.start_date}T${pad(endHour)}:00:00`

  const description = [
    'NEW CUSTOMER REQUEST',
    '',
    `Name: ${form.full_name}`,
    `Email: ${form.email}`,
    `Phone: ${form.phone}`,
    '',
    `Address: ${fullAddress(form)}`,
    `Home Size: ${form.home_size}`,
    `Frequency: ${form.cleaning_frequency}`,
    '',
    `Preferred Days: ${form.preferred_days.join(', ')}`,
    `Preferred Times: ${form.preferred_times.join(', ')}`,
    '',
    `Pets / Allergies: ${form.has_pets_allergies || 'None'}`,
    `Notes: ${form.additional_notes || 'None'}`,
  ].join('\n')

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `Cleaning Request: ${form.full_name}`,
        description,
        start: { dateTime: start, timeZone: 'UTC' },
        end: { dateTime: end, timeZone: 'UTC' },
        colorId: '6',
      }),
    },
  )

  if (!resp.ok) throw new Error(`Calendar API ${resp.status}: ${await resp.text()}`)
  return (await resp.json()).id
}

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

async function getGoogleAccessToken(clientEmail: string, privateKeyPem: string): Promise<string> {
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
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(signingInput))

  const jwt = `${signingInput}.${base64UrlEncode(signature)}`

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })

  const data = await resp.json()
  if (!data.access_token) throw new Error(`Failed to get access token: ${JSON.stringify(data)}`)
  return data.access_token
}
