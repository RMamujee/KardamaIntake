// ─────────────────────────────────────────────────────────────────────────────
// KardamaIntake n8n Setup Script
// Fill in every FILL_IN below, then run:  node n8n/setup.js
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG = {
  N8N_API_KEY:         'FILL_IN',  // n8n Settings -> n8n API -> Create API key

  RESEND_API_KEY:      'FILL_IN',  // resend.com -> API Keys
  OWNER_EMAIL:         'FILL_IN',  // your email
  OWNER_PHONE:         'FILL_IN',  // E.164 format: +13125550100
  BUSINESS_NAME:       'FILL_IN',  // e.g. Kardama Cleaning

  TWILIO_ACCOUNT_SID:  'FILL_IN',  // twilio.com/console
  TWILIO_AUTH_TOKEN:   'FILL_IN',
  TWILIO_FROM_NUMBER:  'FILL_IN',  // E.164 format: +18005550100

  SUPABASE_SERVICE_KEY: 'FILL_IN', // Supabase Dashboard -> Settings -> API -> service_role
  GOOGLE_CALENDAR_ID:   'primary', // leave as "primary" or paste your calendar ID
}

// ─── Do not edit below this line ─────────────────────────────────────────────

const https = require('https')

const N8N_URL    = 'kardama.app.n8n.cloud'
const SUPABASE_URL = 'https://ovjarxyxkjfochokhmwo.supabase.co'

function validate() {
  const missing = Object.entries(CONFIG).filter(([, v]) => v === 'FILL_IN').map(([k]) => k)
  if (missing.length) {
    console.error('Fill in these values in the script before running:\n  ' + missing.join('\n  '))
    process.exit(1)
  }
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null
    const req = https.request({
      hostname: N8N_URL,
      path: `/api/v1${path}`,
      method,
      headers: {
        'X-N8N-API-KEY': CONFIG.N8N_API_KEY,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try { resolve(JSON.parse(data)) } catch { resolve(data) }
      })
    })
    req.on('error', reject)
    if (payload) req.write(payload)
    req.end()
  })
}

async function main() {
  validate()
  console.log('Setting up n8n for KardamaIntake...\n')

  // 1. Find the imported workflow
  process.stdout.write('Finding workflow... ')
  const { data: workflows } = await request('GET', '/workflows?limit=50')
  const workflow = (workflows || []).find(w => w.name.includes('KardamaIntake'))
  if (!workflow) {
    console.error('\nWorkflow not found. Make sure you imported kardama-intake-workflow.json in n8n first.')
    process.exit(1)
  }
  console.log(`found "${workflow.name}" (ID: ${workflow.id})`)

  // 2. Create Twilio credential
  process.stdout.write('Creating Twilio credential... ')
  const twilio = await request('POST', '/credentials', {
    name: 'Twilio - Kardama',
    type: 'twilioApi',
    data: {
      accountSid: CONFIG.TWILIO_ACCOUNT_SID,
      authToken:  CONFIG.TWILIO_AUTH_TOKEN,
    },
  })
  if (!twilio.id) {
    console.error('\nFailed:', JSON.stringify(twilio))
    process.exit(1)
  }
  console.log(`done (ID: ${twilio.id})`)

  // 3. Set all variables
  console.log('Setting variables:')
  const variables = [
    { key: 'RESEND_API_KEY',      value: CONFIG.RESEND_API_KEY },
    { key: 'OWNER_EMAIL',         value: CONFIG.OWNER_EMAIL },
    { key: 'OWNER_PHONE',         value: CONFIG.OWNER_PHONE },
    { key: 'BUSINESS_NAME',       value: CONFIG.BUSINESS_NAME },
    { key: 'TWILIO_FROM_NUMBER',  value: CONFIG.TWILIO_FROM_NUMBER },
    { key: 'SUPABASE_URL',        value: SUPABASE_URL },
    { key: 'SUPABASE_SERVICE_KEY',value: CONFIG.SUPABASE_SERVICE_KEY },
    { key: 'GOOGLE_CALENDAR_ID',  value: CONFIG.GOOGLE_CALENDAR_ID },
  ]
  for (const v of variables) {
    process.stdout.write(`  ${v.key}... `)
    const res = await request('POST', '/variables', v)
    console.log(res.id ? 'ok' : `failed: ${JSON.stringify(res)}`)
  }

  // 4. Wire Twilio credential into the Owner SMS node
  process.stdout.write('Wiring credentials into workflow... ')
  const full = await request('GET', `/workflows/${workflow.id}`)
  const nodes = (full.nodes || []).map(node => {
    if (node.name === 'Owner SMS') {
      return { ...node, credentials: { twilioApi: { id: String(twilio.id), name: 'Twilio - Kardama' } } }
    }
    return node
  })
  const patch = await request('PATCH', `/workflows/${workflow.id}`, {
    name:        full.name,
    nodes,
    connections: full.connections,
    settings:    full.settings,
  })
  console.log(patch.id ? 'done' : `failed: ${JSON.stringify(patch)}`)

  // 5. Activate
  process.stdout.write('Activating workflow... ')
  const activated = await request('POST', `/workflows/${workflow.id}/activate`)
  console.log(activated.active ? 'active!' : `failed: ${JSON.stringify(activated)}`)

  console.log(`
Done! One manual step remaining:
  1. Open n8n -> KardamaIntake New Booking workflow
  2. Click the "Create Calendar Event" node
  3. Click "Connect Google Calendar" and sign in
  4. Save the workflow

After that, set up the Supabase webhook:
  Supabase Dashboard -> Database -> Webhooks -> Create new
  Table: booking_requests | Event: INSERT
  URL: https://kardama.app.n8n.cloud/webhook/kardama-new-booking
`)
}

main().catch(err => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
