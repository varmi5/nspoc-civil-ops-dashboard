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
    '/v1/conjunction-events/events-for-analysis-aggregated?threshold=0.00002',
    '/v1/conjunction-events/events-for-analysis-aggregated?threshold=0.00002&limit=500',
    '/v1/conjunction-events/for-analysis?threshold=0.001',
    '/v1/conjunction-events/for-analysis?threshold=0.001&max_age_days=365',
    '/v1/conjunction-events/for-analysis?threshold=0.00002&max_age_days=365'
  ]) {
    const r = await get(path)
    const count = Array.isArray(r.body) ? r.body.length : 'n/a'
    console.log(`${path}\n-> HTTP ${r.status} in ${r.ms}ms, rows: ${count}`)
    if (Array.isArray(r.body) && r.body.length) console.log('  sample:', JSON.stringify(r.body[0]).slice(0,300))
    console.log()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
