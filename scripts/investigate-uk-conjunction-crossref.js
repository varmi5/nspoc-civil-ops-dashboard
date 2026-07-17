const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  const sats = await mshRequest('/v1/satellites/with-metadata?limit=2000')
  const ukNoradIds = new Set(
    sats.filter(s => s.license_country === 'UK').map(s => String(s.norad_id))
  )
  console.log(`UK-licensed satellites: ${ukNoradIds.size}`)

  const events = await mshRequest('/v1/conjunction-events/?limit=2000&sort_by=tca_time&sort_order=desc')
  console.log(`fetched ${events.length} conjunction events`)
  console.log('sample event keys:', Object.keys(events[0] || {}))

  const involvingUk = events.filter(e =>
    ukNoradIds.has(String(e.primary_object_norad_id)) || ukNoradIds.has(String(e.secondary_object_norad_id))
  )
  console.log(`events involving at least one UK-licensed object: ${involvingUk.length} of ${events.length} (${(100 * involvingUk.length / events.length).toFixed(1)}%)`)

  const monitored = await mshRequest('/v1/satellites/monitored?limit=2000')
  console.log(`\n/v1/satellites/monitored count: ${monitored.length}`)
  console.log('sample monitored record keys:', Object.keys(monitored[0] || {}))
}

main().catch(err => { console.error(err); process.exit(1) })
