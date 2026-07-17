const { mshRequest } = require('./client')

// The general list is mostly routine wide-misses with a null collision_probability —
// genuinely not very informative for a table. /for-analysis is a different, narrower
// endpoint: events that have crossed a probability threshold and need a human analyst's
// attention, with real computed probabilities and (confirmed live) each object's physical
// details already inlined, no extra per-event lookup needed.
const ANALYSIS_THRESHOLD = 0.001

// Confirmed live: this endpoint returns one row per CDM revision, not one row per unique
// event — the same short_id can appear repeatedly as Space-Track refines its estimate
// (we saw one real object appear 5 times with 5 different cdm_external_id values and
// probabilities). Keep only the highest (most recent) CDM per short_id, or "5 events
// requiring analysis" would actually mean "1 event, refined 5 times." Shared between the
// Collision & Fragmentation detail table and the Monthly Overview summary tile, so this
// counting logic can't drift between the two pages.
function dedupeToLatestCdmPerEvent (events) {
  const latestByShortId = new Map()
  for (const event of events) {
    const existing = latestByShortId.get(event.short_id)
    const cdmId = Number(event.cdm_external_id) || 0
    const existingCdmId = existing ? Number(existing.cdm_external_id) || 0 : -1
    if (!existing || cdmId > existingCdmId) {
      latestByShortId.set(event.short_id, event)
    }
  }
  return Array.from(latestByShortId.values())
}

async function fetchEventsForAnalysis () {
  const events = await mshRequest(`/v1/conjunction-events/for-analysis?threshold=${ANALYSIS_THRESHOLD}&limit=20`)
  return dedupeToLatestCdmPerEvent(events)
}

module.exports = { ANALYSIS_THRESHOLD, dedupeToLatestCdmPerEvent, fetchEventsForAnalysis }
