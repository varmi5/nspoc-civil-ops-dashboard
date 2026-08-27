const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
const { buildLineChart } = require('../charts/line-chart')
const { STATUS, worstStatus } = require('../msh/status')
const { formatDateTime, formatMonth } = require('../format-date')
const {
  toDateString, startOfMonth, endOfMonth, currentMonth, shiftMonths,
  monthKey, monthLabel, parseMonthParam, listRecentMonths
} = require('../date-range')
const { ANALYSIS_THRESHOLD } = require('../msh/conjunction-analysis')

// Trend charts always show a fixed 12-month window ending at the selected reporting
// month, matching NSpOC's own chart. Not user-choosable (that's the separate
// fragmentation-incidents table selector below), it's fixed so the shape stays predictable.
const TREND_WINDOW_MONTHS = 12
const MONTH_OPTIONS_COUNT = 24

const ALLOWED_FRAGMENTATION_LOOKBACK = [1, 3, 6, 12, 24]
const DEFAULT_FRAGMENTATION_LOOKBACK = 12

function resolveFragmentationLookback (requested) {
  const parsed = Number(requested)
  return ALLOWED_FRAGMENTATION_LOOKBACK.includes(parsed) ? parsed : DEFAULT_FRAGMENTATION_LOOKBACK
}

// epoch=all + a generous limit, same pattern as re-entry's fetchReentryListRaw. Real
// fragmentation incidents are rare (single digits a year), so unlike conjunction events
// (tens of thousands a month) this list is small enough to filter by month client-side.
async function fetchFragmentationListRaw () {
  return mshRequest('/v1/fragmentation-events/?epoch=all&limit=200&sort_by=event_epoch&sort_order=desc')
}

async function fetchConjunctionMonthlyAggregated (months, endMonth) {
  const start = shiftMonths(endMonth, -(months - 1))
  return mshRequest(`/v1/stats/monthly/conjunction-events-aggregated?start_date=${toDateString(startOfMonth(start))}&end_date=${toDateString(endOfMonth(endMonth))}`)
}

async function fetchFragmentationMonthlyRows (months, endMonth) {
  const start = shiftMonths(endMonth, -(months - 1))
  return mshRequest(`/v1/stats/monthly/fragmentation-events?start_date=${toDateString(startOfMonth(start))}&end_date=${toDateString(endOfMonth(endMonth))}`)
}

// Neither monthly-breakdown endpoint returns a zero-filled calendar (a 12-month
// fragmentation request can come back with only 2 rows). Fill the gaps so the trend
// always shows one point per month, anchored at `endMonth` not "today".
function fillMonthlySeries (rows, months, endMonth) {
  const byMonth = rows.reduce((acc, row) => {
    acc[row.month] = (acc[row.month] || 0) + row.count
    return acc
  }, {})
  return listRecentMonths(months, endMonth)
    .slice()
    .reverse()
    .map((month) => {
      const key = monthKey(month)
      return { month: key, count: byMonth[key] || 0 }
    })
}

// Conjunction rows carry a probability-band breakdown, not a single count. The raw
// monthly total (tens of thousands of screenings) is dropped, it runs so far from
// NSpOC's reported figure that it reads as simply wrong. The "> 1e-3" band (screenings
// past the analysis threshold) is shown instead, as the closest proxy for NSpOC's
// "Alerts Issued" line (MSH has no literal alerts concept for conjunctions).
function fillConjunctionMonthlySeries (rows, months, endMonth) {
  const byMonth = rows.reduce((acc, row) => {
    acc[row.month] = row['> 1e-3'] || 0
    return acc
  }, {})
  return listRecentMonths(months, endMonth)
    .slice()
    .reverse()
    .map((month) => {
      const key = monthKey(month)
      return { month: key, count: byMonth[key] || 0 }
    })
}

