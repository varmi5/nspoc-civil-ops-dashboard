const { mshRequest } = require('../app/lib/msh/client')

async function timeCall (label, path) {
  const t0 = Date.now()
  try {
    const events = await mshRequest(path)
    const ms = Date.now() - t0
    const dates = events.map(e => e.tca_time).filter(Boolean).sort()
    console.log(`${label} -> ${ms}ms, count=${events.length}, oldest=${dates[0]}, newest=${dates[dates.length-1]}`)
    return events
  } catch (err) {
    console.log(`${label} -> FAILED after ${Date.now()-t0}ms: ${err.message}`)
    return []
  }
}

async function main () {
  await timeCall('epoch=all sort=asc limit=1000', '/v1/conjunction-events/?limit=1000&sort_by=tca_time&sort_order=asc&epoch=all')
  await timeCall('epoch=past sort=desc limit=1000', '/v1/conjunction-events/?limit=1000&sort_by=tca_time&sort_order=desc&epoch=past')
  await timeCall('epoch=future sort=asc limit=1000', '/v1/conjunction-events/?limit=1000&sort_by=tca_time&sort_order=asc&epoch=future')
  await timeCall('no epoch param, sort=asc limit=1000', '/v1/conjunction-events/?limit=1000&sort_by=tca_time&sort_order=asc')
}

main().catch(err => { console.error(err); process.exit(1) })
