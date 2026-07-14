// One-off dev tool: tests the specific endpoints flagged in the analyst-primer doc that we
// haven't tried yet — does conjunction-events have the same sparse-catalog-data gap as
// reentry-events? Does /for-analysis give a more meaningful "needs attention" count?
//
// Run with: node --env-file=.env scripts/explore-conjunction-detail-endpoints.js

const config = require('../app/lib/msh/config')
const tokenCache = require('../app/lib/msh/token-cache')

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
      return await response.json()
    } catch (err) {
      console.log(`\n${path} -> ERROR ${err.message}`)
      return null
    }
  }

  function show (label, body, limit = 2) {
    if (body === null || body === undefined) return
    if (Array.isArray(body)) {
      console.log(`${label}: array, length ${body.length}`)
      console.log(JSON.stringify(body.slice(0, limit), null, 2))
    } else {
      console.log(`${label}: object`)
      console.log(JSON.stringify(body, null, 2))
    }
  }

  // Get a real conjunction event to test the detail sub-endpoints against
  const list = await get('/v1/conjunction-events/?limit=3&sort_by=tca_time&sort_order=desc')
  show('conjunction list sample', list, 3)

  if (Array.isArray(list) && list.length) {
    const sample = list[0]
    console.log(`\nUsing event short_id=${sample.short_id} primary=${sample.primary_object_norad_id} secondary=${sample.secondary_object_norad_id}`)

    show('summary', await get(`/v1/conjunction-events/${sample.id}/summary`))
    show('data-sources', await get(`/v1/conjunction-events/${sample.id}/data-sources`))
    show('satellite pair', await get(`/v1/conjunction-events/satellite/${sample.short_id}`))
    show('manoeuvre plots for event', await get(`/v1/manoeuvre_plots/by-event/${sample.short_id}`))

    // Check whether the primary object's catalog record has data the conjunction event lacks
    show('primary object catalog', await get(`/v1/satellites/${sample.primary_object_norad_id}`))
    console.log(`\nConjunction event's own object fields: primary_common_name=${sample.primary_object_common_name} (no mass/license fields present on the event record itself)`)

    show('fragmentation history for primary object', await get(`/v1/fragmentation-events/by-norad-id/${sample.primary_object_norad_id}`))
  }

  console.log('\n\n=== for-analysis (needs human review) ===')
  show('for-analysis', await get('/v1/conjunction-events/for-analysis?limit=5'))
  show('future-events-for-analysis', await get('/v1/conjunction-events/future-events-for-analysis?limit=5'))
  show('events-for-analysis-aggregated', await get('/v1/conjunction-events/events-for-analysis-aggregated'))

  console.log('\n\n=== point-in-time counts ===')
  show('count/conjunction-events', await get('/v1/stats/count/conjunction-events'))
  show('count/reentry-events', await get('/v1/stats/count/reentry-events'))
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
