const { mshRequest } = require('./client')

// The general list is mostly routine wide-misses with a null collision_probability, not
// useful for a table. /for-analysis is narrower: events past a probability threshold that
// need analyst attention, with real probabilities and object details already inlined.
const ANALYSIS_THRESHOLD = 0.001

// This endpoint returns one row per CDM revision, not one per unique event. The same
// short_id can appear repeatedly as Space-Track refines its estimate (seen one object
// 5 times with 5 different cdm_external_id values). Keep only the highest (most recent)
// CDM per short_id, or "5 events requiring analysis" would really mean "1 event, refined
// 5 times." Shared by the Collision & Fragmentation table and Monthly Overview tile so
// the count can't drift between the two.
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
