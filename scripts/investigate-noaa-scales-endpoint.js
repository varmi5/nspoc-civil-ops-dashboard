// Follow-up to investigate-noaa-alerts-shape.js: NOAA SWPC also publishes
// noaa-scales.json, a structured current/predicted R/S/G scale endpoint that could avoid
// parsing free-text alert messages entirely for the "what's the current scale level" part
// of the sector table. Also grabs the two product_ids not seen in the first alerts.json
// sample (SGIW/SGIA for geomagnetic sudden impulse, P11W for proton flux) since Krish's CSV
// includes geomagnetic_sudden_impulse_alert specifically.
//
// Run with: node scripts/investigate-noaa-scales-endpoint.js   (no .env needed, public API)

async function main () {
  console.log('=== noaa-scales.json ===')
  const scalesResponse = await fetch('https://services.swpc.noaa.gov/products/noaa-scales.json')
  console.log(`status: ${scalesResponse.status}`)
  const scales = await scalesResponse.json()
  console.log(JSON.stringify(scales, null, 2))

  console.log('\n=== Full alerts.json, filtering for SGI/P11 product_ids ===')
  const alertsResponse = await fetch('https://services.swpc.noaa.gov/products/alerts.json')
  const alerts = await alertsResponse.json()
  const matches = alerts.filter((a) => a.product_id.startsWith('SGI') || a.product_id.startsWith('P11'))
  for (const m of matches) {
    console.log(`\n--- product_id: ${m.product_id} | issue_datetime: ${m.issue_datetime} ---`)
    console.log(m.message)
  }
  if (!matches.length) console.log('(none currently active in the live feed)')
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
