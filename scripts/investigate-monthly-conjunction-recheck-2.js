const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()
  const url = new URL('/v1/stats/monthly/conjunction-events?start_date=2026-07-01&end_date=2026-07-31', config.apiBaseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  const t0 = Date.now()
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
    const ms = Date.now() - t0
    const body = await response.json()
    console.log(`-> HTTP ${response.status} after ${ms}ms`)
    console.log(JSON.stringify(body, null, 2))
  } catch (err) {
    console.log(`-> FAILED after ${Date.now() - t0}ms: ${err.message}`)
  } finally {
    clearTimeout(timeout)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
