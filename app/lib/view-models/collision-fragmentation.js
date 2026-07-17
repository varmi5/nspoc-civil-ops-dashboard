const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
const { buildBarChart } = require('../charts/bar-chart')
const { formatDateTime, formatMonth } = require('../format-date')
const { toDateString, startOfMonth, endOfMonth, currentMonth, shiftMonths, monthKey, listRecentMonths } = require('../date-range')
const { ANALYSIS_THRESHOLD, fetchEventsForAnalysis } = require('../msh/conjunction-analysis')

const ALLOWED_TREND_PERIODS = [1, 3, 6, 12, 24]
const DEFAULT_TREND_PERIOD = 12

function resolveTrendPeriod (requestedMonths) {
  const parsed = Number(requestedMonths)
  return ALLOWED_TREND_PERIODS.includes(parsed) ? parsed : DEFAULT_TREND_PERIOD
}

// Individual conjunction events carry a "user_interest" field (Low/Medium/High), unlike
// the separate monthly-aggregate endpoint, which is instead broken down by a numeric
// collision_probability_range — different shape, same underlying idea. Bucketing
// per-event by user_interest is what's actually available on each list row.
function bucketByInterest (event) {
  return event.user_interest || 'Unknown'
}

async function fetchConjunctionList () {
  return mshRequest('/v1/conjunction-events/?limit=100&sort_by=tca_time&sort_order=desc')
}

async function fetchFragmentationList () {
  return mshRequest('/v1/fragmentation-events/?epoch=all&limit=100&sort_by=event_epoch&sort_order=desc')
}

// Both monthly-breakdown endpoints only return rows for months that actually had
// something happen — not a zero-filled calendar (confirmed: fragmentation incidents are
// rare enough that a 12-month request can come back with a single row). Fill the gaps so
// the trend strip always shows one card per requested month, with real zeroes rather
// than missing months.
function fillMonthlySeries (rows, months) {
  const byMonth = rows.reduce((acc, row) => {
    acc[row.month] = (acc[row.month] || 0) + row.count
    return acc
  }, {})
  return listRecentMonths(months)
    .slice()
    .reverse()
    .map((month) => {
      const key = monthKey(month)
      return { month: key, count: byMonth[key] || 0 }
    })
}

// CORRECTED: this was calling /v1/stats/monthly/conjunction-events (genuinely slow,
// 15-60s+, needed a background-only fetch). There's a separate "-aggregated" endpoint
// with the same params, confirmed directly at 66-311ms including a full 12-month range
// in a single call — no background-fetch workaround needed. Returns one row per month
// with an explicit `total` (not one row per probability-range needing summation).
//
// CAVEAT, not resolved: totals here still run far higher than NSpOC's own reported
// monthly figure — but monthly volume is itself highly volatile (June 2026 measured at
// 2,357 vs 40,000-78,000 in every surrounding month), so which month NSpOC's reference
// was for matters. Ruled out directly: CDM-revision duplication and a missing UK filter
// (see monthly-overview.js's fetchConjunctionMonthlyTotal for the full investigation).
// Treat as real but unverified against NSpOC's own methodology.
async function fetchConjunctionMonthlyTrend (months) {
  const end = currentMonth()
  const start = shiftMonths(end, -(months - 1))
  const rows = await mshRequest(`/v1/stats/monthly/conjunction-events-aggregated?start_date=${toDateString(startOfMonth(start))}&end_date=${toDateString(endOfMonth(end))}`)
  return fillMonthlySeries(rows.map((row) => ({ month: row.month, count: row.total })), months)
}

async function fetchFragmentationMonthlyTrend (months) {
  const end = currentMonth()
  const start = shiftMonths(end, -(months - 1))
  const rows = await mshRequest(`/v1/stats/monthly/fragmentation-events?start_date=${toDateString(startOfMonth(start))}&end_date=${toDateString(endOfMonth(end))}`)
  return fillMonthlySeries(rows, months)
}

async function fetchFragmentationByType () {
  return mshRequest('/v1/stats/fragmentation-events/by-fragmentation-type')
}

