const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

async function rawRequest (path, timeoutMs) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const t0 = Date.now()
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Authorization: `Bearer ${token}` } })
    const ms = Date.now() - t0
    if (!response.ok) {
      console.log(`${path} -> HTTP ${response.status} after ${ms}ms`)
      return null
    }
    const data = await response.json()
    console.log(`${path} -> OK after ${ms}ms`)
    return data
  } catch (err) {
    console.log(`${path} -> FAILED after ${Date.now() - t0}ms: ${err.message}`)
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function main () {
  console.log('now:', new Date().toISOString())
  console.log()

  const pastDesc = await rawRequest('/v1/conjunction-events/?epoch=past&limit=5&sort_by=tca_time&sort_order=desc', 20000)
  if (pastDesc) {
    console.log('sample past events (desc, most recent past TCA first):')
    pastDesc.forEach(e => console.log(`  short_id=${e.short_id} tca_time=${e.tca_time} user_interest=${e.user_interest} cdm_external_id=${e.cdm_external_id} primary=${e.primary_object_norad_id} secondary=${e.secondary_object_norad_id}`))
  }
  console.log()

  const pastAsc = await rawRequest('/v1/conjunction-events/?epoch=past&limit=5&sort_by=tca_time&sort_order=asc', 20000)
  if (pastAsc) {
    console.log('sample past events (asc, oldest first):')
    pastAsc.forEach(e => console.log(`  short_id=${e.short_id} tca_time=${e.tca_time} user_interest=${e.user_interest} cdm_external_id=${e.cdm_external_id} primary=${e.primary_object_norad_id} secondary=${e.secondary_object_norad_id}`))
  }
  console.log()

  await rawRequest('/v1/stats/count/conjunction-events?epoch=past', 30000)
}

main().catch(err => { console.error(err); process.exit(1) })
