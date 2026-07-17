const { mshRequest } = require('../app/lib/msh/client')

async function timedRequest (label, path, timeoutMs) {
  const t0 = Date.now()
  try {
    const data = await mshRequest(path, { timeoutMs })
    console.log(`${label} -> HTTP OK after ${Date.now() - t0}ms`)
    console.log(JSON.stringify(data, null, 2))
    return data
  } catch (err) {
    console.log(`${label} -> FAILED after ${Date.now() - t0}ms: ${err.message}`)
    return null
  }
}

async function main () {
  await timedRequest(
    'monthly conjunction-events-aggregated (Jul 2026)',
    '/v1/stats/monthly/conjunction-events-aggregated?start_date=2026-07-01&end_date=2026-07-31',
    70000
  )
}

main().catch(err => { console.error(err); process.exit(1) })
