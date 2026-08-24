// One-off (2026-08-12): confirm /v1/stats/monthly/analyses(-aggregated) and
// /v1/stats/monthly/manoeuvre_plots exist on PROD (not just visible via openapi.json) and
// see how their numbers compare to the "NSpOC conjunction event analysis and manoeuvre
// support" monthly table shown on the MSH website, and to the raw
// conjunction-events-aggregated screening total, for the same months.
const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function get (path) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const t0 = Date.now()
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const ms = Date.now() - t0
  let body
  try { body = await response.json() } catch { body = null }
  return { status: response.status, ms, body }
}

async function main () {
  for (const path of [
    '/v1/stats/monthly/analyses?start_date=2026-03-01&end_date=2026-08-31',
    '/v1/stats/monthly/analyses-aggregated?start_date=2026-03-01&end_date=2026-08-31',
    '/v1/stats/monthly/manoeuvre_plots?start_date=2026-03-01&end_date=2026-08-31'
  ]) {
    const r = await get(path)
    console.log(`\n${path}\n-> HTTP ${r.status} in ${r.ms}ms`)
    console.log(JSON.stringify(r.body, null, 2).slice(0, 2000))
  }

  // Also grab a single analysis record's shape, if any exist, to see what fields it carries
  // (e.g. does it reference an event short_id / cdm_external_id, so we can tell whether one
  // event can generate multiple analyses).
  const sample = await get('/v1/analyses/?limit=5')
  console.log('\n/v1/analyses/?limit=5')
  console.log(JSON.stringify(sample.body, null, 2).slice(0, 3000))
}

main().catch(err => { console.error(err); process.exit(1) })
