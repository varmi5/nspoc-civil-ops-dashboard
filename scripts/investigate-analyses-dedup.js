// One-off (2026-08-12): each /v1/analyses/ record carries an event_short_id. NSpOC's real
// monthly report figure (~1,300) is much smaller than /v1/stats/monthly/analyses' raw count
// (5,000-8,000/month) - checking whether that's because one conjunction event gets several
// analyses over time (re-assessed as its risk estimate updates), the same revision pattern
// already confirmed for CDMs elsewhere. If so, deduping analyses by event_short_id for one
// month might land close to the real reported figure.
const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function get (path) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return response.json()
}

async function main () {
  // Check params available on /v1/analyses/
  const specToken = await tokenCache.getAccessToken()
  const specUrl = new URL('/openapi.json', config.apiBaseUrl)
  const spec = await (await fetch(specUrl, { headers: { Authorization: `Bearer ${specToken}` } })).json()
  const params = spec.paths['/v1/analyses/'].get.parameters.map(p => p.name)
  console.log('/v1/analyses/ GET params:', params)

  // Pull May 2026 (a full month, 5313 per the monthly stats endpoint) and dedupe.
  const rows = await get('/v1/analyses/?start_date=2026-05-01&end_date=2026-05-31&limit=10000')
  const list = Array.isArray(rows) ? rows : (rows.items || rows.data || [])
  console.log('rows fetched:', list.length)
  if (list.length) {
    console.log('sample row keys:', Object.keys(list[0]))
    const byEvent = new Set(list.map(r => r.event_short_id))
    console.log('unique event_short_id count:', byEvent.size)
    const byCdm = new Set(list.map(r => r.cdm_external_id))
    console.log('unique cdm_external_id count:', byCdm.size)
  } else {
    console.log('raw response (first 1000 chars):', JSON.stringify(rows).slice(0, 1000))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
