// One-off re-verification (2026-08-11): confirm the aggregated monthly conjunction
// endpoint still behaves as expected before responding to a query about whether the
// dashboard's "monthly conjunction" figure is using the right endpoint.
const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function get (path) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const t0 = Date.now()
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const ms = Date.now() - t0
  const body = await response.json()
  return { status: response.status, ms, body }
}

async function main () {
  // 1. Confirm the aggregated endpoint is still fast and month-scoped for the current month.
  const agg = await get('/v1/stats/monthly/conjunction-events-aggregated?start_date=2026-08-01&end_date=2026-08-31')
  console.log(`aggregated -> HTTP ${agg.status} in ${agg.ms}ms`)
  console.log(JSON.stringify(agg.body, null, 2))

  // 2. Re-confirm the report=present filter is still the only "reviewed" flag and still sparse.
  const reported = await get('/v1/conjunction-events/list?report=present&epoch=all&limit=500&sort_by=tca_time&sort_order=desc')
  console.log(`\nreport=present -> HTTP ${reported.status} in ${reported.ms}ms, rows: ${Array.isArray(reported.body) ? reported.body.length : 'n/a'}`)
  if (Array.isArray(reported.body) && reported.body.length) {
    console.log('sample tca_time values:', reported.body.slice(0, 5).map(r => r.tca_time))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
