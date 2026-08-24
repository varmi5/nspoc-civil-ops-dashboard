// Some MSH endpoints respond slowly enough to hit our request timeout on every call
// (e.g. /v1/stats/monthly/conjunction-events with a date range). A plain TTL cache still
// pays that full timeout cost on the first request after every expiry, measured at
// ~4.4s cold vs ~0.3s warm on this endpoint.
//
// Instead this serves stale-but-real data immediately once a key has succeeded once, and
// refreshes it in the background. A user only ever waits out a slow endpoint on the very
// first request for a key (e.g. a brand new reporting month), never after. Standard
// stale-while-revalidate.
const STALE_AFTER_MS = 5 * 60 * 1000 // age at which a background refresh is triggered
const FAILURE_RETRY_MS = 30 * 1000 // how soon to retry a key that has NEVER succeeded

const cache = new Map()
const refreshesInFlight = new Set()
// Coalesces concurrent cold-miss requests for the same key into one shared promise.
// Without this, two callers racing on a brand new key (e.g. buildReEntryViewModel and
// buildReEntryMapViewModel both wanting /v1/satellites/with-metadata at once) would each
// fire their own duplicate live request, doubling load and making it more likely a
// request tips over the 4s abort timeout under concurrent page loads.
const coldFetchesInFlight = new Map()

function refreshInBackground (key, fn) {
  if (refreshesInFlight.has(key)) return
  refreshesInFlight.add(key)
  fn()
    .then((data) => cache.set(key, { data, timestamp: Date.now() }))
    .catch((err) => {
      // Keep the previous cached value on a failed background refresh. Stale-but-real
      // data beats none, and the next refresh will try again once it's stale again.
      console.error(`Background refresh failed for ${key}, keeping previous cached value: ${err.message}`)
    })
    .finally(() => refreshesInFlight.delete(key))
}

async function withCache (key, fn) {
  const entry = cache.get(key)
  const now = Date.now()

  if (entry && 'data' in entry) {
    if (now - entry.timestamp >= STALE_AFTER_MS) {
      refreshInBackground(key, fn) // fire-and-forget, caller still gets the stale value now
    }
    return entry.data
  }

  if (entry && entry.error && now - entry.timestamp < FAILURE_RETRY_MS) {
    throw entry.error
  }

  if (coldFetchesInFlight.has(key)) {
    return coldFetchesInFlight.get(key)
  }

  const promise = fn()
    .then((data) => {
      cache.set(key, { data, timestamp: Date.now() })
      return data
    })
    .catch((err) => {
      cache.set(key, { error: err, timestamp: Date.now() })
      throw err
    })
    .finally(() => coldFetchesInFlight.delete(key))

  coldFetchesInFlight.set(key, promise)
  return promise
}

module.exports = { withCache }
