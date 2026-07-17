const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  const t0 = Date.now()
  const events = await mshRequest('/v1/conjunction-events/for-analysis?threshold=0.001&limit=100', { timeoutMs: 8000 })
  console.log(`took ${Date.now() - t0}ms, count=${events.length}`)
  const dates = events.map(e => e.tca_time).filter(Boolean).sort()
  console.log(`oldest=${dates[0]}, newest=${dates[dates.length-1]}`)
  console.log('sample event keys:', Object.keys(events[0] || {}))
}

main().catch(err => { console.error('FAILED:', err.message); process.exit(1) })
