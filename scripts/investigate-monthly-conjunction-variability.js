const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function timedRequest (label, startDate, endDate, timeoutMs) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(`/v1/stats/monthly/conjunction-events?start_date=${startDate}&end_date=${endDate}`, config.apiBaseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const t0 = Date.now()
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
    const ms = Date.now() - t0
    const body = await response.json()
    const total = Array.isArray(body) ? body.reduce((sum, row) => sum + (row.count || 0), 0) : null
    console.log(`${label} (${startDate} to ${endDate}) -> HTTP ${response.status} after ${ms}ms, total=${total}`)
    return { label, ms, status: response.status, total }
  } catch (err) {
    console.log(`${label} (${startDate} to ${endDate}) -> FAILED after ${Date.now() - t0}ms: ${err.message}`)
    return { label, ms: Date.now() - t0, status: 'timeout', total: null }
  } finally {
    clearTimeout(timeout)
  }
}

async function main () {
  console.log('now:', new Date().toISOString())
  console.log('Running SEQUENTIALLY (not parallel) so results reflect independent attempts, not shared contention.\n')

  const results = []
  // Same month (July 2026, "now"), queried three times in a row -- tests whether repeat
  // queries for the identical range get any faster (caching) or stay random (no caching).
  results.push(await timedRequest('Jul 2026 (repeat 1)', '2026-07-01', '2026-07-31', 70000))
  results.push(await timedRequest('Jul 2026 (repeat 2)', '2026-07-01', '2026-07-31', 70000))
  results.push(await timedRequest('Jul 2026 (repeat 3)', '2026-07-01', '2026-07-31', 70000))

  // Different recent months, going backwards -- tests whether it's about total data volume
  // in the requested window.
  results.push(await timedRequest('Jun 2026', '2026-06-01', '2026-06-30', 70000))
  results.push(await timedRequest('Jan 2026', '2026-01-01', '2026-01-31', 70000))
  results.push(await timedRequest('Jul 2025 (1yr back)', '2025-07-01', '2025-07-31', 70000))

  // A very old, likely near-empty month -- if the query scans the WHOLE historical table
  // regardless of the requested range, this should be just as slow as July 2026 despite
  // returning near-zero data. If it's fast, the query probably is properly date-filtered/
  // indexed and slowness is about data volume or transient load instead.
  results.push(await timedRequest('Jan 2010 (likely near-empty)', '2010-01-01', '2010-01-31', 70000))

  console.log('\n=== summary ===')
  results.forEach(r => console.log(`${r.label}: ${r.ms}ms, status=${r.status}, total=${r.total}`))
}

main().catch(err => { console.error(err); process.exit(1) })
