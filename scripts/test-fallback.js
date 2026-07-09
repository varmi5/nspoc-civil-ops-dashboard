// One-off verification: deliberately breaks the MSH client secret in-process (does not
// touch the running dev server or .env on disk) and confirms buildReEntryViewModel()
// degrades to fixture data + isLive: false instead of throwing.
//
// Run with: node --env-file=.env scripts/test-fallback.js

process.env.MSH_CLIENT_SECRET = 'deliberately-broken-for-fallback-test'

const { buildReEntryViewModel } = require('../app/lib/view-models/re-entry')
const { buildMonthlyOverviewViewModel } = require('../app/lib/view-models/monthly-overview')

async function main () {
  const reEntry = await buildReEntryViewModel()
  console.log('Re-Entry page: isLive =', reEntry.isLive, '| rows =', reEntry.rows.length, '| first row =', JSON.stringify(reEntry.rows[0]))

  const overview = await buildMonthlyOverviewViewModel()
  const liveTiles = overview.tiles.filter((t) => t.isLive).length
  console.log('Monthly Overview: live tiles =', liveTiles, '(expect 0, since auth is broken) | total tiles =', overview.tiles.length)

  if (reEntry.isLive !== false || liveTiles !== 0) {
    console.error('FAIL: expected full fallback to fixtures with a broken secret, but something reported isLive: true')
    process.exitCode = 1
  } else {
    console.log('PASS: fallback to fixture data worked correctly with a broken MSH_CLIENT_SECRET')
  }
}

main().catch((err) => {
  console.error('FAIL: buildReEntryViewModel/buildMonthlyOverviewViewModel threw instead of falling back:', err)
  process.exitCode = 1
})
