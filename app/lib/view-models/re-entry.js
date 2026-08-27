const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
const { buildLineChart } = require('../charts/line-chart')
const { STATUS, worstStatus } = require('../msh/status')
const { highestRisk, reentryRisk, hasKnownRisk, isElevatedRisk } = require('../format-risk')
const { formatDate, formatDateTime, formatMonth } = require('../format-date')
const {
  toDateString, startOfMonth, endOfMonth, currentMonth, shiftMonths,
  monthKey, monthLabel, parseMonthParam, listRecentMonths
} = require('../date-range')
const { normaliseLongitude, hasResolvedLocation } = require('../geo')
const { feature: countryFeature } = require('@rapideditor/country-coder')
const mapboxConfig = require('../mapbox/config')

// The trend graph stays a fixed 12-month cumulative window ending at the selected
// reporting month, matching Collision & Fragmentation's chart. Everything else on the
// page (table, map, UK risk table, donut, KPIs) is scoped to that one month only, not a
// rolling window.
const TREND_WINDOW_MONTHS = 12
const MONTH_OPTIONS_COUNT = 24

function bucketObjectType (objectType) {
  const type = (objectType || '').toUpperCase()
  if (type.includes('ROCKET')) return 'Rocket Bodies'
  if (type === 'PAYLOAD') return 'Satellites'
  return 'Debris / Unknown'
}

// Countries are more useful here than raw coordinates, users mainly need to know whether
// their own country should be concerned, not exact degrees. Looked up offline via
// @rapideditor/country-coder: MSH's TIP data has no country field, and sending
// OFFICIAL-classified coordinates to a third-party geocoding service isn't an option.
// This library favours size and lookup speed over precision and only loosely covers
// water, so predictions well out at sea often resolve to no country at all.
function formatLocation (tip) {
  if (!hasResolvedLocation(tip)) {
    return 'Unknown'
  }
  const longitude = normaliseLongitude(tip.longitude)
  const region = countryFeature([longitude, tip.latitude])
  return region ? region.properties.nameEn : 'No country (predicted over ocean)'
}

function sortTipsByMostRecent (tips) {
  return [...tips].sort((a, b) => new Date(b.creation_date) - new Date(a.creation_date))
}

// The API defaults to epoch=future when unspecified, which only covers objects still
// ahead of their predicted decay (2, right now) versus the full tracked population,
// epoch=all (3,696). "Tracked objects" should mean the real breadth of what's tracked,
// so epoch=all, most recent first. No date-range param exists on this endpoint, so a big
// limit is fetched once and the reporting period/display cap are applied client-side in
// selectAndCap below.
//
// This call alone takes ~1.6-1.9s uncontended (~2.5MB response), close enough to the
// client's default 4s abort budget that it's the most likely call in the app to tip over
// under concurrent load after a cold start. Given a longer timeout here instead of
// lowering the shared default.
const REENTRY_LIST_TIMEOUT_MS = 8000

async function fetchReentryListRaw () {
  return mshRequest('/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=2000', {}, REENTRY_LIST_TIMEOUT_MS)
}

// Table and map share this one fetch and slice it differently: the table caps to a
// display size, the map doesn't. Risk-flagged and UK-relevant events (see hasKnownRisk)
// are always included uncapped; only the remaining slots up to `cap` are filled by
// recency, so a busy month can return more than `cap` events. `filtered` keeps its
// original desc-by-decay_epoch order throughout.
function selectAndCap (rawEvents, { month, cap }) {
  let filtered = rawEvents
  if (month) {
    const start = startOfMonth(month)
    const end = endOfMonth(month)
    filtered = rawEvents.filter((event) => {
      if (!event.decay_epoch) return false
      const decay = new Date(event.decay_epoch)
      return decay >= start && decay <= end
    })
  }

  const selectedIds = new Set(filtered.filter(hasKnownRisk).map((event) => event.norad_id))
  for (const event of filtered) {
    if (selectedIds.size >= cap) break
    selectedIds.add(event.norad_id)
  }

  const events = filtered.filter((event) => selectedIds.has(event.norad_id))
  return {
    events,
    totalInPeriod: filtered.length,
    truncated: filtered.length > events.length
  }
}

