// One-off (2026-08-12): the MSH website's own "Performance monitoring" page has a section
// "NSpOC conjunction event analysis and manoeuvre support" with monthly "Analyses Received"
// / "Manoeuvre Support Plots Received" counts, in the low thousands/month - a different
// order of magnitude to both the raw aggregated screening total (tens of thousands) and the
// report=present filter (~1/month). Checking whether openapi.json exposes this as an API
// endpoint we could pull the same way.
const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()
  const url = new URL('/openapi.json', config.apiBaseUrl)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  const spec = await response.json()
  const paths = Object.keys(spec.paths)
  const hits = paths.filter(p => /analys|manoeuvre|maneuver|uksa/i.test(p))
  console.log('Paths matching analysis/manoeuvre/uksa:')
  hits.forEach(p => console.log(' ', p, Object.keys(spec.paths[p])))

  console.log('\nAll paths containing "conjunction":')
  paths.filter(p => /conjunction/i.test(p)).forEach(p => console.log(' ', p))
}

main().catch(err => { console.error(err); process.exit(1) })
