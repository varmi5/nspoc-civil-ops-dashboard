// FIRST DRAFT, NOT SIGNED OFF — see space-weather/index.html's explainer for the
// user-facing version of this caveat. NSpOC's own MOSWOC-derived sector table (the
// screenshot Krish supplied) shows the OUTPUT of this kind of mapping, but not the rules
// behind it, and Session 1 with Krish (per the meeting-prep script) explicitly raised
// "is this threshold fixed or judgement-based?" as an open question. Until that's
// answered, this file encodes a defensible-but-unvalidated mapping built from NOAA's own
// published "Potential Impacts" text per scale level (confirmed live in
// scripts/investigate-noaa-alerts-shape.js — e.g. G-scale messages cite power-grid induced
// currents and satellite drag; R-scale cites HF radio blackout). Do not treat any output
// of this file as NSpOC-approved without validating it against real historical reports.
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

// NOAA's own scale text draws the line between "Minor/Moderate" (1-2) and "Strong or
// worse" (3-5) as where impacts stop being cosmetic (aurora, weak fluctuations) and start
// affecting operations (grid alarms, wide-area HF blackout) — used here as the Yellow/Red
// cutoff pending a real NSpOC-defined threshold.
function tierFromScaleLevel (level) {
  if (!level) return null
  return level <= 2 ? 'Yellow' : 'Red'
}

// Only lists sectors an alert type plausibly affects — omitted sectors get no contribution
// from that alert (they stay whatever the day's other alerts leave them at).
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
  // Neither of these ever carries a NOAA Scale number (confirmed live), but NOAA's own
  // alert threshold for each (>1,000 pfu 2MeV electron flux; a detected geomagnetic sudden
  // impulse) is itself a notable, named hazard for the sector it affects — a flat Yellow
  // rather than a scale-derived tier.
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

// alertsOnDay: parsed alerts (see parse-alert.js) that share a calendar day. Local
// Resilience isn't driven by its own rule — it's the worst status across every other
// sector, matching a civil-contingency coordinator's actual concern ("is anything
// significant happening today"), not a distinct hazard of its own.
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
