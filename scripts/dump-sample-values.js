// One-off dev tool: prints full sample records (not just key names) for the fields whose
// *value format* still needs confirming — risk enums, probabilities, survivability —
// before any badge/donut-bucket logic gets written. Free-text "*_comment" fields are
// redacted to [present]/[null] since their content isn't needed here and may be
// OFFICIAL-sensitive narrative.
//
// Run with: node --env-file=.env scripts/dump-sample-values.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

function redactComments (obj) {
  const copy = {}
  for (const [key, value] of Object.entries(obj)) {
    copy[key] = key.endsWith('_comment') ? (value ? '[present]' : '[null]') : value
  }
  return copy
}

async function main () {
  const token = await tokenCache.getAccessToken()

  async function get (path) {
    const url = new URL(path, config.apiBaseUrl)
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!response.ok) {
      console.log(`${path} -> ${response.status}`)
      return null
    }
    return response.json()
  }

  const reentryList = await get('/v1/reentry-events/')
  console.log('\n=== Re-entry events (first 2, comments redacted) ===')
  console.log(JSON.stringify(reentryList.slice(0, 2).map(redactComments), null, 2))

  const firstNoradId = reentryList[0].norad_id
  const tips = await get(`/v1/tips/${firstNoradId}`)
  console.log(`\n=== TIP messages for norad_id ${firstNoradId} (first 2) ===`)
  console.log(JSON.stringify((tips || []).slice(0, 2), null, 2))

  const conjunctionList = await get('/v1/conjunction-events/')
  console.log('\n=== Conjunction events (first 2) ===')
  console.log(JSON.stringify((conjunctionList || []).slice(0, 2), null, 2))

  const fragLatest = await get('/v1/fragmentation-events/latest')
  console.log('\n=== Fragmentation event, latest (comments redacted) ===')
  console.log(JSON.stringify(fragLatest ? redactComments(fragLatest) : null, null, 2))

  const monthlyReentry = await get('/v1/stats/monthly/reentry-events')
  console.log('\n=== Monthly reentry-events, last 3 entries ===')
  console.log(JSON.stringify((monthlyReentry || []).slice(-3), null, 2))
}

main()
