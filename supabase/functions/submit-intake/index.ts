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
  preferred_arrival_times: string[]
  preferred_exit_times: string[]
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

    const { error: dbError } = await supabase
      .from('booking_requests')
      .insert({
        customer_name: form.full_name,
        customer_email: form.email,
        customer_phone: form.phone,
        address: form.service_address,
        unit: form.unit || null,
        city: form.city_zip,
        preferred_date: form.start_date,
        preferred_days: form.preferred_days,
        preferred_arrival_times: form.preferred_arrival_times,
        preferred_exit_times: form.preferred_exit_times,
        home_size: form.home_size,
        cleaning_frequency: form.cleaning_frequency,
        has_pets_allergies: form.has_pets_allergies || null,
        notes: form.additional_notes || '',
        source: 'intake-form',
      })

    if (dbError) throw new Error(`DB insert failed: ${dbError.message}`)

    // Non-fatal notifications — log errors but never block the submission
    await Promise.allSettled([
      sendOwnerEmail(form).catch(e => console.error('Owner email error:', e)),
      sendOwnerSms(form).catch(e => console.error('Owner SMS error:', e)),
      sendCustomerEmail(form).catch(e => console.error('Customer email error:', e)),
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
      <p style="margin:4px 0"><strong>Preferred Arrival:</strong> ${form.preferred_arrival_times.join(', ')}</p>
      <p style="margin:4px 0"><strong>Preferred Exit:</strong> ${form.preferred_exit_times.join(', ')}</p>
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

// ── Customer confirmation email ────────────────────────────────────────────────

async function sendCustomerEmail(form: FormData): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY')!
  const businessName = Deno.env.get('BUSINESS_NAME') || 'Your Business'
  const ownerEmail = Deno.env.get('OWNER_EMAIL')

  const arrival = form.preferred_arrival_times[0] ?? ''
  const dateLine = arrival ? `${form.start_date} at ${arrival}` : form.start_date

  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#111">
      <h2 style="margin-bottom:4px">Thanks, ${form.full_name.split(' ')[0]}!</h2>
      <p style="color:#555;margin-top:0">We received your cleaning request.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>

      <p style="margin:4px 0"><strong>Requested time:</strong> ${dateLine}</p>
      <p style="margin:4px 0"><strong>Service address:</strong> ${fullAddress(form)}</p>
      <p style="margin:4px 0"><strong>Home size:</strong> ${form.home_size}</p>
      <p style="margin:4px 0"><strong>Frequency:</strong> ${form.cleaning_frequency}</p>

      <hr style="border:none;border-top:1px solid #eee;margin:16px 0"/>
      <p style="margin:4px 0">We'll review your request and send a confirmation text once your appointment is on the calendar.</p>

      <p style="color:#aaa;font-size:12px;margin-top:24px">— ${businessName}</p>
    </div>
  `

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${businessName} <onboarding@resend.dev>`,
      to: form.email,
      ...(ownerEmail ? { reply_to: ownerEmail } : {}),
      subject: `We got your cleaning request — ${businessName}`,
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
