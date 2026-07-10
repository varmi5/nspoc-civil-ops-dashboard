const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
const { highestRisk } = require('../format-risk')
const { formatDate, formatDateTime, formatMonth } = require('../format-date')
const { toDateString, startOfMonth, endOfMonth, currentMonth, shiftMonths } = require('../date-range')

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

// MSH returns longitude in a mix of -180..180 and 0..360 conventions depending on the
// source feed — normalise to -180..180 before working out the compass direction, so a
// value like 257 doesn't render as the nonstandard "257.0°E" instead of "103.0°W".
function normaliseLongitude (longitude) {
  let value = longitude % 360
  if (value > 180) value -= 360
  if (value < -180) value += 360
  return value
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

// The list page shows the latest predicted location per object. Fetching each object's
// TIP history is best-effort — a failure on one object's TIP lookup shouldn't take down
// the whole table, it just falls back to "Unknown" for that row.
async function attachLatestLocation (event, listIsLive) {
  if (!listIsLive) {
    return { ...event, location: 'Unknown' }
  }
  try {
    const tips = await fetchTipsForNoradId(event.norad_id)
    const latestTip = sortTipsByMostRecent(tips)[0]
    return { ...event, location: formatLocation(latestTip) }
  } catch (err) {
    return { ...event, location: 'Unknown' }
  }
}

async function buildReEntryViewModel (requestedMonths) {
  const months = resolveTrendPeriod(requestedMonths)

  const [listResult, trendResult] = await Promise.all([
    getSectionData('re-entry', { liveFetcher: fetchReentryList, fixturePath: 're-entry/objects.json' }),
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

  const enrichedEvents = await Promise.all(
    listResult.data.map((event) => attachLatestLocation(event, listResult.isLive))
  )

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
    isLive: listResult.isLive && trendResult.isLive,
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
  const [detailResult, tipsResult] = await Promise.all([
    getSectionData('re-entry', {
      liveFetcher: () => fetchReentryByNoradId(noradId),
      fixturePath: 're-entry/tip/starlink-1735.json'
    }),
    getSectionData('re-entry', {
      liveFetcher: () => fetchTipsForNoradId(noradId),
      fixturePath: 're-entry/tip/starlink-1735-history.json'
    })
  ])

  const event = detailResult.data
  const tips = Array.isArray(tipsResult.data) ? tipsResult.data : [tipsResult.data]
  const sortedTips = sortTipsByMostRecent(tips)
  const latestTip = sortedTips[0] || null

  if (!event) {
    return null
  }

  return {
    isLive: detailResult.isLive && tipsResult.isLive,
    noradId,
    objectName: event.object_name,
    objectType: bucketObjectType(event.object_type),
    licenseCountry: event.license_country || event.licensed_country || 'Unknown',
    internationalDesignator: event.international_designator || 'Unknown',
    mass: event.estimated_mass ? `${event.estimated_mass} kg` : 'Unknown',
    apogee: event.apogee ? `${event.apogee} km` : 'Unknown',
    perigee: event.perigee ? `${event.perigee} km` : 'Unknown',
    inclination: event.inclination !== null && event.inclination !== undefined ? `${event.inclination}°` : 'Unknown',
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

module.exports = { buildReEntryViewModel, buildReEntryObjectViewModel }
