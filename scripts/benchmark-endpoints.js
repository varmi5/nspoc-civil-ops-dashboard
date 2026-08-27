// Reusable dev tool: fires each candidate endpoint N times and reports min/median/p95
// latency, so a "does a faster equivalent exist" question can be answered with numbers
// instead of guessing. Follows the same investigate-*.js convention as the rest of
// scripts/, kept as living documentation of real, tested API behaviour.
//
// Run with: node --env-file=.env scripts/benchmark-endpoints.js
//
// To add a new comparison, add an entry to CANDIDATES below: a group name and a list of
// {label, path} variants that return equivalent data. The report ranks them by median
// latency within their group so the fastest option is obvious.

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

const REPEATS = 3

const CANDIDATES = [
  {
    group: 'Monthly conjunction-events (12-month range)',
    variants: [
      { label: 'plain (known slow/504-prone, do not use)', path: '/v1/stats/monthly/conjunction-events?start_date=2025-08-01&end_date=2026-07-31', skip: true },
      { label: 'aggregated (currently used)', path: '/v1/stats/monthly/conjunction-events-aggregated?start_date=2025-08-01&end_date=2026-07-31' }
    ]
  },
  {
    group: 'Satellite catalog for a batch of objects',
    variants: [
      { label: 'bulk with-metadata (currently used, ~834 records)', path: '/v1/satellites/with-metadata?limit=1000' },
      { label: '3x individual /v1/satellites/{id} (for comparison only)', paths: ['/v1/satellites/46565', '/v1/satellites/58919', '/v1/satellites/25544'] }
    ]
  },
  {
    group: 'Reentry event list (full history)',
    variants: [
      { label: 'epoch=all, limit=2000 (currently used)', path: '/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=2000' }
    ]
  }
]

function percentile (sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[idx]
}

async function main () {
  const token = await tokenCache.getAccessToken()

  async function timedGet (path) {
    const url = new URL(path, config.apiBaseUrl)
    const t0 = Date.now()
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    await response.json().catch(() => null)
    return { ms: Date.now() - t0, status: response.status }
  }

  async function benchmarkVariant (variant) {
    if (variant.skip) {
      console.log(`  ${variant.label} -> skipped (documented slow/unsafe, not re-tested every run)`)
      return
    }
    const paths = variant.paths || [variant.path]
    const timings = []
    for (let i = 0; i < REPEATS; i++) {
      let total = 0
      let lastStatus = null
      for (const path of paths) {
        const { ms, status } = await timedGet(path)
        total += ms
        lastStatus = status
      }
      timings.push(total)
      if (lastStatus && lastStatus >= 400) {
        console.log(`  WARNING: ${variant.label} got status ${lastStatus} on run ${i + 1}`)
      }
    }
    const sorted = [...timings].sort((a, b) => a - b)
    console.log(`  ${variant.label} -> min ${sorted[0]}ms, median ${percentile(sorted, 0.5)}ms, p95 ${percentile(sorted, 0.95)}ms (n=${REPEATS})`)
  }

  for (const { group, variants } of CANDIDATES) {
    console.log(`\n=== ${group} ===`)
    for (const variant of variants) {
      await benchmarkVariant(variant)
    }
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
