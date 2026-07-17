const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  for (const limit of [500, 1000, 2000, 3696]) {
    const t0 = Date.now()
    try {
      const events = await mshRequest(`/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=${limit}`, { timeoutMs: 8000 })
      const ms = Date.now() - t0
      const dates = events.map(e => e.decay_epoch).filter(Boolean).sort()
      const withRisk = events.filter(e => e.atmospheric_risk || e.human_casualty_risk || e.fragments_risk).length
      console.log(`limit=${limit} -> ${ms}ms, count=${events.length}, oldest=${dates[0]}, newest=${dates[dates.length-1]}, withRisk=${withRisk}`)
    } catch (err) {
      console.log(`limit=${limit} -> FAILED after ${Date.now()-t0}ms: ${err.message}`)
    }
  }
}

main().catch(err => { console.error(err); process.exit(1) })
