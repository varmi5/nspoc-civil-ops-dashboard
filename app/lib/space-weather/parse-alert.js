// Product_id families and what they map to, checked against NOAA's live feed:
//
//   K04A/K04W..K07A/K07W    Geomagnetic K-index          -> kp_alert
//                           (K below 5 has no NOAA Scale line at all, G-scale only
//                           starts at K=5, so scaleLevel stays null and
//                           sectorStatusesForDay treats that as no impact)
//   XM..A/XM..S/XX..A/XX..S X-ray flux                   -> xray_radio_blackout_alert
//   EF3A                    Electron flux                -> electron_flux_alert
//                           (never carries a NOAA Scale line)
//   SGIW/SGIA               Geomagnetic Sudden Impulse   -> geomagnetic_sudden_impulse_alert
//                           (never carries a NOAA Scale line)
//   P1..W/P1..A             Proton flux                  -> proton_flux_alert
//
// Deliberately excluded: A20F/A30F geomagnetic storm WATCHes (forecasts, not confirmed
// conditions), TIIA/TIVA (Type II/IV radio bursts, not a NOAA scale category), BHIS
// (10cm radio burst summary, informational only).
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
