const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  for (const limit of [100, 500, 1000]) {
    const t0 = Date.now()
    try {
      const events = await mshRequest(`/v1/conjunction-events/?limit=${limit}&sort_by=tca_time&sort_order=desc`)
      const ms = Date.now() - t0
      const dates = events.map(e => e.tca_time).filter(Boolean).sort()
      console.log(`limit=${limit} -> ${ms}ms, count=${events.length}, oldest=${dates[0]}, newest=${dates[dates.length-1]}`)
    } catch (err) {
      console.log(`limit=${limit} -> FAILED after ${Date.now()-t0}ms: ${err.message}`)
    }
  }

  console.log('\n--- reentry-events same test ---')
  for (const limit of [30, 100, 300]) {
    const t0 = Date.now()
    try {
      const events = await mshRequest(`/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=${limit}`)
      const ms = Date.now() - t0
      const dates = events.map(e => e.decay_epoch).filter(Boolean).sort()
      console.log(`limit=${limit} -> ${ms}ms, count=${events.length}, oldest=${dates[0]}, newest=${dates[dates.length-1]}`)
    } catch (err) {
      console.log(`limit=${limit} -> FAILED after ${Date.now()-t0}ms: ${err.message}`)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
