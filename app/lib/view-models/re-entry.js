const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
const { buildBarChart } = require('../charts/bar-chart')
const { highestRisk } = require('../format-risk')
const { formatDate, formatDateTime, formatMonth } = require('../format-date')
const { toDateString, startOfMonth, endOfMonth, currentMonth, shiftMonths } = require('../date-range')
const { normaliseLongitude, hasResolvedLocation } = require('../geo')
const { projectPoint, buildGraticule } = require('../charts/world-projection')

const ALLOWED_TREND_PERIODS = [1, 3, 6, 12, 24]
const DEFAULT_TREND_PERIOD = 12

function resolveTrendPeriod (requestedMonths) {
  const parsed = Number(requestedMonths)
  return ALLOWED_TREND_PERIODS.includes(parsed) ? parsed : DEFAULT_TREND_PERIOD
}

function bucketObjectType (objectType) {
  const type = (objectType || '').toUpperCase()
  if (type.includes('ROCKET')) return 'Rocket Bodies'
  if (type === 'PAYLOAD') return 'Satellites'
  return 'Debris / Unknown'
}

function formatLocation (tip) {
  if (!tip || tip.latitude === null || tip.latitude === undefined || tip.longitude === null || tip.longitude === undefined) {
    return 'Unknown'
  }
  const longitude = normaliseLongitude(tip.longitude)
  const latDir = tip.latitude >= 0 ? 'N' : 'S'
  const lonDir = longitude >= 0 ? 'E' : 'W'
  return `${Math.abs(tip.latitude).toFixed(1)}°${latDir}, ${Math.abs(longitude).toFixed(1)}°${lonDir}`
}

function sortTipsByMostRecent (tips) {
  return [...tips].sort((a, b) => new Date(b.creation_date) - new Date(a.creation_date))
}

// The API defaults to epoch=future when it's not specified — confirmed live this only
// covers objects still ahead of their predicted decay (2, right now), while the full
// tracked population (epoch=all) was 3,696. "Tracked objects" should mean the real
// breadth of what's being tracked, not just the sliver still pending — epoch=all, most
// recent first. There's no date-range param on this endpoint, so a big limit is fetched
// once (confirmed live: even the full 3,696-record archive back to 2004 returns in ~2s)
// and the requested reporting period/display cap are both applied client-side in
// selectAndCap below, rather than by the query itself.
async function fetchReentryListRaw () {
  return mshRequest('/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=2000')
}

// Keeps the raw fetch (above) and the per-caller windowing separate: the tracked-objects
// table wants "the selected reporting period, capped to a sensible display size", the map
// wants "however many recent objects it was already showing" — one shared fetch, two
// different slices, so the underlying MSH call is only ever made once either way (the
// response cache already dedupes it).
function selectAndCap (rawEvents, { months, cap }) {
  let filtered = rawEvents
  if (months) {
    const cutoff = startOfMonth(shiftMonths(currentMonth(), -(months - 1)))
    filtered = rawEvents.filter((event) => !event.decay_epoch || new Date(event.decay_epoch) >= cutoff)
  }
  return {
    events: filtered.slice(0, cap),
    totalInPeriod: filtered.length,
    truncated: filtered.length > cap
  }
}

async function fetchMonthlyTrend (months) {
  const end = currentMonth()
  const start = shiftMonths(end, -(months - 1))
  const url = `/v1/stats/monthly/reentry-events?start_date=${toDateString(startOfMonth(start))}&end_date=${toDateString(endOfMonth(end))}`
  return mshRequest(url)
}

async function fetchTipsForNoradId (noradId) {
  const tips = await mshRequest(`/v1/tips/${noradId}`)
  return Array.isArray(tips) ? tips : [tips]
}

// Confirmed by direct testing: reentry-events almost always has estimated_mass, apogee,
// perigee, inclination, license_country and international_designator as null — but the
// satellite catalog record for the same norad_id has all of them populated (it's the
// object's permanent catalog entry, not tied to this specific re-entry assessment).
// Best-effort: a failure here just means we keep showing "Unknown" for these fields,
// same as before this fix existed.
async function fetchSatelliteCatalog (noradId) {
  return mshRequest(`/v1/satellites/${noradId}`)
}

