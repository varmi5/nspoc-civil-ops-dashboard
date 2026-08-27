// One-off dev tool: builds the space-weather view-model against BOTH the fixture (a
// converted real June 2026 CSV) and the live NOAA feed, and prints only the days that
// have at least one alert, the quickest way to sanity-check the parser + sector-rules
// mapping against real data before trusting the page.
//
// Run with: node --env-file=.env scripts/verify-space-weather.js

const { buildSpaceWeatherViewModel } = require('../app/lib/view-models/space-weather')

function printNonGreenDays (viewModel, label) {
  console.log(`\n=== ${label}: isLive=${viewModel.isLive}, totalAlerts=${viewModel.totalAlerts}, daysWithAlerts=${viewModel.daysWithAlerts}, yellow=${viewModel.yellowRatingCount}, red=${viewModel.redRatingCount} ===`)
  const interesting = viewModel.rows.filter((row) => row.alertCount > 0)
  for (const row of interesting) {
    const statusSummary = row.sectors.filter((s) => s.status !== 'Green').map((s) => `${s.label}=${s.status}`).join(', ')
    console.log(`${row.date} (${row.alertCount} alert${row.alertCount === 1 ? '' : 's'}) -> ${statusSummary || 'all Green'}`)
  }
}

async function main () {
  console.log('Fixture run (USE_LIVE_SPACE_WEATHER should still try live first unless forced off). Forcing fixture via month with no live alerts is not how this works, so this call still hits live NOAA. Testing fixture path directly via env override instead.')

  const fixtureViewModel = await (async () => {
    process.env.USE_LIVE_SPACE_WEATHER = 'false'
    delete require.cache[require.resolve('../app/lib/space-weather/config')]
    delete require.cache[require.resolve('../app/lib/view-models/space-weather')]
    const { buildSpaceWeatherViewModel: build } = require('../app/lib/view-models/space-weather')
    return build('2026-06')
  })()
  printNonGreenDays(fixtureViewModel, 'FIXTURE (Krish\'s real June 2026 CSV)')

  process.env.USE_LIVE_SPACE_WEATHER = 'true'
  delete require.cache[require.resolve('../app/lib/space-weather/config')]
  delete require.cache[require.resolve('../app/lib/view-models/space-weather')]
  const { buildSpaceWeatherViewModel: buildLive } = require('../app/lib/view-models/space-weather')
  const liveViewModel = await buildLive()
  printNonGreenDays(liveViewModel, 'LIVE (current month, real NOAA feed)')
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
