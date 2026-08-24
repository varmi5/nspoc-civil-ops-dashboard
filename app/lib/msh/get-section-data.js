const dataSource = require('./data-source')
const { STATUS } = require('./status')

// Every view-model calls this instead of the MSH client directly, so the status always
// reflects what happened on this request rather than a stale fixture. status is one of:
//   'live'          - the live fetch succeeded, data is real
//   'unavailable'   - configured for live but this request's fetch failed
//   'not-connected' - not configured for live (liveCapable false, or USE_LIVE_* off)
async function getSectionData (sectionKey, { liveFetcher }) {
  if (!dataSource.isConfiguredForLive(sectionKey)) {
    return { data: null, status: STATUS.NOT_CONNECTED }
  }

  try {
    const data = await liveFetcher()
    return { data, status: STATUS.LIVE }
  } catch (err) {
    console.error(`MSH live fetch failed for section "${sectionKey}": ${err.message}`)
    // Surfaced so callers can tell "MSH doesn't have this record" (404) apart from "MSH
    // is unreachable" (see buildReEntryObjectViewModel).
    return { data: null, status: STATUS.UNAVAILABLE, httpStatus: err.httpStatus }
  }
}

module.exports = { getSectionData }
