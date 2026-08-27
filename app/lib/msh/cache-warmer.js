const config = require('./config')
const spaceWeatherConfig = require('../space-weather/config')

// A cold nodemon restart leaves every section's data cold at once. Clicking through
// Monthly Overview, Re-Entry, and Collision & Fragmentation within a few seconds of
// restart fires ~73 concurrent MSH calls (measured at 3.57s wall time), close enough to
// the 4s abort timeout that some calls tip over it and fall back to fixture data.
//
// This fires the same view-model builders each route uses, once, at server boot, so
// response-cache.js's stale-while-revalidate cache is already warm before anyone
// navigates. It papers over the cold-start fan-out, not a genuinely slow endpoint, that
// needs fixing at the endpoint or client level instead.
function warmCache () {
  // MSH-backed sections warm under USE_LIVE_MSH. Space weather is a separate, no-auth
  // feed with its own flag, unrelated to MSH being on or off.
  const warmers = []

  if (config.useLiveMsh) {
    const { buildMonthlyOverviewViewModel } = require('../view-models/monthly-overview')
    const { buildReEntryViewModel, buildReEntryMapViewModel } = require('../view-models/re-entry')
    const { buildCollisionFragmentationViewModel } = require('../view-models/collision-fragmentation')
    // buildMonthlyOverviewViewModel is marked liveCapable: false itself, but its internal
    // tile fetches use the "re-entry" and "collision-fragmentation" keys, which are live.
    warmers.push(buildMonthlyOverviewViewModel, buildReEntryViewModel, buildReEntryMapViewModel, buildCollisionFragmentationViewModel)
  }

  if (spaceWeatherConfig.useLiveSpaceWeather) {
    const { buildSpaceWeatherViewModel } = require('../view-models/space-weather')
    warmers.push(buildSpaceWeatherViewModel)
  }

  if (!warmers.length) return

  const startedAt = Date.now()
  Promise.allSettled(warmers.map((run) => run())).then((results) => {
    const failures = results.filter((r) => r.status === 'rejected')
    console.log(`Cache warm-up finished in ${Date.now() - startedAt}ms (${results.length - failures.length}/${results.length} succeeded)`)
    failures.forEach((r) => console.warn(`Cache warm-up: one section failed to warm (will retry on first real request): ${r.reason.message}`))
  })
}

module.exports = { warmCache }
