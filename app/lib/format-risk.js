// Risk enum has six values, not three. "Pending" isn't a severity level, it means "not
// yet assessed", so it's filtered out below and treated the same as null/missing.
const RISK_RANK = { none: 0, 'very low': 1, low: 2, medium: 3, high: 4, critical: 5 }

// Picks the worst of several risk fields (atmospheric/human-casualty/fragments risk are
// separate fields on a reentry event). MSH leaves these null until an analyst closes out
// the event, a genuine "Pending analysis" state, not a bug.
function highestRisk (...values) {
  const present = values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value).trim())
    .filter((value) => value.toLowerCase() !== 'pending')

  if (present.length === 0) {
    return null
  }

  return present.reduce((worst, current) => {
    const worstRank = RISK_RANK[worst.toLowerCase()] ?? -1
    const currentRank = RISK_RANK[current.toLowerCase()] ?? -1
    return currentRank > worstRank ? current : worst
  })
}

// Worst of atmospheric/fragments risk on a reentry event. Human casualty risk is
// excluded (confirmed with NSpOC, not actually checked). MSH's TIP records carry no risk
// fields at all (confirmed against MSH's own TIPOut schema and a live fetch), only the
// event itself ever holds a risk value, and there's no history/revision endpoint to see
// what it used to be. So this reads the event's current fields, there's nothing else to
// read.
function reentryRisk (event) {
  return highestRisk(event.atmospheric_risk, event.fragments_risk)
}

// Whether a single risk-like value is a real assessed risk, not null/none/pending.
function isRealRiskValue (value) {
  if (value === null || value === undefined || value === '') return false
  const normalised = String(value).trim().toLowerCase()
  return normalised !== 'none' && normalised !== 'pending'
}

// Whether a value is a genuinely elevated rating, "Very low" and up. Excludes "None"
// as well as null/pending, unlike isRealRiskValue above (which treats "None" as real,
// just zero severity).
function isElevatedRisk (value) {
  return isRealRiskValue(value) && String(value).trim().toLowerCase() !== 'none'
}

// Whether an event already shows a real risk on its current record: atmospheric,
// fragments, or MSH's own uk_reentry_probability (MSH's "Risk to the UK" figure, an
// overflight-based probability independent of where the object actually lands). Checked
// straight off the raw reentry-event record, no TIP fetch needed, so it can guarantee a
// risk-flagged event survives a display cap before enrichment even runs.
function hasKnownRisk (event) {
  return [event.atmospheric_risk, event.fragments_risk, event.uk_reentry_probability].some(isRealRiskValue)
}

module.exports = { highestRisk, reentryRisk, hasKnownRisk, isElevatedRisk }
