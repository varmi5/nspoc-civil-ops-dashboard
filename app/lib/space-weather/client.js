const config = require('./config')

// No auth needed (public API) — confirmed live (scripts/investigate-noaa-alerts-shape.js):
// 200 in ~130ms for the full current alert set. Same fixed-timeout-and-throw contract as
// app/lib/msh/client.js so the view-model's live/fixture fallback works the same way.
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
