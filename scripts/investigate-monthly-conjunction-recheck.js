const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  const t0 = Date.now()
  try {
    const rows = await mshRequest('/v1/stats/monthly/conjunction-events?start_date=2026-07-01&end_date=2026-07-31')
    console.log(`took ${Date.now() - t0}ms`)
    console.log(JSON.stringify(rows, null, 2))
  } catch (err) {
    console.log(`FAILED after ${Date.now() - t0}ms: ${err.message}`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
