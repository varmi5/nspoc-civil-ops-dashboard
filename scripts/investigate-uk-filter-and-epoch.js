// One-off dev tool: (1) checks whether more reentry-events show up with epoch=all/past
// vs the future-only default, (2) looks for any UK-specific filter on conjunction-events,
// (3) checks whether the monthly conjunction-events endpoint is timing out right now.
//
// Run with: node --env-file=.env scripts/investigate-uk-filter-and-epoch.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()

  async function get (path) {
    const started = Date.now()
    try {
      const url = new URL(path, config.apiBaseUrl)
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const ms = Date.now() - started
      console.log(`\n${path} -> ${response.status} (${ms}ms)`)
      if (!response.ok) {
        console.log((await response.text()).slice(0, 300))
        return null
      }
      return await response.json()
    } catch (err) {
      console.log(`\n${path} -> ERROR after ${Date.now() - started}ms: ${err.message}`)
      return null
    }
  }

  console.log('=== 1. reentry-events epoch comparison ===')
  const future = await get('/v1/reentry-events/?epoch=future&limit=100')
  console.log('epoch=future count:', Array.isArray(future) ? future.length : 'n/a')

  const past = await get('/v1/reentry-events/?epoch=past&limit=100')
  console.log('epoch=past count:', Array.isArray(past) ? past.length : 'n/a')

  const all = await get('/v1/reentry-events/?epoch=all&limit=100')
  console.log('epoch=all count:', Array.isArray(all) ? all.length : 'n/a')

  const stats = await get('/v1/reentry-events/stats')
  console.log('reentry-events/stats (default epoch):', JSON.stringify(stats))
  const statsAll = await get('/v1/reentry-events/stats?epoch=all')
  console.log('reentry-events/stats?epoch=all:', JSON.stringify(statsAll))

  console.log('\n\n=== 2. Looking for a UK filter on conjunction-events ===')
  // Check the openapi spec for conjunction-events/ params again, in case something was missed
  const spec = await get('/openapi.json')
  if (spec) {
    const paramNames = new Set()
    for (const [path, methods] of Object.entries(spec.paths || {})) {
      if (!path.includes('conjunction-events') && !path.includes('satellites')) continue
      for (const op of Object.values(methods)) {
        for (const p of (op.parameters || [])) paramNames.add(`${path} :: ${p.name}`)
      }
    }
    console.log('All params on conjunction-events/satellites endpoints:')
    console.log([...paramNames].join('\n'))
  }

  // Try a plausible org-based UK filter
  await get('/v1/stats/events-by-organization')

  console.log('\n\n=== 3. Is the monthly conjunction-events endpoint slow right now? ===')
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)
  await get(`/v1/stats/monthly/conjunction-events?start_date=${start}&end_date=${end}`)
  // second attempt to see if it's consistently slow or a one-off
  await get(`/v1/stats/monthly/conjunction-events?start_date=${start}&end_date=${end}`)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
