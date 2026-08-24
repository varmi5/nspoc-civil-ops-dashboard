const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()
  const url = new URL('/v1/stats/monthly/conjunction-events-by-object-type-aggregated?start_date=2026-02-01&end_date=2026-08-31', config.apiBaseUrl)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  console.log(JSON.stringify(await response.json(), null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
