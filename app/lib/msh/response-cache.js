// Some MSH endpoints have been observed responding slowly enough to hit our request
// timeout on every call (e.g. /v1/stats/monthly/conjunction-events with a date range).
// Without a cache, every page load pays that cost again. This caches both successes and
// failures for a short TTL, keyed by the exact request path — a failing endpoint gets
// retried once the TTL expires (in case it recovers), not on every single request.
const CACHE_TTL_MS = 5 * 60 * 1000

const cache = new Map()

async function withCache (key, fn) {
  const entry = cache.get(key)
  const now = Date.now()

  if (entry && now - entry.timestamp < CACHE_TTL_MS) {
    if (entry.error) throw entry.error
    return entry.data
  }

  try {
    const data = await fn()
    cache.set(key, { data, timestamp: now })
    return data
  } catch (err) {
    cache.set(key, { error: err, timestamp: now })
    throw err
  }
}

module.exports = { withCache }
