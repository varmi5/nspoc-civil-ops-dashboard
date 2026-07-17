const { mshRequest } = require('../app/lib/msh/client')

async function timedRequest (label, path) {
  const t0 = Date.now()
  try {
    const data = await mshRequest(path, { timeoutMs: 10000 })
    console.log(`${label} -> ${Date.now() - t0}ms:`, JSON.stringify(data))
  } catch (err) {
    console.log(`${label} -> FAILED after ${Date.now() - t0}ms: ${err.message}`)
  }
}

async function main () {
  await timedRequest('Jul 2026', '/v1/stats/monthly/conjunction-events-aggregated?start_date=2026-07-01&end_date=2026-07-31')
  await timedRequest('Jun 2026', '/v1/stats/monthly/conjunction-events-aggregated?start_date=2026-06-01&end_date=2026-06-30')
  await timedRequest('Jan 2026', '/v1/stats/monthly/conjunction-events-aggregated?start_date=2026-01-01&end_date=2026-01-31')
  await timedRequest('12-month range', '/v1/stats/monthly/conjunction-events-aggregated?start_date=2025-08-01&end_date=2026-07-31')
  await timedRequest('Jan 2010 (empty)', '/v1/stats/monthly/conjunction-events-aggregated?start_date=2010-01-01&end_date=2010-01-31')
}

main().catch(err => { console.error(err); process.exit(1) })
