const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  const t0 = Date.now()
  const rows = await mshRequest('/v1/stats/monthly/conjunction-events?start_date=2026-07-01&end_date=2026-07-31', { timeoutMs: 90000 })
  console.log(`took ${Date.now() - t0}ms, row count: ${rows.length}`)
  console.log(JSON.stringify(rows.slice(0, 5), null, 2))
}

const start = Date.now()
main().catch(err => { console.error(`FAILED after ${Date.now() - start}ms:`, err.message); process.exit(1) })
