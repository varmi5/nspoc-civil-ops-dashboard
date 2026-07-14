// Some MSH endpoints have been observed responding slowly enough to hit our request
// timeout on every call (e.g. /v1/stats/monthly/conjunction-events with a date range).
// A plain TTL cache still means the first request after every TTL expiry pays that full
// timeout cost — measured at ~4.4s cold vs ~0.3s warm on this exact endpoint.
//
// This instead serves stale-but-real data immediately once a key has been fetched
// successfully at least once, and refreshes it in the background — a user only ever
// waits out a slow/failing endpoint on the very first request for a given key (e.g. the
// first time anyone asks for a brand new reporting month), never on any request after
// that. This is the standard "stale-while-revalidate" HTTP caching pattern.
const STALE_AFTER_MS = 5 * 60 * 1000 // age at which a background refresh is triggered
const FAILURE_RETRY_MS = 30 * 1000 // how soon to retry a key that has NEVER succeeded

const cache = new Map()
const refreshesInFlight = new Set()

function refreshInBackground (key, fn) {
  if (refreshesInFlight.has(key)) return
  refreshesInFlight.add(key)
  fn()
    .then((data) => cache.set(key, { data, timestamp: Date.now() }))
    .catch((err) => {
      // Deliberately keep the previous cached value on a failed background refresh —
      // stale-but-real data is more useful than none, and the next refresh attempt will
      // try again once this entry is stale again.
      console.error(`Background refresh failed for ${key}, keeping previous cached value: ${err.message}`)
    })
    .finally(() => refreshesInFlight.delete(key))
}

async function withCache (key, fn) {
  const entry = cache.get(key)
  const now = Date.now()

  if (entry && 'data' in entry) {
    if (now - entry.timestamp >= STALE_AFTER_MS) {
      refreshInBackground(key, fn) // fire-and-forget — caller still gets the stale value now
    }
    return entry.data
  }

  if (entry && entry.error && now - entry.timestamp < FAILURE_RETRY_MS) {
    throw entry.error
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
