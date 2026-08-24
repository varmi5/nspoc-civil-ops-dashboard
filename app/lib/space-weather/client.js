const config = require('./config')

// No auth needed, public API, typically responds in ~130ms. Same fixed-timeout-and-throw
// contract as app/lib/msh/client.js so the live/fixture fallback behaves the same way.
const REQUEST_TIMEOUT_MS = 4000

async function fetchAlerts () {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(new URL('/products/alerts.json', config.apiBaseUrl), { signal: controller.signal })
    if (!response.ok) {
      throw new Error(`NOAA SWPC alerts request failed with status ${response.status}`)
    }
    return response.json()
  } finally {
    clearTimeout(timeout)
  }
}

module.exports = { fetchAlerts }
