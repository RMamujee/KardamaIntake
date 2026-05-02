import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RENTCAST_BASE = 'https://api.rentcast.io/v1'
// 30-day cache — property attributes don't change often.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { address } = await req.json()
    if (!address || typeof address !== 'string') {
      return json({ error: 'address is required', data: null }, 400)
    }

    const apiKey = Deno.env.get('RENTCAST_API_KEY')
    if (!apiKey) {
      // Key not yet provisioned — return gracefully so the intake form
      // continues to submit without property enrichment.
      return json({ error: 'not_configured', data: null }, 200)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const normalized = address.trim().toLowerCase()

    const { data: cached } = await supabase
      .from('property_lookups')
      .select('data, updated_at')
      .eq('address', normalized)
      .maybeSingle()
    if (cached && Date.now() - new Date(cached.updated_at).getTime() < CACHE_TTL_MS) {
      return json({ data: cached.data, cached: true })
    }

    const url = `${RENTCAST_BASE}/properties?address=${encodeURIComponent(address)}`
    const r = await fetch(url, {
      headers: { 'X-Api-Key': apiKey, Accept: 'application/json' },
    })
    if (!r.ok) {
      const detail = await r.text()
      return json({ error: 'rentcast_error', status: r.status, detail, data: null })
    }

    const raw = await r.json()
    const property = Array.isArray(raw) ? raw[0] : raw
    const summary = property
      ? {
          bedrooms:        property.bedrooms ?? null,
          bathrooms:       property.bathrooms ?? null,
          square_feet:     property.squareFootage ?? null,
          year_built:      property.yearBuilt ?? null,
          lot_size:        property.lotSize ?? null,
          property_type:   property.propertyType ?? null,
          last_sale_price: property.lastSalePrice ?? null,
          last_sale_date:  property.lastSaleDate ?? null,
          raw:             property,
        }
      : null

    if (summary) {
      await supabase.from('property_lookups').upsert(
        { address: normalized, data: summary, updated_at: new Date().toISOString() },
        { onConflict: 'address' },
      )
    }

    return json({ data: summary, cached: false })
  } catch (err) {
    console.error('lookup-property error:', err)
    return json({ error: String(err), data: null }, 500)
  }
})
