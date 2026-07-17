const { mshRequest } = require('../app/lib/msh/client')

async function timeCall (label, path, timeoutMs) {
  const t0 = Date.now()
  try {
    const events = await mshRequest(path, { timeoutMs })
    const ms = Date.now() - t0
    const dates = events.map(e => e.tca_time).filter(Boolean).sort()
    console.log(`${label} -> ${ms}ms, count=${events.length}, oldest=${dates[0]}, newest=${dates[dates.length-1]}`)
  } catch (err) {
    console.log(`${label} -> FAILED after ${Date.now()-t0}ms: ${err.message}`)
  }
}

async function main () {
  await timeCall('sort=asc limit=50 no epoch', '/v1/conjunction-events/?limit=50&sort_by=tca_time&sort_order=asc', 8000)
  await timeCall('sort=desc limit=50 epoch=future explicit', '/v1/conjunction-events/?limit=50&sort_by=tca_time&sort_order=desc&epoch=future', 8000)
  await timeCall('no sort_by at all, limit=50', '/v1/conjunction-events/?limit=50', 8000)
}

main().catch(err => { console.error(err); process.exit(1) })