async function tryFetchSatelliteCatalog (noradId) {
  try {
    return await fetchSatelliteCatalog(noradId)
  } catch (err) {
    return null
  }
}

// Confirmed by direct testing (scripts/investigate-tips-satellites-batch.js,
// investigate-tips-latest-and-catalog-size.js): the full satellite catalog is only 834
// records, and /v1/satellites/with-metadata?limit=1000 returns all of them in ~470ms — one
// call, not one per norad_id. attachLatestLocation below uses this instead of calling
// fetchSatelliteCatalog per-object, which used to mean up to TRACKED_OBJECTS_CAP (60)
// individual /v1/satellites/{id} calls per page load. (/v1/tips/latest was also checked as
// a possible bulk replacement for the per-object /v1/tips/{norad_id} call, but it returns
// only the single most-recently-created TIP system-wide, not one per tracked object — no
// bulk equivalent exists for that half of the fan-out.)
async function fetchSatelliteCatalogMap () {
  const records = await mshRequest('/v1/satellites/with-metadata?limit=1000')
  const map = new Map()
  for (const record of records) {
    map.set(String(record.norad_id), record)
  }
  return map
}

async function tryFetchSatelliteCatalogMap () {
  try {
    return await fetchSatelliteCatalogMap()
  } catch (err) {
    return new Map()
  }
}

function firstDefined (...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== '') return value
  }
  return null
}

// The list/table page shows the latest predicted location per object as a string; the map
// page (buildReEntryMapViewModel) needs the raw numbers too, for plotting. Fetching each
// object's TIP history is best-effort — a failure on one object's TIP lookup shouldn't
// take down the whole page, it just falls back to "Unknown"/unplottable for that object.
// catalogMap is the one shared /v1/satellites/with-metadata fetch (see
// fetchSatelliteCatalogMap above) — a plain lookup here, not a network call.
async function attachLatestLocation (event, listIsLive, catalogMap) {
  if (!listIsLive) {
    return { ...event, location: 'Unknown', latitude: null, longitude: null }
  }
  const tips = await fetchTipsForNoradId(event.norad_id).catch(() => [])
  const latestTip = sortTipsByMostRecent(tips)[0]
  const catalog = catalogMap.get(String(event.norad_id)) || null

  return {
    ...event,
    estimated_mass: firstDefined(event.estimated_mass, catalog && catalog.mass),
    location: tips.length ? formatLocation(latestTip) : 'Unknown',
    latitude: latestTip ? latestTip.latitude : null,
    longitude: latestTip ? normaliseLongitude(latestTip.longitude) : null
  }
}

// Shared by the tracked-objects table (buildReEntryViewModel) and the map
// (buildReEntryMapViewModel) — one fetch-and-enrich code path, not two. The underlying
// MSH calls are already deduplicated across both by the response cache. `months`/`cap`
// are applied to the raw list BEFORE enrichment — each selected object still costs one
// more live call (TIP history; satellite catalog is now one shared call for the whole
// batch, see fetchSatelliteCatalogMap above), so filtering first keeps that fan-out
// bounded regardless of how large the raw fetch or the matching period turns out to be.
async function loadEnrichedReentryEvents ({ months, cap } = {}) {
  const listResult = await getSectionData('re-entry', { liveFetcher: fetchReentryListRaw, fixturePath: 're-entry/objects.json' })
  const { events: selectedEvents, totalInPeriod, truncated } = listResult.isLive
    ? selectAndCap(listResult.data, { months, cap })
    : { events: listResult.data, totalInPeriod: listResult.data.length, truncated: false }

  // One shared catalog fetch for however many objects are selected, not one per object —
  // see fetchSatelliteCatalogMap above. Only fetched when the list itself is live: no
  // point making a live call here just to enrich fixture-fallback data.
  const catalogMap = listResult.isLive ? await tryFetchSatelliteCatalogMap() : new Map()

  const events = await Promise.all(
    selectedEvents.map((event) => attachLatestLocation(event, listResult.isLive, catalogMap))
  )
  return { isLive: listResult.isLive, events, totalInPeriod, truncated }
}

