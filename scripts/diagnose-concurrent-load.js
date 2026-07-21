// Follow-up to diagnose-live-timeouts.js: every endpoint is fast in isolation, so the
// "This operation was aborted" errors seen in the dev server must be a CONCURRENCY effect
// — e.g. a user clicking through several pages during a cold nodemon restart fires every
// section's full fan-out at once (monthly-overview ~13 calls, re-entry ~61, collision-
// fragmentation 6, launches 1 = ~80 simultaneous connections). Reproduces that combined
// load in one process to see whether MSH/the network actually degrades under it.
//
// Run with: node --env-file=.env scripts/diagnose-concurrent-load.js

const { mshRequest } = require('../app/lib/msh/client')
const { fetchEventsForAnalysis } = require('../app/lib/msh/conjunction-analysis')

async function main () {
  const startDate = '2025-08-01'
  const endDate = '2026-07-31'

  console.log('Fetching real norad_ids for the re-entry fan-out...')
  const list = await mshRequest('/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=60')
  const noradIds = list.map((e) => e.norad_id)

  const calls = [
    // monthly-overview-style (~13)
    ...['2026-06', '2026-05', '2026-04', '2026-03'].map((m) => () => mshRequest(`/v1/stats/monthly/reentry-events?start_date=${m}-01&end_date=${m}-28`)),
    () => mshRequest('/v1/conjunction-events/stats?epoch=future'),
    () => mshRequest(`/v1/stats/monthly/conjunction-events-aggregated?start_date=${startDate}&end_date=${endDate}`),
    () => mshRequest('/v1/conjunction-events/?limit=100&sort_by=tca_time&sort_order=desc'),
    () => mshRequest(`/v1/stats/monthly/fragmentation-events?start_date=${startDate}&end_date=${endDate}`),
    () => mshRequest(`/v1/stats/monthly/objects-launched?start_date=${startDate}&end_date=${endDate}`),
    // collision-fragmentation-style (~6)
    () => mshRequest('/v1/fragmentation-events/?epoch=all&limit=100&sort_by=event_epoch&sort_order=desc'),
    () => mshRequest('/v1/stats/fragmentation-events/by-fragmentation-type'),
    () => fetchEventsForAnalysis(),
    // re-entry-style (~61: 60 tips + 1 bulk catalog)
    ...noradIds.map((id) => () => mshRequest(`/v1/tips/${id}`)),
    () => mshRequest('/v1/satellites/with-metadata?limit=1000')
  ]

  console.log(`\nFiring ${calls.length} concurrent requests (simulating monthly-overview + re-entry + collision-fragmentation + launches all loading at once)...`)
  const t0 = Date.now()
  const results = await Promise.allSettled(calls.map((fn) => fn()))
  console.log(`Wall time: ${Date.now() - t0}ms`)
  const failed = results.filter((r) => r.status === 'rejected')
  console.log(`Succeeded: ${results.length - failed.length}/${results.length}, Failed: ${failed.length}`)
  failed.forEach((r) => console.log(`  FAILED: ${r.reason.message}`))
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
