// One-off (2026-08-12): /v1/analyses/ has no date filter, only sort_by/sort_order/limit/
// offset, and /v1/stats/monthly/analyses' totals matched the MSH website's own "Analyses
// Received" table almost exactly when tested earlier - so its monthly bucketing is almost
// certainly by created_at. Paginating the whole dataset sorted by created_at ascending,
// then slicing out May 2026 client-side, to test whether deduping May's analyses by
// event_short_id (repeat analyses on the same event as its risk gets reassessed) lands
// anywhere near NSpOC's reported ~1,300/month figure.
const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function get (path) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return response.json()
}

async function main () {
  const PAGE = 10000
  let offset = 0
  const all = []
  while (true) {
    const page = await get(`/v1/analyses/?sort_by=created_at&sort_order=asc&limit=${PAGE}&offset=${offset}`)
    const rows = Array.isArray(page) ? page : (page.items || [])
    console.log(`offset ${offset}: got ${rows.length} rows`)
    all.push(...rows)
    if (rows.length < PAGE) break
    offset += PAGE
    if (offset > 200000) { console.log('safety stop'); break }
  }
  console.log('TOTAL fetched:', all.length)

  const may = all.filter(r => r.created_at >= '2026-05-01' && r.created_at < '2026-06-01')
  console.log('May 2026 analyses (by created_at):', may.length)
  const uniqueEvents = new Set(may.map(r => r.event_short_id))
  console.log('May 2026 unique event_short_id:', uniqueEvents.size)
  const uniqueCdm = new Set(may.map(r => r.cdm_external_id))
  console.log('May 2026 unique cdm_external_id:', uniqueCdm.size)

  // active-only view: an analysis can be superseded (is_active:false) by a later one on the
  // same event - counting only is_active:true per event might be the real "current" figure.
  const activeMay = may.filter(r => r.is_active)
  console.log('May 2026 is_active:true count:', activeMay.length)
  console.log('May 2026 is_active:true unique event_short_id:', new Set(activeMay.map(r => r.event_short_id)).size)
}

main().catch(err => { console.error(err); process.exit(1) })
