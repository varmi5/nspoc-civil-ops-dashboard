// One-off (2026-08-11): compare /v1/stats/monthly/conjunction-events-aggregated against
// the numbers the user read off MSH's own site "Performance" page, "conjunction events by
// type" table, to check whether that page is sourced from the same endpoint we already use.
const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function get (path) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return response.json()
}

async function main () {
  const rows = await get('/v1/stats/monthly/conjunction-events-aggregated?start_date=2025-11-01&end_date=2026-08-31')
  console.log(JSON.stringify(rows, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
