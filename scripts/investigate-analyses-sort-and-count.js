const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function get (path) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return response.json()
}

async function main () {
  const token = await tokenCache.getAccessToken()
  const specUrl = new URL('/openapi.json', config.apiBaseUrl)
  const spec = await (await fetch(specUrl, { headers: { Authorization: `Bearer ${token}` } })).json()
  const p = spec.paths['/v1/analyses/'].get.parameters
  console.log(JSON.stringify(p, null, 2))

  const countPaths = Object.keys(spec.paths).filter(k => /analys/i.test(k) && /count/i.test(k))
  console.log('count-ish analysis paths:', countPaths)

  // sample 3 pages sorted by created_at desc to see date spread and check whether update_time
  // or created_at aligns with which "month" a record lands in for the monthly stats endpoint
  const rows = await get('/v1/analyses/?sort_by=created_at&sort_order=desc&limit=5&offset=0')
  console.log('most recent 5 by created_at:')
  console.log(JSON.stringify((Array.isArray(rows) ? rows : rows.items || []).map(r => ({
    created_at: r.created_at, update_time: r.update_time, tca_time: r.tca_time, event_short_id: r.event_short_id
  })), null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
