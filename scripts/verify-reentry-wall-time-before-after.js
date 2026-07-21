// One-off dev tool: the fix already reduces total call count (123 -> 64), but the more
// direct answer to "was the dashboard actually slow because of this" is wall-clock time.
// Reconstructs the OLD fan-out shape (60 concurrent /v1/tips/{id} + 60 concurrent
// /v1/satellites/{id}, i.e. 120 concurrent connections) against the NEW shape (60
// concurrent /v1/tips/{id} + 1 /v1/satellites/with-metadata) using the same real norad_ids,
// without touching the already-fixed re-entry.js.
//
// Run with: node --env-file=.env scripts/verify-reentry-wall-time-before-after.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()

  async function get (path) {
    const url = new URL(path, config.apiBaseUrl)
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    return response.json()
  }

  console.log('Fetching real tracked-object list to get 60 real norad_ids...')
  const list = await get('/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=60')
  const noradIds = list.map((e) => e.norad_id)
  console.log(`Got ${noradIds.length} norad_ids.\n`)

  console.log('=== OLD shape: 60 concurrent tips calls + 60 concurrent satellite calls (120 total connections) ===')
  const t0 = Date.now()
  await Promise.all([
    ...noradIds.map((id) => get(`/v1/tips/${id}`).catch(() => null)),
    ...noradIds.map((id) => get(`/v1/satellites/${id}`).catch(() => null))
  ])
  console.log(`Wall time: ${Date.now() - t0}ms\n`)

  console.log('=== NEW shape: 60 concurrent tips calls + 1 bulk satellite catalog call (61 total connections) ===')
  const t1 = Date.now()
  await Promise.all([
    ...noradIds.map((id) => get(`/v1/tips/${id}`).catch(() => null)),
    get('/v1/satellites/with-metadata?limit=1000').catch(() => null)
  ])
  console.log(`Wall time: ${Date.now() - t1}ms`)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