// A "sleek, scrollable" tab panel rather than a page-length table needs a sensible
// display cap — each object enriched here still costs one more live call (TIP history),
// so this also bounds that fan-out. Raised from the old flat "30 most recent"
// limit since the table now spans the selected reporting period, not just the last
// couple of weeks; objectsTruncated/objectsTotalInPeriod below tell the page (and this
// isn't hidden) when the period holds more than fit on screen.
const TRACKED_OBJECTS_CAP = 60

async function buildReEntryViewModel (requestedMonths) {
  const months = resolveTrendPeriod(requestedMonths)

  const [{ isLive: listIsLive, events: enrichedEvents, totalInPeriod, truncated }, trendResult] = await Promise.all([
    loadEnrichedReentryEvents({ months, cap: TRACKED_OBJECTS_CAP }),
    getSectionData('re-entry', { liveFetcher: () => fetchMonthlyTrend(months), fixturePath: 're-entry/trend.json' })
  ])

  // Fixture data is a fixed 12-month sample — trim it to match whatever period was
  // requested so the fallback view stays visually consistent with the live one.
  const trendRows = trendResult.isLive ? trendResult.data : trendResult.data.slice(-months)

  // The KPI tiles above the trend strip summarise the SAME selected period, rather than
  // a separately-scoped "lifetime" stats call — otherwise the tiles and the strip below
  // them could show inconsistent, confusing numbers for what looks like one figure.
  const periodTotalCount = trendRows.reduce((sum, row) => sum + row.count, 0)
  const periodAlertCount = trendRows.reduce((sum, row) => sum + row.alert_count, 0)

  const now = new Date()
  const rows = enrichedEvents.map((event) => ({
    objectType: bucketObjectType(event.object_type),
    objectName: event.object_name,
    mass: event.estimated_mass ? `${event.estimated_mass} kg` : 'Unknown',
    date: formatDate(event.decay_epoch),
    risk: highestRisk(event.atmospheric_risk, event.human_casualty_risk, event.fragments_risk),
    location: event.location,
    noradId: event.norad_id,
    isUpcoming: Boolean(event.decay_epoch) && new Date(event.decay_epoch) > now
  }))

  const objectTypeCounts = rows.reduce((acc, row) => {
    acc[row.objectType] = (acc[row.objectType] || 0) + 1
    return acc
  }, {})

  // Three tabs instead of one long table: still ahead of their predicted decay
  // ("Upcoming"), already decayed but not yet risk-assessed ("Pending Analysis" — this is
  // the normal state most objects sit in, per the explainer text below), or already
  // decayed and analysed. Risk assessment happens close to or after the decay date (see
  // explainer), so "upcoming" objects with a risk rating already assigned would be
  // unusual — in practice this split is almost always the same as future/past.
  const decayedRows = rows.filter((row) => !row.isUpcoming)
  const upcomingRows = rows.filter((row) => row.isUpcoming)
  const analysedRows = decayedRows.filter((row) => row.risk !== null)
  const pendingAnalysisRows = decayedRows.filter((row) => row.risk === null)

  // Latest month first — the current/most recent period is what you want to see
  // immediately, not after scrolling right past everything older.
  const trend = trendRows.slice().reverse().map((row) => ({
    month: formatMonth(row.month),
    count: row.count,
    alertCount: row.alert_count
  }))

  return {
    isLive: listIsLive && trendResult.isLive,
    periodTotalCount,
    periodAlertCount,
    trend,
    trendChart: buildBarChart(trend),
    trendMonths: months,
    trendPeriods: ALLOWED_TREND_PERIODS,
    rows,
    tabs: {
      upcoming: upcomingRows,
      pendingAnalysis: pendingAnalysisRows,
      analysed: analysedRows
    },
    objectsCap: TRACKED_OBJECTS_CAP,
    objectsTotalInPeriod: totalInPeriod,
    objectsTruncated: truncated,
    analysedCount: analysedRows.length,
    totalCount: rows.length,
    objectTypeDonut: buildDonut(Object.entries(objectTypeCounts).map(([label, value]) => ({ label, value })))
  }
}

