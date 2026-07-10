// One-off dev tool: pulls the real openapi.json (authenticated) and prints just the
// query parameters for the endpoints we care about for date/period filtering, so we
// design the month-selector against real API capability instead of guessing.
//
// Run with: node --env-file=.env scripts/inspect-openapi-params.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

const PATHS_OF_INTEREST = [
  '/v1/reentry-events/',
  '/v1/reentry-events/stats',
  '/v1/stats/monthly/reentry-events',
  '/v1/conjunction-events/',
  '/v1/conjunction-events/stats',
  '/v1/stats/monthly/conjunction-events',
  '/v1/fragmentation-events/',
  '/v1/stats/monthly/fragmentation-events',
  '/v1/stats/monthly/objects-launched'
]

async function main () {
  const token = await tokenCache.getAccessToken()
  const response = await fetch(new URL('/openapi.json', config.apiBaseUrl), {
    headers: { Authorization: `Bearer ${token}` }
  })
  console.log('openapi.json status:', response.status)
  const spec = await response.json()

  for (const path of PATHS_OF_INTEREST) {
    const item = spec.paths?.[path]
    if (!item) {
      console.log(`\n${path} -> not found in spec`)
      continue
    }
    const getOp = item.get
    if (!getOp) {
      console.log(`\n${path} -> no GET operation`)
      continue
    }
    const params = (getOp.parameters || []).map((p) => ({
      name: p.name,
      in: p.in,
      required: p.required,
      schema: p.schema
    }))
    console.log(`\n${path} parameters:`)
    console.log(JSON.stringify(params, null, 2))
  }
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
