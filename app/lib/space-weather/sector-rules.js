// First draft, not signed off by NSpOC: see space-weather/index.html's explainer for the
// user-facing version of this caveat. The MOSWOC sector table shows the output of this
// kind of mapping but not the rules behind it, so it's not clear whether the real
// threshold is fixed or judgement-based. This mapping is built from NOAA's own published
// "Potential Impacts" text per scale level (G-scale cites power-grid currents and
// satellite drag, R-scale cites HF radio blackout). Don't treat its output as
// NSpOC-approved without validating against real historical reports.
const SECTORS = ['localResilience', 'energy', 'aviation', 'marine', 'satelliteOperators', 'satelliteComms', 'rail']

const SECTOR_LABELS = {
  localResilience: 'Local Resilience',
  energy: 'Energy',
  aviation: 'Aviation',
  marine: 'Marine',
  satelliteOperators: 'Satellite Operators',
  satelliteComms: 'Satellite Comms',
  rail: 'Rail'
}

// NOAA's scale text splits "Minor/Moderate" (1-2, cosmetic impacts) from "Strong or
// worse" (3-5, affects operations). Used here as the Yellow/Red cutoff pending a real
// NSpOC-defined threshold.
function tierFromScaleLevel (level) {
  if (!level) return null
  return level <= 2 ? 'Yellow' : 'Red'
}

// Only lists sectors an alert type plausibly affects. Omitted sectors get no
// contribution from that alert.
const RULES = {
  xray_radio_blackout_alert: (level) => ({
    aviation: tierFromScaleLevel(level),
    marine: tierFromScaleLevel(level),
    satelliteComms: tierFromScaleLevel(level)
  }),
  kp_alert: (level) => ({
    energy: tierFromScaleLevel(level),
    rail: tierFromScaleLevel(level),
    satelliteOperators: tierFromScaleLevel(level),
    satelliteComms: tierFromScaleLevel(level)
  }),
  proton_flux_alert: (level) => ({
    aviation: tierFromScaleLevel(level),
    satelliteOperators: tierFromScaleLevel(level)
  }),
  // Neither of these carries a NOAA Scale number, but NOAA's own alert threshold for each
  // (>1,000 pfu 2MeV electron flux; a detected geomagnetic sudden impulse) is itself a
  // notable hazard, hence a flat Yellow rather than a scale-derived tier.
  electron_flux_alert: () => ({
    satelliteOperators: 'Yellow'
  }),
  geomagnetic_sudden_impulse_alert: () => ({
    energy: 'Yellow',
    satelliteOperators: 'Yellow'
  })
}

const COLOUR_RANK = { Green: 0, Yellow: 1, Red: 2 }

function worstOf (a, b) {
  if (!a) return b || 'Green'
  if (!b) return a
  return COLOUR_RANK[a] >= COLOUR_RANK[b] ? a : b
}

// alertsOnDay: parsed alerts (see parse-alert.js) sharing a calendar day. Local
// Resilience has no rule of its own, it's just the worst status across every other
// sector.
function sectorStatusesForDay (alertsOnDay) {
  const statuses = {}
  for (const sector of SECTORS) {
    if (sector !== 'localResilience') statuses[sector] = 'Green'
  }

  for (const alert of alertsOnDay) {
    const rule = RULES[alert.type]
    if (!rule) continue
    const contributions = rule(alert.scaleLevel)
    for (const [sector, colour] of Object.entries(contributions)) {
      if (!colour) continue
      statuses[sector] = worstOf(statuses[sector], colour)
    }
  }

  statuses.localResilience = Object.values(statuses).reduce((worst, colour) => worstOf(worst, colour), 'Green')
  return statuses
}

module.exports = { sectorStatusesForDay, SECTORS, SECTOR_LABELS }
