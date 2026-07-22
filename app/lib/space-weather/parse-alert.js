// Classification and scale-extraction confirmed against the REAL live NOAA feed
// (scripts/investigate-noaa-alerts-shape.js, investigate-noaa-scales-endpoint.js), not
// guessed from docs — matches the exact product_id families and message text NOAA
// actually returns today (2026-07-21):
//
//   K04A/K04W..K07A/K07W  ALERT/WARNING, Geomagnetic K-index      -> kp_alert
//                          (K-index below 5 carries NO NOAA Scale line at all — G-scale
//                          only starts being reported once K reaches 5; scaleLevel stays
//                          null for those, which sectorStatusesForDay treats as no impact)
//   XM..A/XM..S/XX..A/XX..S ALERT/SUMMARY, X-ray flux             -> xray_radio_blackout_alert
//   EF3A                   (CONTINUED) ALERT, Electron flux       -> electron_flux_alert
//                          (never carries a NOAA Scale line, confirmed live)
//   SGIW/SGIA               WARNING/ALERT, Geomagnetic Sudden Impulse -> geomagnetic_sudden_impulse_alert
//                          (never carries a NOAA Scale line, confirmed live)
//   P1..W/P1..A             WARNING/ALERT, Proton flux             -> proton_flux_alert
//
// Deliberately excluded (not in Krish's real alert log, and a different kind of product):
// A20F/A30F geomagnetic storm WATCHes (forecasts, not confirmed conditions), TIIA/TIVA
// (Type II/IV radio bursts — solar phenomena, not a NOAA scale category), BHIS (10cm radio
// burst summary, informational only).
const TYPE_RULES = [
  { pattern: /^K\d/i, type: 'kp_alert' },
  { pattern: /^X[MX]\d/i, type: 'xray_radio_blackout_alert' },
  { pattern: /^EF/i, type: 'electron_flux_alert' },
  { pattern: /^SGI/i, type: 'geomagnetic_sudden_impulse_alert' },
  { pattern: /^P\d/i, type: 'proton_flux_alert' }
]

// Confirmed live: the scale line appears as "NOAA Scale: R2 - Moderate" or, inconsistently,
// "Noaa Scale: G1 - Minor" (capitalisation varies by product) — sometimes repeated twice in
// the same message. Case-insensitive, first match wins.
const SCALE_PATTERN = /Scale:\s*([RSG])\s*(\d)/i

function classifyType (productId) {
  const rule = TYPE_RULES.find((r) => r.pattern.test(productId || ''))
  return rule ? rule.type : null
}

function extractScale (message) {
  const match = SCALE_PATTERN.exec(message || '')
  if (!match) return null
  return { category: match[1].toUpperCase(), level: Number(match[2]) }
}

// Returns null for alert families we don't classify (watches, radio bursts, etc.) — callers
// should filter these out rather than trying to render them.
function parseAlert (rawAlert) {
  const type = classifyType(rawAlert.product_id)
  if (!type) return null
  const scale = extractScale(rawAlert.message)
  return {
    productId: rawAlert.product_id,
    issueDate: String(rawAlert.issue_datetime).slice(0, 10),
    type,
    scaleCategory: scale ? scale.category : null,
    scaleLevel: scale ? scale.level : null
  }
}

module.exports = { parseAlert }