async function fetchReentryByNoradId (noradId) {
  return mshRequest(`/v1/reentry-events/by-norad-id/${noradId}`)
}

async function buildReEntryObjectViewModel (noradId) {
  const [detailResult, tipsResult, catalog] = await Promise.all([
    getSectionData('re-entry', {
      liveFetcher: () => fetchReentryByNoradId(noradId),
      fixturePath: 're-entry/tip/starlink-1735.json'
    }),
    getSectionData('re-entry', {
      liveFetcher: () => fetchTipsForNoradId(noradId),
      fixturePath: 're-entry/tip/starlink-1735-history.json'
    }),
    tryFetchSatelliteCatalog(noradId)
  ])

  const event = detailResult.data
  const tips = Array.isArray(tipsResult.data) ? tipsResult.data : [tipsResult.data]
  const sortedTips = sortTipsByMostRecent(tips)
  const latestTip = sortedTips[0] || null

  if (!event) {
    return null
  }

  // reentry-events almost never carries these catalog fields itself (see fetchSatelliteCatalog
  // above) — fall back to the object's satellite catalog record, which does.
  const mass = firstDefined(event.estimated_mass, catalog && catalog.mass)
  const apogee = firstDefined(event.apogee, catalog && catalog.apogee)
  const perigee = firstDefined(event.perigee, catalog && catalog.perigee)
  const inclination = firstDefined(event.inclination, catalog && catalog.inclination)
  const licenseCountry = firstDefined(event.license_country, event.licensed_country, catalog && catalog.license_country)
  const internationalDesignator = firstDefined(event.international_designator, catalog && catalog.international_designator)

  return {
    isLive: detailResult.isLive && tipsResult.isLive,
    noradId,
    objectName: event.object_name,
    objectType: bucketObjectType(event.object_type),
    licenseCountry: licenseCountry || 'Unknown',
    internationalDesignator: internationalDesignator || 'Unknown',
    mass: mass ? `${mass} kg` : 'Unknown',
    apogee: apogee ? `${apogee} km` : 'Unknown',
    perigee: perigee ? `${perigee} km` : 'Unknown',
    inclination: inclination !== null && inclination !== undefined ? `${inclination}°` : 'Unknown',
    decayEpoch: formatDateTime(event.decay_epoch),
    risk: highestRisk(event.atmospheric_risk, event.human_casualty_risk, event.fragments_risk),
    predictedLocation: formatLocation(latestTip),
    reentryHistory: sortedTips.map((tip) => ({
      reportedAt: formatDateTime(tip.creation_date),
      predictedDecay: formatDateTime(tip.decay_epoch),
      uncertaintyWindowMinutes: tip.uncertainty_window,
      location: formatLocation(tip),
      source: tip.source || 'Unknown'
    }))
  }
}

async function buildReEntryMapViewModel () {
  // Unchanged from this map's original behaviour — no period filter, just the 30 most
  // recent by decay date — the period selector above only scopes the table, not the map.
  const { isLive, events } = await loadEnrichedReentryEvents({ months: null, cap: 30 })

  const plottable = events.filter((event) => hasResolvedLocation(event))

  const markers = plottable.map((event) => {
    const { x, y } = projectPoint(event.latitude, event.longitude)
    return {
      noradId: event.norad_id,
      objectName: event.object_name,
      objectType: bucketObjectType(event.object_type),
      risk: highestRisk(event.atmospheric_risk, event.human_casualty_risk, event.fragments_risk),
      decayDate: formatDate(event.decay_epoch),
      location: event.location,
      x,
      y
    }
  })

  return {
    isLive,
    markers,
    plottedCount: markers.length,
    totalCount: events.length,
    unresolvedCount: events.length - markers.length,
    graticule: buildGraticule()
  }
}

module.exports = { buildReEntryViewModel, buildReEntryObjectViewModel, buildReEntryMapViewModel }
