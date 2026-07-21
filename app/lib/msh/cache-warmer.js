const config = require('./config')

// Confirmed live (scripts/diagnose-concurrent-load.js): every individual MSH endpoint used
// in production is fast (under 1.5s), but a cold nodemon restart means every section's full
// fan-out is cold at once — a developer clicking through Monthly Overview, Re-Entry, and
// Collision & Fragmentation within a few seconds of a restart fires ~73 concurrent MSH
// calls competing for the same connection budget, measured at 3.57s wall time, close enough
// to the fixed 4s abort timeout that some individual calls do tip over it and fall back to
// fixture data (the "This operation was aborted" log lines this exists to prevent).
//
// Fire the same view-model builders each route already calls, once, as soon as the server
// boots — not per-request, and not a mechanism to mask a slow endpoint (see CLAUDE.md's
// warning about reintroducing background-fetch workarounds for that). This just moves who
// pays the first cold-fetch cost from "whichever visitor happens to load first" to the
// server process itself, before any real request arrives, so response-cache.js's
// stale-while-revalidate cache is already warm by the time anyone navigates.
function warmCache () {
  if (!config.useLiveMsh) return

  const { buildMonthlyOverviewViewModel } = require('../view-models/monthly-overview')
  const { buildReEntryViewModel, buildReEntryMapViewModel } = require('../view-models/re-entry')
  const { buildCollisionFragmentationViewModel } = require('../view-models/collision-fragmentation')

  // No per-section liveCapable filtering here: each view-model already makes that call
  // per-tile via getSectionData's own isConfiguredForLive check (this matters for
  // buildMonthlyOverviewViewModel specifically — sections.js marks the "monthly-overview"
  // key itself liveCapable: false, but its internal tile fetches are keyed "re-entry" and
  // "collision-fragmentation", the real live-capable sections, not its own key).
  const warmers = [
    buildMonthlyOverviewViewModel,
    buildReEntryViewModel,
    buildReEntryMapViewModel,
    buildCollisionFragmentationViewModel
  ]

  const startedAt = Date.now()
  Promise.allSettled(warmers.map((run) => run())).then((results) => {
    const failures = results.filter((r) => r.status === 'rejected')
    console.log(`Cache warm-up finished in ${Date.now() - startedAt}ms (${results.length - failures.length}/${results.length} succeeded)`)
    failures.forEach((r) => console.warn(`Cache warm-up: one section failed to warm (will retry on first real request): ${r.reason.message}`))
  })
}

module.exports = { warmCache }
