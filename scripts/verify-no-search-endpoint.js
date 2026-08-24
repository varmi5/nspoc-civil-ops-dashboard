// One-off (2026-08-12): user needs to tell a colleague, with confidence, that no "search"
// endpoint exists on MSH. Re-verifying fresh and exhaustively against the live spec rather
// than trusting the earlier note - checking every path name AND every parameter name across
// the whole API, not just conjunction-related ones.
const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()
  const url = new URL('/openapi.json', config.apiBaseUrl)
  const spec = await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).json()
  const paths = Object.keys(spec.paths)
  console.log('Total paths in spec:', paths.length)

  const pathHits = paths.filter(p => /search/i.test(p))
  console.log('\nPaths containing "search":', pathHits.length ? pathHits : 'NONE')

  const paramHits = []
  for (const p of paths) {
    for (const method of Object.keys(spec.paths[p])) {
      const params = spec.paths[p][method].parameters || []
      for (const param of params) {
        if (/search/i.test(param.name)) paramHits.push(`${method.toUpperCase()} ${p} -> ${param.name}`)
      }
    }
  }
  console.log('\nParameters containing "search":', paramHits.length ? paramHits : 'NONE')

  // Also list every distinct top-level resource group, for a sanity-check overview
  const groups = new Set(paths.map(p => p.split('/')[2]))
  console.log('\nAll top-level resource groups:', [...groups].sort())
}

main().catch(err => { console.error(err); process.exit(1) })
