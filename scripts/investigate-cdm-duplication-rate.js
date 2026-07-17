const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  // Only fast combo confirmed so far: default epoch, sort_order=desc, sort_by=tca_time.
  const t0 = Date.now()
  const events = await mshRequest('/v1/conjunction-events/?limit=2000&sort_by=tca_time&sort_order=desc')
  console.log(`fetched ${events.length} rows in ${Date.now() - t0}ms`)

  const byShortId = new Map()
  for (const e of events) {
    byShortId.set(e.short_id, (byShortId.get(e.short_id) || 0) + 1)
  }
  const uniqueCount = byShortId.size
  const ratio = events.length / uniqueCount
  console.log(`unique short_ids: ${uniqueCount}`)
  console.log(`raw rows: ${events.length}`)
  console.log(`average revisions per unique event: ${ratio.toFixed(2)}`)

  const revisionCounts = Array.from(byShortId.values())
  const max = Math.max(...revisionCounts)
  const distribution = revisionCounts.reduce((acc, n) => { acc[n] = (acc[n]||0)+1; return acc }, {})
  console.log(`max revisions seen for a single event: ${max}`)
  console.log('distribution (revision count -> how many events have that many rows):', JSON.stringify(distribution))
}

main().catch(err => { console.error(err); process.exit(1) })
