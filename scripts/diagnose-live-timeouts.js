// One-off dev tool: the dev server just logged "MSH live fetch failed ... This operation
// was aborted" for re-entry, collision-fragmentation, AND launches, sections this fix
// didn't touch, so it's not specific to the re-entry change. Uses the REAL production
// client (app/lib/msh/client.js, same fixed 4s abort) against every endpoint those three
// sections call, individually and then all together (mirroring the real concurrent
// fan-out each page actually issues), to see whether MSH itself is currently slow/
// degraded or whether concurrency is the trigger.
//
// Run with: node --env-file=.env scripts/diagnose-live-timeouts.js

const { mshRequest } = require('../app/lib/msh/client')
const { fetchEventsForAnalysis } = require('../app/lib/msh/conjunction-analysis')

async function timed (label, fn) {
  const t0 = Date.now()
  try {
    await fn()
    console.log(`  OK   ${label} -> ${Date.now() - t0}ms`)
  } catch (err) {
    console.log(`  FAIL ${label} -> ${Date.now() - t0}ms (${err.message})`)
  }
}

async function main () {
  const startDate = '2025-08-01'
  const endDate = '2026-07-31'

  console.log('=== 1. Each endpoint individually, one at a time (no contention) ===')
  await timed('collision-fragmentation: conjunction list', () => mshRequest('/v1/conjunction-events/?limit=100&sort_by=tca_time&sort_order=desc'))
  await timed('collision-fragmentation: fragmentation list', () => mshRequest('/v1/fragmentation-events/?epoch=all&limit=100&sort_by=event_epoch&sort_order=desc'))
  await timed('collision-fragmentation: conjunction trend (aggregated)', () => mshRequest(`/v1/stats/monthly/conjunction-events-aggregated?start_date=${startDate}&end_date=${endDate}`))
  await timed('collision-fragmentation: fragmentation trend', () => mshRequest(`/v1/stats/monthly/fragmentation-events?start_date=${startDate}&end_date=${endDate}`))
  await timed('collision-fragmentation: fragmentation by type', () => mshRequest('/v1/stats/fragmentation-events/by-fragmentation-type'))
  await timed('collision-fragmentation: events-for-analysis', () => fetchEventsForAnalysis())
  await timed('launches: objects-launched (this month)', () => mshRequest(`/v1/stats/monthly/objects-launched?start_date=${startDate}&end_date=${endDate}`))
  await timed('re-entry: full list (epoch=all, limit=2000)', () => mshRequest('/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=2000'))
  await timed('re-entry: satellite catalog bulk', () => mshRequest('/v1/satellites/with-metadata?limit=1000'))

  console.log('\n=== 2. All 6 collision-fragmentation calls fired concurrently (as buildCollisionFragmentationViewModel actually does via Promise.all) ===')
  const t0 = Date.now()
  const results = await Promise.allSettled([
    mshRequest('/v1/conjunction-events/?limit=100&sort_by=tca_time&sort_order=desc'),
    mshRequest('/v1/fragmentation-events/?epoch=all&limit=100&sort_by=event_epoch&sort_order=desc'),
    mshRequest(`/v1/stats/monthly/conjunction-events-aggregated?start_date=${startDate}&end_date=${endDate}`),
    mshRequest(`/v1/stats/monthly/fragmentation-events?start_date=${startDate}&end_date=${endDate}`),
    mshRequest('/v1/stats/fragmentation-events/by-fragmentation-type'),
    fetchEventsForAnalysis()
  ])
  console.log(`  Wall time: ${Date.now() - t0}ms`)
  results.forEach((r, i) => console.log(`  [${i}] ${r.status}${r.status === 'rejected' ? ' - ' + r.reason.message : ''}`))
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
