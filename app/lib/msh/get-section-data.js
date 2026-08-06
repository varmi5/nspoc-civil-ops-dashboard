const dataSource = require('./data-source')
const { STATUS } = require('./status')

// Every view-model calls this instead of the MSH client directly. It tries a live fetch
// when the section is configured for it, and reports a status reflecting what actually
// happened on this request — never a stale fixture number a user could mistake for a
// real one. status is one of:
//   'live'          — the live fetch succeeded, data is real
//   'unavailable'   — the section is configured for live but this request's fetch failed
//   'not-connected' — the section isn't configured for live at all (liveCapable is false,
//                     or the relevant USE_LIVE_* flag is off)
async function getSectionData (sectionKey, { liveFetcher }) {
  if (!dataSource.isConfiguredForLive(sectionKey)) {
    return { data: null, status: STATUS.NOT_CONNECTED }
  }

  try {
    const data = await liveFetcher()
    return { data, status: STATUS.LIVE }
  } catch (err) {
    console.error(`MSH live fetch failed for section "${sectionKey}": ${err.message}`)
    // Surfaced so callers that need to tell "MSH doesn't have this record" (404) apart
    // from "MSH itself is unreachable right now" can — see buildReEntryObjectViewModel.
    return { data: null, status: STATUS.UNAVAILABLE, httpStatus: err.httpStatus }
  }
}

module.exports = { getSectionData }