// /for-analysis rows carry a real collision_probability and each object's physical
// details inline — a genuinely different, richer shape from the general list, not
// interchangeable with buildCollisionRow below.
function buildAnalysisRow (event) {
  return {
    primaryObject: event.primary_object_common_name || 'Unknown',
    secondaryObject: event.secondary_object_common_name || 'Unknown',
    closestApproach: formatDateTime(event.tca_time),
    missDistance: event.miss_distance !== null && event.miss_distance !== undefined ? `${event.miss_distance} m` : 'Unknown',
    collisionProbability: event.collision_probability !== null && event.collision_probability !== undefined
      ? event.collision_probability.toExponential(2)
      : 'Unknown',
    primaryMass: event.primary_object_mass ? `${event.primary_object_mass} kg` : 'Unknown',
    secondaryMass: event.secondary_object_mass ? `${event.secondary_object_mass} kg` : 'Unknown'
  }
}

function buildFragmentationRow (event) {
  return {
    shortId: event.short_id,
    primaryObject: event.primary_object_common_name || 'Unknown',
    date: formatDateTime(event.event_epoch),
    fragmentationType: event.fragmentation_type || 'Unknown',
    modelledFragments: event.modelled_fragments,
    knownFragments: event.known_fragments,
    risk: event.risk || null
  }
}

async function buildCollisionFragmentationViewModel (requestedMonths) {
  const months = resolveTrendPeriod(requestedMonths)

  const [
    conjunctionListResult,
    eventsForAnalysisResult,
    fragmentationListResult,
    conjunctionTrendResult,
    fragmentationTrendResult,
    fragmentationByTypeResult
  ] = await Promise.all([
    getSectionData('collision-fragmentation', { liveFetcher: fetchConjunctionList, fixturePath: 'collision-fragmentation/events.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: fetchEventsForAnalysis, fixturePath: 'collision-fragmentation/events-for-analysis.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: fetchFragmentationList, fixturePath: 'collision-fragmentation/fragmentation-events.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: () => fetchConjunctionMonthlyTrend(months), fixturePath: 'collision-fragmentation/trend.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: () => fetchFragmentationMonthlyTrend(months), fixturePath: 'collision-fragmentation/fragmentation-trend.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: fetchFragmentationByType, fixturePath: 'collision-fragmentation/by-fragmentation-type.json' })
  ])

  const trendRows = conjunctionTrendResult.isLive ? conjunctionTrendResult.data : conjunctionTrendResult.data.slice(-months)
  const fragTrendRows = fragmentationTrendResult.isLive ? fragmentationTrendResult.data : fragmentationTrendResult.data.slice(-months)

  const analysisRows = eventsForAnalysisResult.data.map(buildAnalysisRow)
  const fragmentationRows = fragmentationListResult.data.map(buildFragmentationRow)

  const riskCounts = conjunctionListResult.data.reduce((acc, event) => {
    const bucket = bucketByInterest(event)
    acc[bucket] = (acc[bucket] || 0) + 1
    return acc
  }, {})
  const riskDonut = buildDonut(Object.entries(riskCounts).map(([label, value]) => ({ label, value })))

  const fragTypeDonut = buildDonut(
    fragmentationByTypeResult.data.map((row) => ({ label: row.fragmentation_type, value: row.count }))
  )

  // Latest month first — the current/most recent period is what you want to see
  // immediately, not after scrolling right past everything older. The bar chart uses the
  // same latest-first order/data as the cards (buildBarChart just plots whatever order
  // it's given), so switching views never reorders anything underneath the reader.
  const trend = trendRows.slice().reverse().map((row) => ({ month: formatMonth(row.month), count: row.count }))
  const fragmentationTrend = fragTrendRows.slice().reverse().map((row) => ({ month: formatMonth(row.month), count: row.count }))

  return {
    isLive: conjunctionListResult.isLive && fragmentationListResult.isLive && conjunctionTrendResult.isLive && fragmentationTrendResult.isLive,
    trend,
    fragmentationTrend,
    trendChart: buildBarChart(trend),
    fragmentationTrendChart: buildBarChart(fragmentationTrend),
    trendMonths: months,
    trendPeriods: ALLOWED_TREND_PERIODS,
    collisionCount: conjunctionListResult.data.length,
    collisionCountIsLive: conjunctionListResult.isLive,
    reportedCount: conjunctionListResult.data.filter((event) => event.report_number !== null && event.report_number !== undefined).length,
    requiresAnalysisCount: eventsForAnalysisResult.data.length,
    requiresAnalysisIsLive: eventsForAnalysisResult.isLive,
    analysisThreshold: ANALYSIS_THRESHOLD.toExponential(0),
    fragmentationCount: fragmentationListResult.data.length,
    fragmentationCountIsLive: fragmentationListResult.isLive,
    analysisRows,
    fragmentationRows,
    riskDonut,
    fragTypeDonut
  }
}

module.exports = { buildCollisionFragmentationViewModel }
