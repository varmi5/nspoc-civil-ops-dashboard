const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()
  const url = new URL('/openapi.json', config.apiBaseUrl)
  const spec = await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).json()
  const p = spec.paths['/v1/conjunction-events/'].get.parameters.find(p => p.name === 'search_like')
  console.log(JSON.stringify(p, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
