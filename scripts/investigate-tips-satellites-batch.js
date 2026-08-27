// One-off dev tool: re-entry.js's attachLatestLocation fans out to 2 per-object calls
// (/v1/tips/{norad_id}, /v1/satellites/{norad_id}) for up to 60 tracked objects per page
// load. Before accepting that as irreducible, check whether MSH exposes a bulk/catalog
// equivalent for either call, the conjunction-events case turned out to have one.
//
// Run with: node --env-file=.env scripts/investigate-tips-satellites-batch.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function main () {
  const token = await tokenCache.getAccessToken()

  async function get (path) {
    const url = new URL(path, config.apiBaseUrl)
    const t0 = Date.now()
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      const ms = Date.now() - t0
      if (!response.ok) {
        console.log(`${path} -> ${response.status} (${ms}ms)`)
        return null
      }
      const body = await response.json()
      console.log(`${path} -> ${response.status} (${ms}ms)`)
      return body
    } catch (err) {
      console.log(`${path} -> ERROR ${err.message} (${Date.now() - t0}ms)`)
      return null
    }
  }

  console.log('=== 1. Full openapi.json surface for /v1/tips and /v1/satellites ===')
  const specResponse = await fetch(new URL('/openapi.json', config.apiBaseUrl), {
    headers: { Authorization: `Bearer ${token}` }
  })
  const spec = await specResponse.json()
  const relevantPaths = Object.keys(spec.paths || {}).filter((p) => p.includes('/tips') || p.includes('/satellites'))
  for (const path of relevantPaths) {
    const getOp = spec.paths[path].get
    const params = getOp ? (getOp.parameters || []).map((p) => `${p.name}${p.required ? '*' : ''}`) : null
    console.log(`${path} -> params: ${params ? params.join(', ') || '(none)' : 'no GET'}`)
  }

  console.log('\n=== 2. Does /v1/satellites/monitored or /with-metadata return a bulk catalog with the fields re-entry.js needs (mass, apogee, perigee, inclination, license_country, international_designator)? ===')
  const monitored = await get('/v1/satellites/monitored')
  if (Array.isArray(monitored)) {
    console.log(`monitored: array of ${monitored.length}`)
    console.log('sample record:', JSON.stringify(monitored[0], null, 2))
    console.log('has norad_id field:', monitored[0] && ('norad_id' in monitored[0]))
  } else {
    console.log('monitored response:', JSON.stringify(monitored, null, 2)?.slice(0, 500))
  }

  const withMetadata = await get('/v1/satellites/with-metadata')
  if (Array.isArray(withMetadata)) {
    console.log(`with-metadata: array of ${withMetadata.length}`)
    console.log('sample record:', JSON.stringify(withMetadata[0], null, 2))
  } else {
    console.log('with-metadata response:', JSON.stringify(withMetadata, null, 2)?.slice(0, 500))
  }

  console.log('\n=== 3. Does a bare /v1/tips/ (no id) or /v1/tips/latest exist as a bulk equivalent? ===')
  await get('/v1/tips/')
  await get('/v1/tips/latest')

  console.log('\n=== 4. Timing comparison: N per-object satellite calls vs one bulk catalog call ===')
  const sampleIds = ['46565', '58919', '25544']
  const perObjectStart = Date.now()
  for (const id of sampleIds) {
    await get(`/v1/satellites/${id}`)
  }
  console.log(`Per-object total for ${sampleIds.length} calls: ${Date.now() - perObjectStart}ms`)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
