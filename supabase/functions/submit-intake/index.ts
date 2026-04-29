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
  payment_method?: string
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
        payment_method: form.payment_method || null,
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
