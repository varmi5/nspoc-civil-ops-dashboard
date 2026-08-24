const config = require('./config')
const tokenCache = require('./token-cache')
const { withCache } = require('./response-cache')

// Some MSH endpoints (e.g. /v1/stats/monthly/conjunction-events, non-aggregated, no
// longer used here, see conjunction-events-aggregated) can 504 slowly rather than fail
// fast. Bound it so one slow endpoint can't stall the page instead of falling back to
// fixture data.
const REQUEST_TIMEOUT_MS = 4000

async function requestOnce (path, options, timeoutMs) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
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

async function requestAndParse (path, options, timeoutMs) {
  let response = await requestOnce(path, options, timeoutMs)

  if (response.status === 401) {
    tokenCache.clearToken()
    response = await requestOnce(path, options, timeoutMs)
  }

  if (!response.ok) {
    const err = new Error(`MSH API request to ${path} failed with status ${response.status}`)
    err.httpStatus = response.status
    throw err
  }

  return response.json()
}

// Cached for a short TTL (see response-cache.js). This is a reporting dashboard, not a
// real-time feed, so a few minutes' staleness is fine in exchange for not hammering MSH.
//
// timeoutMs defaults to REQUEST_TIMEOUT_MS but can be overridden per call.
// /v1/reentry-events/?epoch=all&limit=2000 alone takes ~1.6-1.9s uncontended (~2.5MB
// response), close enough to the 4s default that it's first to tip over under load.
// Give large-response callers a longer timeoutMs rather than lowering everyone else's.
async function mshRequest (path, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  if (!config.useLiveMsh) {
    throw new Error('mshRequest called while USE_LIVE_MSH is not "true", use getSectionData() with a fixture fallback instead')
  }

  return withCache(path, () => requestAndParse(path, options, timeoutMs))
}

module.exports = { mshRequest }