async function fetchMonthlyTrend (months, endMonth) {
  const start = shiftMonths(endMonth, -(months - 1))
  const url = `/v1/stats/monthly/reentry-events?start_date=${toDateString(startOfMonth(start))}&end_date=${toDateString(endOfMonth(endMonth))}`
  return mshRequest(url)
}

async function fetchTipsForNoradId (noradId) {
  const tips = await mshRequest(`/v1/tips/${noradId}`)
  return Array.isArray(tips) ? tips : [tips]
}

// reentry-events almost always has estimated_mass, apogee, perigee, inclination,
// license_country and international_designator as null, but the satellite catalog record
// for the same norad_id has them populated (it's the object's permanent catalog entry).
// Best-effort: a failure here just means these fields stay "Unknown".
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

// The full satellite catalog is only 834 records, and /v1/satellites/with-metadata?limit=1000
// returns all of them in one call, ~470ms. attachLatestLocation uses this instead of
// fetchSatelliteCatalog per-object, which used to mean up to TRACKED_OBJECTS_CAP (60)
// individual calls per page load. /v1/tips/latest was checked as a bulk replacement for
// the per-object TIP call too, but it only returns the single most recent TIP
// system-wide, not one per tracked object, so no bulk equivalent exists for that half.
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

// The table shows latest predicted location as a string; the map needs the raw numbers
// too. TIP history fetch is best-effort, a failure on one object falls back to
// "Unknown"/unplottable rather than taking down the page. catalogMap is a plain lookup
// against the one shared fetchSatelliteCatalogMap fetch, not a network call.
async function attachLatestLocation (event, catalogMap) {
  const tips = await fetchTipsForNoradId(event.norad_id).catch(() => [])
  const latestTip = sortTipsByMostRecent(tips)[0]
  const catalog = catalogMap.get(String(event.norad_id)) || null

  return {
    ...event,
    estimated_mass: firstDefined(event.estimated_mass, catalog && catalog.mass),
    location: tips.length ? formatLocation(latestTip) : 'Unknown',
    latitude: latestTip ? latestTip.latitude : null,
    longitude: latestTip ? normaliseLongitude(latestTip.longitude) : null,
    risk: reentryRisk(event)
  }
}

// Shared by the table and the map, one fetch-and-enrich path. `month`/`cap` are applied
// before enrichment since each selected object costs one live TIP history call, so
// filtering first bounds that fan-out. An empty, status-flagged result comes back if the
// list itself isn't live.
//
// This page's fan-out (up to TRACKED_OBJECTS_CAP per-object TIP fetches alongside list
// and catalog calls) is the app's most likely call to hit the 4s abort timeout on a cold
// cache; capping concurrency reduces how often a first cold load comes back empty (see
// cache-warmer.js).
const TIP_FETCH_CONCURRENCY = 10

