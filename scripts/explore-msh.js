// One-off dev tool: authenticates against the live MSH API and prints the shape (status +
// top-level keys + first item's keys) of a handful of key endpoints, so fixtures and
// view-models can be built against real field names instead of guesswork.
//
// Run with: node --env-file=.env scripts/explore-msh.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

const ENDPOINTS = [
  '/v1/stats/',
  '/v1/reentry-events/',
  '/v1/reentry-events/stats',
  '/v1/tips/latest',
  '/v1/conjunction-events/',
  '/v1/conjunction-events/stats',
  '/v1/fragmentation-events/',
  '/v1/fragmentation-events/latest',
  '/v1/satellites/with-metadata',
  '/v1/satellites/by-organizations',
  '/v1/stats/objects-tracked',
  '/v1/stats/monthly/objects-launched',
  '/v1/stats/monthly/reentry-events',
  '/v1/stats/monthly/reentry-events-by-object-type',
  '/v1/stats/monthly/conjunction-events',
  '/v1/stats/monthly/conjunction-events-by-object-type',
  '/v1/stats/monthly/fragmentation-events',
  '/v1/stats/fragmentation-events/by-fragmentation-type',
  '/v1/stats/events-by-organization',
  '/v1/stats/highest-collision-probability'
]

function summarise (body) {
  if (Array.isArray(body)) {
    return {
      shape: 'array',
      length: body.length,
      firstItemKeys: body[0] ? Object.keys(body[0]) : null
    }
  }
  if (body && typeof body === 'object') {
    const keys = Object.keys(body)
    const arrayKey = keys.find((k) => Array.isArray(body[k]))
    return {
      shape: 'object',
      topLevelKeys: keys,
      ...(arrayKey
        ? {
            arrayField: arrayKey,
            arrayLength: body[arrayKey].length,
            firstItemKeys: body[arrayKey][0] ? Object.keys(body[arrayKey][0]) : null
          }
        : {})
    }
  }
  return { shape: typeof body, value: body }
}

async function main () {
  if (!config.clientId || !config.clientSecret) {
    console.error('MSH_CLIENT_ID / MSH_CLIENT_SECRET are not set in .env — fill them in before running this script.')
    process.exitCode = 1
    return
  }

  console.log(`Checking health-check at ${config.apiBaseUrl}/ ...`)
  const health = await fetch(config.apiBaseUrl + '/')
  console.log(`  status ${health.status}`)

  console.log('Authenticating...')
  const token = await tokenCache.getAccessToken()
  console.log(`  got access token (length ${token.length})`)

  async function get (path) {
    const url = new URL(path, config.apiBaseUrl)
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    console.log(`\n${path} -> ${response.status}`)
    if (!response.ok) {
      console.log(await response.text())
      return null
    }
    const body = await response.json()
    console.log(JSON.stringify(summarise(body), null, 2))
    return body
  }

  for (const path of ENDPOINTS) {
    try {
      await get(path)
    } catch (err) {
      console.log(`\n${path} -> ERROR ${err.message}`)
    }
  }

  const reentryList = await get('/v1/reentry-events/')
  const firstReentry = Array.isArray(reentryList) && reentryList[0]
  if (firstReentry) {
    console.log(`\nChaining off first reentry event: norad_id=${firstReentry.norad_id} short_id=${firstReentry.short_id}`)
    await get(`/v1/tips/${firstReentry.norad_id}`)
    await get(`/v1/reentry-events/by-norad-id/${firstReentry.norad_id}`)
    await get(`/v1/reentry-events/${firstReentry.short_id}`)
  }
}

main()