function eventFallsInMonth (event, dateField, month) {
  if (!event[dateField]) return false
  const date = new Date(event[dateField])
  return date.getFullYear() === month.year && date.getMonth() === month.month
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

async function buildCollisionFragmentationViewModel (requestedMonth, requestedFragmentationMonths) {
  const selectedMonth = parseMonthParam(requestedMonth) || currentMonth()
  const fragmentationLookback = resolveFragmentationLookback(requestedFragmentationMonths)

  const [
    fragmentationListResult,
    conjunctionAggregatedResult,
    fragmentationTrendResult
  ] = await Promise.all([
    getSectionData('collision-fragmentation', { liveFetcher: fetchFragmentationListRaw }),
    getSectionData('collision-fragmentation', { liveFetcher: () => fetchConjunctionMonthlyAggregated(TREND_WINDOW_MONTHS, selectedMonth) }),
    getSectionData('collision-fragmentation', { liveFetcher: () => fetchFragmentationMonthlyRows(TREND_WINDOW_MONTHS, selectedMonth) })
  ])

  const aggregatedRows = conjunctionAggregatedResult.status === STATUS.LIVE ? conjunctionAggregatedResult.data : []
  const fragTrendRows = fragmentationTrendResult.status === STATUS.LIVE ? fragmentationTrendResult.data : []

  const fragmentationEvents = fragmentationListResult.status === STATUS.LIVE ? fragmentationListResult.data : []
  const fragmentationRows = fragmentationEvents
    .filter((event) => {
      const cutoff = startOfMonth(shiftMonths(currentMonth(), -(fragmentationLookback - 1)))
      return !event.event_epoch || new Date(event.event_epoch) >= cutoff
    })
    .map(buildFragmentationRow)

  // Latest month first, matches re-entry's convention (buildLineChart re-reverses to
  // chronological for plotting).
  const rawTrend = fillConjunctionMonthlySeries(aggregatedRows, TREND_WINDOW_MONTHS, selectedMonth).slice().reverse()
  const rawFragmentationTrend = fillMonthlySeries(fragTrendRows, TREND_WINDOW_MONTHS, selectedMonth).slice().reverse()
  const trend = rawTrend.map((row) => ({ month: formatMonth(row.month), count: row.count }))
  const fragmentationTrend = rawFragmentationTrend.map((row) => ({ month: formatMonth(row.month), count: row.count }))

  const selectedAggregatedRow = aggregatedRows.find((row) => row.month === monthKey(selectedMonth)) || null
  const riskDonut = conjunctionAggregatedResult.status === STATUS.LIVE
    ? buildDonut([
        { label: `Low (< 1e-5)`, value: selectedAggregatedRow ? selectedAggregatedRow['< 1e-5'] : 0 },
        { label: `Medium (1e-5 to 1e-3)`, value: selectedAggregatedRow ? selectedAggregatedRow['1e-3 .. 1e-5'] : 0 },
        { label: `High (> 1e-3)`, value: selectedAggregatedRow ? selectedAggregatedRow['> 1e-3'] : 0 }
      ])
    : buildDonut([])

  const fragTypeCountsThisMonth = fragmentationEvents
    .filter((event) => eventFallsInMonth(event, 'event_epoch', selectedMonth))
    .reduce((acc, event) => {
      const type = event.fragmentation_type || 'Unknown'
      acc[type] = (acc[type] || 0) + 1
      return acc
    }, {})
  const fragTypeDonut = fragmentationListResult.status === STATUS.LIVE
    ? buildDonut(Object.entries(fragTypeCountsThisMonth).map(([label, value]) => ({ label, value })))
    : buildDonut([])

  const monthOptions = listRecentMonths(MONTH_OPTIONS_COUNT).map((month) => ({
    value: monthKey(month),
    text: monthLabel(month) + (monthKey(month) === monthKey(currentMonth()) ? ' (current)' : '')
  }))

  return {
    status: worstStatus(
      fragmentationListResult.status,
      conjunctionAggregatedResult.status,
      fragmentationTrendResult.status
    ),
    selectedMonth: monthKey(selectedMonth),
    selectedMonthLabel: monthLabel(selectedMonth),
    monthOptions,
    trend,
    fragmentationTrend,
    trendChart: buildLineChart(trend),
    fragmentationTrendChart: buildLineChart(fragmentationTrend),
    trendWindowMonths: TREND_WINDOW_MONTHS,
    analysisThreshold: ANALYSIS_THRESHOLD.toExponential(0),
    fragmentationRows,
    fragmentationLookbackMonths: fragmentationLookback,
    fragmentationLookbackPeriods: ALLOWED_FRAGMENTATION_LOOKBACK,
    fragmentationTotalInLookback: fragmentationRows.length,
    riskDonut,
    riskDonutStatus: conjunctionAggregatedResult.status,
    fragTypeDonut,
    fragTypeDonutStatus: fragmentationListResult.status
  }
}

module.exports = { buildCollisionFragmentationViewModel }
