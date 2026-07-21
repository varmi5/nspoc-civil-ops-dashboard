// Follow-up to investigate-tips-satellites-batch.js: /v1/tips/latest and
// /v1/satellites/with-metadata both looked like bulk candidates to replace re-entry.js's
// per-norad_id fan-out. Need to confirm: (1) does /v1/tips/latest actually cover the
// tracked-object population (one row per object) or is it something narrower, (2) how many
// pages of with-metadata does the full catalog need, (3) does with-metadata support a
// higher limit than the default 100 so the whole catalog could be fetched in fewer calls.
//
// Run with: node --env-file=.env scripts/investigate-tips-latest-and-catalog-size.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()

  async function get (path) {
    const url = new URL(path, config.apiBaseUrl)
    const t0 = Date.now()
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    const ms = Date.now() - t0
    if (!response.ok) {
      console.log(`${path} -> ${response.status} (${ms}ms)`)
      return null
    }
    const body = await response.json()
    console.log(`${path} -> ${response.status} (${ms}ms)`)
    return body
  }

  console.log('=== 1. /v1/tips/latest shape ===')
  const latestTips = await get('/v1/tips/latest')
  if (Array.isArray(latestTips)) {
    console.log(`array of ${latestTips.length}`)
    console.log('sample:', JSON.stringify(latestTips[0], null, 2))
    const uniqueNoradIds = new Set(latestTips.map((t) => t.norad_id))
    console.log(`unique norad_ids in response: ${uniqueNoradIds.size}`)
  } else {
    console.log('not an array:', JSON.stringify(latestTips, null, 2)?.slice(0, 500))
  }

  console.log('\n=== 1b. Does a specific tracked norad_id appear in /v1/tips/latest? (cross-check against /v1/tips/{norad_id}) ===')
  const reentryList = await get('/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=5')
  if (Array.isArray(reentryList)) {
    for (const event of reentryList) {
      const inLatest = Array.isArray(latestTips) && latestTips.some((t) => String(t.norad_id) === String(event.norad_id))
      console.log(`norad_id ${event.norad_id} (${event.object_name}) present in /v1/tips/latest: ${inLatest}`)
    }
  }

  console.log('\n=== 2. /v1/satellites/with-metadata pagination: try a large limit ===')
  const bigPage = await get('/v1/satellites/with-metadata?limit=1000&offset=0')
  if (Array.isArray(bigPage)) {
    console.log(`limit=1000 returned ${bigPage.length} records`)
  }
  const defaultPage = await get('/v1/satellites/with-metadata?offset=0')
  if (Array.isArray(defaultPage)) {
    console.log(`no-limit-param returned ${defaultPage.length} records (default page size)`)
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