async function mapWithConcurrencyLimit (items, limit, fn) {
  const results = new Array(items.length)
  let nextIndex = 0
  async function worker () {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await fn(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

async function loadEnrichedReentryEvents ({ month, cap } = {}) {
  const listResult = await getSectionData('re-entry', { liveFetcher: fetchReentryListRaw })

  if (listResult.status !== STATUS.LIVE) {
    return { status: listResult.status, events: [], totalInPeriod: 0, truncated: false }
  }

  const { events: selectedEvents, totalInPeriod, truncated } = selectAndCap(listResult.data, { month, cap })
  const catalogMap = await tryFetchSatelliteCatalogMap()
  const events = await mapWithConcurrencyLimit(selectedEvents, TIP_FETCH_CONCURRENCY, (event) => attachLatestLocation(event, catalogMap))
  return { status: STATUS.LIVE, events, totalInPeriod, truncated }
}

// A scrollable panel rather than a page-length table needs a display cap, and each object
// enriched here costs one more live TIP call, so this bounds that fan-out too.
// objectsTruncated/objectsTotalInPeriod tell the page when the selected month holds more
// than fits on screen.
const TRACKED_OBJECTS_CAP = 60

async function buildReEntryViewModel (requestedMonth) {
  const selectedMonth = parseMonthParam(requestedMonth) || currentMonth()

  const [listResult, trendResult] = await Promise.all([
    loadEnrichedReentryEvents({ month: selectedMonth, cap: TRACKED_OBJECTS_CAP }),
    getSectionData('re-entry', { liveFetcher: () => fetchMonthlyTrend(TREND_WINDOW_MONTHS, selectedMonth) })
  ])

  const status = worstStatus(listResult.status, trendResult.status)
  const { events: enrichedEvents, totalInPeriod, truncated } = listResult
  const trendRows = trendResult.status === STATUS.LIVE ? trendResult.data : []

  // KPI tiles reflect the selected month specifically, not the whole 12-month trend
  // window behind the graph, so they can't show a bigger number than what the table below
  // is actually scoped to.
  const selectedMonthRow = trendRows.find((row) => row.month === monthKey(selectedMonth)) || null
  const periodTotalCount = selectedMonthRow ? selectedMonthRow.count : 0
  const periodAlertCount = selectedMonthRow ? selectedMonthRow.alert_count : 0

  const now = new Date()
  const rows = enrichedEvents.map((event) => ({
    objectType: bucketObjectType(event.object_type),
    isUpcoming: Boolean(event.decay_epoch) && new Date(event.decay_epoch) > now,
    risk: event.risk
  }))

  const objectTypeCounts = rows.reduce((acc, row) => {
    acc[row.objectType] = (acc[row.objectType] || 0) + 1
    return acc
  }, {})

  // Matches NSpOC's "Average Object Mass this Reporting Period" slide. Objects with no
  // mass on record (Unknown, or a literal 0) are excluded rather than counted as zero,
  // otherwise missing data would drag the average down instead of just not contributing.
  const knownMasses = enrichedEvents
    .map((event) => event.estimated_mass)
    .filter((mass) => typeof mass === 'number' && mass > 0)
  const averageMassKg = knownMasses.length
    ? Math.round(knownMasses.reduce((sum, mass) => sum + mass, 0) / knownMasses.length)
    : null

  // Risk assessment happens close to or after the decay date, so an "upcoming" object
  // with a risk rating would be unusual. Excluded so "Objects Analysed for Risk" only
  // counts already-decayed objects.
  const analysedRows = rows.filter((row) => !row.isUpcoming && row.risk !== null)

  // Matches NSpOC's "Risks to UK Interests and/or Overflights of UK or UK Overseas
  // Territories" table: an object with "None" atmospheric/fragments risk can still carry
  // a "Low" rating there, driven by uk_reentry_probability, so this combines both rather
  // than atmospheric/fragments alone. Only a genuinely elevated rating counts as a risk
  // worth listing, "None" isn't.
  const ukRiskRows = enrichedEvents
    .map((event) => ({
      objectType: bucketObjectType(event.object_type),
      objectName: event.object_name,
      mass: event.estimated_mass ? `${event.estimated_mass} kg` : 'Unknown',
      date: formatDate(event.decay_epoch),
      risk: combinedRisk(event),
      location: event.location,
      noradId: event.norad_id
    }))
    .filter((row) => isElevatedRisk(row.risk))

  // Latest month first, the current period is what you want to see immediately.
  const trend = trendRows.slice().reverse().map((row) => ({
    month: formatMonth(row.month),
    count: row.count,
    alertCount: row.alert_count
  }))

  const monthOptions = listRecentMonths(MONTH_OPTIONS_COUNT).map((month) => ({
    value: monthKey(month),
    text: monthLabel(month) + (monthKey(month) === monthKey(currentMonth()) ? ' (current)' : '')
  }))

  return {
    status,
    periodTotalCount,
    periodAlertCount,
    trend,
    trendChart: buildLineChart(trend),
    trendWindowMonths: TREND_WINDOW_MONTHS,
    selectedMonth: monthKey(selectedMonth),
    selectedMonthLabel: monthLabel(selectedMonth),
    monthOptions,
    ukRiskRows,
    objectsCap: rows.length,
    objectsTotalInPeriod: totalInPeriod,
    objectsTruncated: truncated,
    analysedCount: analysedRows.length,
    averageMassKg,
    averageMassSampleSize: knownMasses.length,
    totalCount: rows.length,
    objectTypeDonut: buildDonut(Object.entries(objectTypeCounts).map(([label, value]) => ({ label, value }))),
    mapData: buildMapData(enrichedEvents)
  }
}

async function fetchReentryByNoradId (noradId) {
  return mshRequest(`/v1/reentry-events/by-norad-id/${noradId}`)
}

// Two distinct "no event" outcomes: the live call can 404 (MSH says this norad ID doesn't
// exist, a real 404 here too), or fail some other way, e.g. timeout or 5xx (MSH is
// unreachable for what may be a real object, a "data unavailable" page, not a 404).
// MSH's by-norad-id lookup returns an HTTP error for an unknown ID rather than a 200 with
// an empty body, so the distinction comes from the caught error's status.
async function buildReEntryObjectViewModel (noradId) {
  const [detailResult, tipsResult, catalog] = await Promise.all([
    getSectionData('re-entry', { liveFetcher: () => fetchReentryByNoradId(noradId) }),
    getSectionData('re-entry', { liveFetcher: () => fetchTipsForNoradId(noradId) }),
    tryFetchSatelliteCatalog(noradId)
  ])

  if (detailResult.status === STATUS.UNAVAILABLE && detailResult.httpStatus === 404) {
    return null
  }

  const status = worstStatus(detailResult.status, tipsResult.status)

  if (status !== STATUS.LIVE) {
    return { status, noradId, notFound: false }
  }

  const event = detailResult.data

  const tips = Array.isArray(tipsResult.data) ? tipsResult.data : [tipsResult.data]
  const sortedTips = sortTipsByMostRecent(tips)
  const latestTip = sortedTips[0] || null

  // reentry-events almost never carries these catalog fields itself, fall back to the
  // object's satellite catalog record, which does.
  const mass = firstDefined(event.estimated_mass, catalog && catalog.mass)
  const apogee = firstDefined(event.apogee, catalog && catalog.apogee)
  const perigee = firstDefined(event.perigee, catalog && catalog.perigee)
  const inclination = firstDefined(event.inclination, catalog && catalog.inclination)
  const licenseCountry = firstDefined(event.license_country, event.licensed_country, catalog && catalog.license_country)
  const internationalDesignator = firstDefined(event.international_designator, catalog && catalog.international_designator)

  return {
    status: STATUS.LIVE,
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
    risk: reentryRisk(event),
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

// The map and UK risk table both need risk including MSH's uk_reentry_probability
// signal, not atmospheric/fragments alone, otherwise an object can show "Low" in the
// table while its marker on the map still reads "None" for the same object. The general
// risk figure (KPI tile, object-type donut, object detail page) stays atmospheric/
// fragments only, unaffected.
function combinedRisk (event) {
  return highestRisk(event.risk, event.uk_reentry_probability)
}

// Shared by the dedicated Re-Entry Map page (uncapped by reporting period) and the
// smaller map embedded on the Re-Entry page (scoped to the selected period), one
// marker-building path, not two.
function buildMapData (events) {
  const plottable = events.filter((event) => hasResolvedLocation(event))

  const markers = plottable.map((event) => ({
    noradId: event.norad_id,
    objectName: event.object_name,
    objectType: bucketObjectType(event.object_type),
    risk: combinedRisk(event),
    decayDate: formatDate(event.decay_epoch),
    location: event.location,
    latitude: event.latitude,
    longitude: normaliseLongitude(event.longitude)
  }))

  // Pre-serialised here (not via a template `dump` filter) with "<" escaped, so an object
  // name containing "</script>" from the live API can't break out of the script tag
  // this is embedded in.
  const mapboxData = JSON.stringify({ accessToken: mapboxConfig.accessToken, markers }).replace(/</g, '\\u003c')

  return {
    markers,
    plottedCount: markers.length,
    totalCount: events.length,
    unresolvedCount: events.length - markers.length,
    mapboxAccessToken: mapboxConfig.accessToken,
    mapboxData
  }
}

async function buildReEntryMapViewModel () {
  // No month filter, just the 30 most recent by decay date. The month selector on the
  // Re-Entry page only scopes that page's own table/map, not this one.
  const { status, events } = await loadEnrichedReentryEvents({ month: null, cap: 30 })
  return { status, ...buildMapData(events) }
}

module.exports = { buildReEntryViewModel, buildReEntryObjectViewModel, buildReEntryMapViewModel }
