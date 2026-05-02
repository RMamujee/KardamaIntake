import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface FormData {
  full_name: string
  email: string
  phone: string
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
  payment_method?: string
  property_data?: unknown
}

const HOME_SIZE_DURATION_MIN: Record<string, number> = {
  'Studio': 120,
  '1 Bedroom': 150,
  '2 Bedrooms': 180,
  '3 Bedrooms': 210,
  '4+ Bedrooms': 270,
  'Commercial': 270,
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

    // Server-side capacity check — prevents race-condition double-bookings.
    // Uses the per-slot RPC so realistic durations (per home size + commute
    // buffer) are factored in rather than the prior all-day overlap heuristic.
    const durationMinutes = HOME_SIZE_DURATION_MIN[form.home_size] ?? 180
    const arrival = form.preferred_arrival_times?.[0]
    const { data: blocked, error: blockedErr } = await supabase.rpc('get_booked_slots', {
      check_date: form.start_date,
      duration_minutes: durationMinutes,
    })
    if (blockedErr) throw new Error(`Capacity check failed: ${blockedErr.message}`)
    if (arrival && Array.isArray(blocked) && blocked.includes(arrival)) {
      return new Response(
        JSON.stringify({ error: 'Sorry, this time slot just filled up. Please choose another time.' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const { error: dbError } = await supabase
      .from('booking_requests')
      .insert({
        customer_name: form.full_name,
        customer_email: form.email,
        customer_phone: form.phone,
        address: form.service_address,
        unit: form.unit || null,
        preferred_date: form.start_date,
        preferred_days: form.preferred_days,
        preferred_arrival_times: form.preferred_arrival_times,
        preferred_exit_times: form.preferred_exit_times,
        home_size: form.home_size,
        cleaning_frequency: form.cleaning_frequency,
        has_pets_allergies: form.has_pets_allergies || null,
        notes: form.additional_notes || '',
        payment_method: form.payment_method || null,
        property_data: form.property_data ?? null,
        source: 'intake-form',
      })

    if (dbError) throw new Error(`DB insert failed: ${dbError.message}`)

    // n8n handles all notifications (email, SMS, calendar) via Supabase webhook
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
