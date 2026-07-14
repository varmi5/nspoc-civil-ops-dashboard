const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
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

async function fetchReentryList () {
  return mshRequest('/v1/reentry-events/')
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
async function attachLatestLocation (event, listIsLive) {
  if (!listIsLive) {
    return { ...event, location: 'Unknown', latitude: null, longitude: null }
  }
  const [tipsResult, satellite] = await Promise.allSettled([
    fetchTipsForNoradId(event.norad_id),
    tryFetchSatelliteCatalog(event.norad_id)
  ])

  const tips = tipsResult.status === 'fulfilled' ? tipsResult.value : []
  const latestTip = sortTipsByMostRecent(tips)[0]
  const catalog = satellite.status === 'fulfilled' ? satellite.value : null

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
// MSH calls are already deduplicated across both by the response cache.
async function loadEnrichedReentryEvents () {
  const listResult = await getSectionData('re-entry', { liveFetcher: fetchReentryList, fixturePath: 're-entry/objects.json' })
  const events = await Promise.all(
    listResult.data.map((event) => attachLatestLocation(event, listResult.isLive))
  )
  return { isLive: listResult.isLive, events }
}

async function buildReEntryViewModel (requestedMonths) {
  const months = resolveTrendPeriod(requestedMonths)

  const [{ isLive: listIsLive, events: enrichedEvents }, trendResult] = await Promise.all([
    loadEnrichedReentryEvents(),
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

  const rows = enrichedEvents.map((event) => ({
    objectType: bucketObjectType(event.object_type),
    objectName: event.object_name,
    mass: event.estimated_mass ? `${event.estimated_mass} kg` : 'Unknown',
    date: formatDate(event.decay_epoch),
    risk: highestRisk(event.atmospheric_risk, event.human_casualty_risk, event.fragments_risk),
    location: event.location,
    noradId: event.norad_id
  }))

  const objectTypeCounts = rows.reduce((acc, row) => {
    acc[row.objectType] = (acc[row.objectType] || 0) + 1
    return acc
  }, {})

  const analysedRows = rows.filter((row) => row.risk !== null)

  return {
    isLive: listIsLive && trendResult.isLive,
    periodTotalCount,
    periodAlertCount,
    trend: trendRows.map((row) => ({
      month: formatMonth(row.month),
      count: row.count,
      alertCount: row.alert_count
    })),
    trendMonths: months,
    trendPeriods: ALLOWED_TREND_PERIODS,
    rows,
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
  const { isLive, events } = await loadEnrichedReentryEvents()

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
