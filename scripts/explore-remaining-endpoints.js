// One-off dev tool: systematically calls every MSH endpoint group we haven't tested yet,
// plus the specific /v1/satellites/{norad_id} theory (does it have catalog metadata that
// reentry-events lacks?), and prints real shapes/values.
//
// Run with: node --env-file=.env scripts/explore-remaining-endpoints.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

function redactComments (obj) {
  if (Array.isArray(obj)) return obj.map(redactComments)
  if (!obj || typeof obj !== 'object') return obj
  const copy = {}
  for (const [key, value] of Object.entries(obj)) {
    copy[key] = key.endsWith('_comment') ? (value ? '[present]' : '[null]') : value
  }
  return copy
}

async function main () {
  const token = await tokenCache.getAccessToken()

  async function get (path) {
    const url = new URL(path, config.apiBaseUrl)
    try {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      console.log(`\n${path} -> ${response.status}`)
      if (!response.ok) {
        console.log((await response.text()).slice(0, 300))
        return null
      }
      const body = await response.json()
      return body
    } catch (err) {
      console.log(`\n${path} -> ERROR ${err.message}`)
      return null
    }
  }

  function show (label, body, { limit = 2 } = {}) {
    if (body === null || body === undefined) return
    if (Array.isArray(body)) {
      console.log(`${label}: array, length ${body.length}`)
      console.log(JSON.stringify(redactComments(body.slice(0, limit)), null, 2))
    } else {
      console.log(`${label}: object`)
      console.log(JSON.stringify(redactComments(body), null, 2))
    }
  }

  // --- THE THEORY: does /v1/satellites/{norad_id} have catalog data reentry-events lacks? ---
  console.log('=== Testing satellite-catalog-fallback theory ===')
  const testNoradIds = ['46565', '58919']
  for (const noradId of testNoradIds) {
    const sat = await get(`/v1/satellites/${noradId}`)
    show(`satellite ${noradId}`, sat, { limit: 1 })
    const reentry = await get(`/v1/reentry-events/by-norad-id/${noradId}`)
    if (reentry) {
      console.log(`reentry-event ${noradId} catalog fields: mass=${reentry.estimated_mass} apogee=${reentry.apogee} perigee=${reentry.perigee} inclination=${reentry.inclination} license_country=${reentry.license_country} intl_designator=${reentry.international_designator}`)
    }
  }

  // --- Endpoint groups not yet tested ---
  console.log('\n\n=== alerts ===')
  show('alerts list', await get('/v1/alerts/'))

  console.log('\n\n=== activity-events (generalised event concept) ===')
  show('schema', await get('/v1/activity-events/schema'), { limit: 1 })
  show('list', await get('/v1/activity-events/'))
  show('latest', await get('/v1/activity-events/latest'), { limit: 1 })

  console.log('\n\n=== activity-reports ===')
  show('schema', await get('/v1/activity-reports/schema'), { limit: 1 })
  show('list', await get('/v1/activity-reports/'))

  console.log('\n\n=== analyses ===')
  show('list', await get('/v1/analyses/'))

  console.log('\n\n=== banners ===')
  show('current banners', await get('/v1/banners/messages/current'))

  console.log('\n\n=== cdms (Conjunction Data Messages - raw upstream feed) ===')
  show('latest CDM', await get('/v1/cdms/latest'), { limit: 1 })

  console.log('\n\n=== ephemeris ===')
  show('list', await get('/v1/ephemeris/'))

  console.log('\n\n=== external-data-performance (ingestion pipeline health) ===')
  show('recent ingestion', await get('/v1/external-data-performance/'))
  show('aggregated', await get('/v1/external-data-performance/aggregated'))

  console.log('\n\n=== manoeuvre_plots ===')
  show('list', await get('/v1/manoeuvre_plots/'))

  console.log('\n\n=== organizations ===')
  show('list', await get('/v1/organizations/'))

  console.log('\n\n=== reentry-event-reports (analyst narrative) ===')
  show('schema', await get('/v1/reentry-event-reports/schema'), { limit: 1 })
  show('reports for RE26-0372', await get('/v1/reentry-event-reports/reentry-event/RE26-0372'))

  console.log('\n\n=== conjunction-reports ===')
  show('schema', await get('/v1/conjunction-reports/schema'), { limit: 1 })

  console.log('\n\n=== fragmentation-reports ===')
  show('schema', await get('/v1/fragmentation-reports/schema'), { limit: 1 })
  show('reports for FG26-0001', await get('/v1/fragmentation-reports/fragmentation-event/FG26-0001'))

  console.log('\n\n=== satellites (additional) ===')
  show('monitored', await get('/v1/satellites/monitored'), { limit: 1 })

  console.log('\n\n=== stats (additional/untested) ===')
  show('notifications-sent', await get('/v1/stats/notifications-sent'))
  show('monthly/analyses', await get('/v1/stats/monthly/analyses'), { limit: 3 })
  show('monthly/users', await get('/v1/stats/monthly/users'), { limit: 3 })
  show('monthly/organizations', await get('/v1/stats/monthly/organizations'), { limit: 3 })
  show('monthly/manoeuvre_plots', await get('/v1/stats/monthly/manoeuvre_plots'), { limit: 3 })
  show('count/reentry-reports', await get('/v1/stats/count/reentry-reports'))

  console.log('\n\n=== users ===')
  show('me', await get('/v1/users/me'))
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
