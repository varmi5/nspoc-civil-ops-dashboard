// Confirmed via the reentry/conjunction/fragmentation report schemas: the real Risk enum
// has six values, not three. "Pending" isn't a severity level — it means "not yet
// assessed" — so it's filtered out below and treated the same as null/missing.
const RISK_RANK = { none: 0, 'very low': 1, low: 2, medium: 3, high: 4, critical: 5 }

// Picks the worst of several risk fields (atmospheric/human-casualty/fragments risk are
// separate fields on a reentry event). Real MSH data leaves these null until an analyst
// has closed out the event — that's a genuine "Pending analysis" state, not a bug.
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

module.exports = { highestRisk }
