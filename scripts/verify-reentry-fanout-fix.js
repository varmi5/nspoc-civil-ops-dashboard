// One-off dev tool: verifies the re-entry.js fan-out fix (fetchSatelliteCatalogMap
// replacing per-object /v1/satellites/{id} calls) actually reduces the call count and
// timing for a real /re-entry page load, not just in theory.
//
// Run with: node --env-file=.env scripts/verify-reentry-fanout-fix.js

const originalFetch = global.fetch
let callCount = 0
const callsByPrefix = {}

global.fetch = function (url, options) {
  callCount++
  const path = String(url).replace(/^https?:\/\/[^/]+/, '').split('?')[0]
  const prefix = path.replace(/\/\d+$/, '/{id}')
  callsByPrefix[prefix] = (callsByPrefix[prefix] || 0) + 1
  return originalFetch(url, options)
}

const { buildReEntryViewModel, buildReEntryMapViewModel } = require('../app/lib/view-models/re-entry')

async function main () {
  console.log('=== /re-entry (buildReEntryViewModel) ===')
  callCount = 0
  for (const key of Object.keys(callsByPrefix)) delete callsByPrefix[key]
  const t0 = Date.now()
  const viewModel = await buildReEntryViewModel(12)
  const ms = Date.now() - t0
  console.log(`isLive: ${viewModel.isLive}, objects returned: ${viewModel.rows.length}`)
  console.log(`Total time: ${ms}ms, total MSH calls: ${callCount}`)
  console.log('Calls by endpoint:', JSON.stringify(callsByPrefix, null, 2))

  console.log('\n=== /re-entry/map (buildReEntryMapViewModel), same cache, should be near-free ===')
  callCount = 0
  for (const key of Object.keys(callsByPrefix)) delete callsByPrefix[key]
  const t1 = Date.now()
  const mapViewModel = await buildReEntryMapViewModel()
  const ms2 = Date.now() - t1
  console.log(`isLive: ${mapViewModel.isLive}, plotted: ${mapViewModel.plottedCount}/${mapViewModel.totalCount}`)
  console.log(`Total time: ${ms2}ms, total MSH calls: ${callCount}`)
  console.log('Calls by endpoint:', JSON.stringify(callsByPrefix, null, 2))
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
