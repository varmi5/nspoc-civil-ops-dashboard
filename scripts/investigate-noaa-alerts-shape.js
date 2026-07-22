// One-off dev tool: fetches the REAL NOAA SWPC alerts feed (public, no auth) and prints raw
// samples so the space-weather parser is built against actual field names/message text, not
// a guess. Cross-references against Krish's real June 2026 alert types (xray_radio_blackout_
// alert / kp_alert / electron_flux_alert / geomagnetic_sudden_impulse_alert) to confirm the
// product_id prefixes and message text patterns for each.
//
// Run with: node scripts/investigate-noaa-alerts-shape.js   (no .env needed, public API)

const NOAA_ALERTS_URL = 'https://services.swpc.noaa.gov/products/alerts.json'

async function main () {
  const t0 = Date.now()
  const response = await fetch(NOAA_ALERTS_URL)
  console.log(`GET ${NOAA_ALERTS_URL} -> ${response.status} (${Date.now() - t0}ms)`)
  const alerts = await response.json()
  console.log(`Total alerts returned: ${alerts.length}`)
  console.log('\nFirst raw record (full):')
  console.log(JSON.stringify(alerts[0], null, 2))

  console.log('\nDistinct product_id prefixes seen (first 2-3 chars group):')
  const byPrefix = {}
  for (const a of alerts) {
    const prefix = (a.product_id || '').slice(0, 3)
    byPrefix[prefix] = (byPrefix[prefix] || 0) + 1
  }
  console.log(JSON.stringify(byPrefix, null, 2))

  console.log('\nOne sample message per distinct product_id (up to 15):')
  const seen = new Set()
  for (const a of alerts) {
    if (seen.has(a.product_id) || seen.size >= 15) continue
    seen.add(a.product_id)
    console.log(`\n--- product_id: ${a.product_id} | issue_datetime: ${a.issue_datetime} ---`)
    console.log(a.message)
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
