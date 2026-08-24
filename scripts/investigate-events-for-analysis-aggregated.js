// One-off (2026-08-12): Saoirse suggested the probability-threshold filter (>1e-3, i.e.
// threshold=0.001, same as the existing for-analysis endpoint) might BE NSpOC's reported
// monthly figure. Already known: the raw >1e-3 column on MSH's own probability-of-collision
// table is single digits/month - nowhere near 1,300. But there's an untested sibling found
// in openapi.json: /v1/conjunction-events/events-for-analysis-aggregated - checking its
// params and live monthly numbers in case it uses a different (lower) default threshold or
// a different counting method than the raw >1e-3 bucket.
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
  const token = await tokenCache.getAccessToken()
  const specUrl = new URL('/openapi.json', config.apiBaseUrl)
  const spec = await (await fetch(specUrl, { headers: { Authorization: `Bearer ${token}` } })).json()
  console.log('events-for-analysis-aggregated params:')
  console.log(JSON.stringify(spec.paths['/v1/conjunction-events/events-for-analysis-aggregated'].get.parameters, null, 2))

  console.log('\nfor-analysis params:')
  console.log(JSON.stringify(spec.paths['/v1/conjunction-events/for-analysis'].get.parameters, null, 2))

  // Try default (no params) and with a 0.001 threshold, over a wide date range if it takes one
  for (const path of [
    '/v1/conjunction-events/events-for-analysis-aggregated',
    '/v1/conjunction-events/events-for-analysis-aggregated?threshold=0.001',
    '/v1/conjunction-events/events-for-analysis-aggregated?threshold=0.001&start_date=2026-05-01&end_date=2026-05-31',
    '/v1/conjunction-events/events-for-analysis-aggregated?start_date=2026-05-01&end_date=2026-05-31'
  ]) {
    const r = await get(path)
    console.log(`\n${path}\n-> HTTP ${r.status} in ${r.ms}ms`)
    console.log(JSON.stringify(r.body, null, 2).slice(0, 1500))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
