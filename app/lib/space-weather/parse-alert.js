// Maps NOAA product_id prefixes to alert type. K-index below 5 has no NOAA Scale line
// (G-scale starts at K=5), and neither electron flux (EF3A) nor geomagnetic sudden
// impulse (SGIW/SGIA) ever carries a Scale line, so scaleLevel stays null for those and
// sectorStatusesForDay treats that as no impact.
//
// Excluded: A20F/A30F geomagnetic storm WATCHes (forecasts, not confirmed conditions),
// TIIA/TIVA (radio bursts, not a NOAA scale category), BHIS (informational only).
const TYPE_RULES = [
  { pattern: /^K\d/i, type: 'kp_alert' },
  { pattern: /^X[MX]\d/i, type: 'xray_radio_blackout_alert' },
  { pattern: /^EF/i, type: 'electron_flux_alert' },
  { pattern: /^SGI/i, type: 'geomagnetic_sudden_impulse_alert' },
  { pattern: /^P\d/i, type: 'proton_flux_alert' }
]

// The scale line appears as "NOAA Scale: R2 - Moderate" or, inconsistently, "Noaa Scale:
// G1 - Minor" depending on product, sometimes repeated twice in the message.
// Case-insensitive, first match wins.
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

// Returns null for alert families we don't classify (watches, radio bursts, etc).
// Callers should filter these out rather than render them.
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
