const RISK_RANK = { low: 1, medium: 2, high: 3, critical: 4 }

// Picks the worst of several risk fields (atmospheric/human-casualty/fragments risk are
// separate fields on a reentry event). Real MSH data leaves these null until an analyst
// has closed out the event — that's a genuine "Pending analysis" state, not a bug.
function highestRisk (...values) {
  const present = values
    .filter((value) => value !== null && value !== undefined && value !== '')
    .map((value) => String(value).trim())

  if (present.length === 0) {
    return null
  }

  return present.reduce((worst, current) => {
    const worstRank = RISK_RANK[worst.toLowerCase()] || 0
    const currentRank = RISK_RANK[current.toLowerCase()] || 0
    return currentRank > worstRank ? current : worst
  })
}

module.exports = { highestRisk }
