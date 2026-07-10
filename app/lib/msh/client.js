const config = require('./config')
const tokenCache = require('./token-cache')
const { withCache } = require('./response-cache')

// Some MSH endpoints (observed: /v1/stats/monthly/conjunction-events with a date range)
// can 504 slowly rather than fail fast. Without a bound, a single slow endpoint would
// stall page rendering indefinitely instead of falling back to fixture data promptly.
const REQUEST_TIMEOUT_MS = 4000

async function requestOnce (path, options) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        ...(options && options.headers),
        Authorization: `Bearer ${token}`
      }
    })
  } finally {
    clearTimeout(timeout)
  }
}

async function requestAndParse (path, options) {
  let response = await requestOnce(path, options)

  if (response.status === 401) {
    tokenCache.clearToken()
    response = await requestOnce(path, options)
  }

  if (!response.ok) {
    throw new Error(`MSH API request to ${path} failed with status ${response.status}`)
  }

  return response.json()
}

// Cached for a short TTL (see response-cache.js) — this is a reporting dashboard, not a
// real-time feed, so a few minutes' staleness is an acceptable trade for not re-hitting a
// slow endpoint on every page load, and for not hammering MSH with duplicate requests.
async function mshRequest (path, options = {}) {
  if (!config.useLiveMsh) {
    throw new Error('mshRequest called while USE_LIVE_MSH is not "true" — use getSectionData() with a fixture fallback instead')
  }

  return withCache(path, () => requestAndParse(path, options))
}

module.exports = { mshRequest }
