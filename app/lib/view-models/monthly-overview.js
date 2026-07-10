const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
const { loadFixture } = require('../fixtures')
const {
  toDateString, startOfMonth, endOfMonth, currentMonth,
  parseMonthParam, monthKey, monthLabel, shiftMonths, listRecentMonths
} = require('../date-range')

const MONTH_OPTIONS_COUNT = 24

function computeDelta (current, previous, { goodWhenDown } = {}) {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return { text: null, deltaGood: undefined }
  }
  const diff = current - previous
  const pct = previous === 0 ? 0 : Math.round((Math.abs(diff) / previous) * 100)
  const sign = diff >= 0 ? '+' : '-'
  return {
    text: `${sign} ${Math.abs(diff)} (${pct}%)`,
    deltaGood: goodWhenDown === undefined ? undefined : (diff <= 0) === goodWhenDown
  }
}

function dateRangeFor (month) {
  return { start: toDateString(startOfMonth(month)), end: toDateString(endOfMonth(month)) }
}

function pickMonthRow (rows, month) {
  return rows.find((row) => row.month === monthKey(month)) || null
}

async function fetchReentryMonthlyRows (month) {
  const { start, end } = dateRangeFor(month)
  return mshRequest(`/v1/stats/monthly/reentry-events?start_date=${start}&end_date=${end}`)
}

async function fetchReentryByObjectTypeRows (month) {
  const { start, end } = dateRangeFor(month)
  return mshRequest(`/v1/stats/monthly/reentry-events-by-object-type?start_date=${start}&end_date=${end}`)
}

async function fetchConjunctionByRangeRows (month) {
  const { start, end } = dateRangeFor(month)
  return mshRequest(`/v1/stats/monthly/conjunction-events?start_date=${start}&end_date=${end}`)
}

async function fetchFragmentationMonthlyRows (month) {
  const { start, end } = dateRangeFor(month)
  return mshRequest(`/v1/stats/monthly/fragmentation-events?start_date=${start}&end_date=${end}`)
}

async function fetchLaunchesMonthlyRows (month) {
  const { start, end } = dateRangeFor(month)
  return mshRequest(`/v1/stats/monthly/objects-launched?start_date=${start}&end_date=${end}`)
}

function bucketObjectType (objectType) {
  const type = (objectType || '').toUpperCase()
  if (type.includes('ROCKET')) return 'Rocket Bodies'
  if (type === 'PAYLOAD') return 'Satellites'
  return 'Debris / Unknown'
}

// The API's own probability-range labels, relabelled for a non-specialist reader while
// keeping the precise technical range visible for anyone who wants it (satellite
// operators, the NSpOC team).
function labelCollisionRange (range) {
  if (range === '> 1e-3') return 'Elevated risk (>1e-3)'
  if (range === '1e-3 .. 1e-5') return 'Moderate risk (1e-3–1e-5)'
  return 'Negligible risk (<1e-5)'
}

// A single month's total pulled from a {month, count} (or {month, alert_count}) style
// monthly-breakdown endpoint, with a real month-over-month delta computed from the same
// endpoint — not a separate, differently-scoped "lifetime" stats call.
async function buildMonthTile ({ sectionKey, label, href, fixturePath, fetchRows, valueField, goodWhenDown, selectedMonth }) {
  const previous = shiftMonths(selectedMonth, -1)

  const result = await getSectionData(sectionKey, {
    liveFetcher: async () => {
      const [selectedRows, previousRows] = await Promise.all([fetchRows(selectedMonth), fetchRows(previous)])
      const selectedRow = pickMonthRow(selectedRows, selectedMonth)
      const previousRow = pickMonthRow(previousRows, previous)
      return {
        value: selectedRow ? selectedRow[valueField] : 0,
        previousValue: previousRow ? previousRow[valueField] : 0
      }
    },
    fixturePath
  })

  if (result.isLive) {
    const delta = computeDelta(result.data.value, result.data.previousValue, { goodWhenDown })
    return { label, value: result.data.value, delta: delta.text, deltaGood: delta.deltaGood, href, isLive: true }
  }

  const fixture = loadFixture(fixturePath)
  return { label, value: fixture.count, delta: fixture.delta, deltaGood: undefined, href, isLive: false }
}

// Collision figures are broken down by probability range per month, so "this month's
// total" is a sum across ranges rather than a single row. "Alerts" has no dedicated
// monthly figure from MSH — as a defensible proxy, we count only the highest-probability
// band (">1e-3") as an alert-worthy event; this is made explicit in the page's explainer
// text, not hidden in the number itself.
//
// Takes already-fetched selected/previous month results rather than fetching itself —
// the same /v1/stats/monthly/conjunction-events data is reused for both collision tiles
// and the Collision donut below, instead of re-requesting it five separate times against
// an endpoint that has been observed to respond slowly under a date-range query.
function buildCollisionTile ({ label, href, fixturePath, sumRange, selectedMonth, previousMonth, selectedResult, previousResult }) {
  if (selectedResult.isLive && previousResult.isLive) {
    const sumFor = (rows, month) => rows
      .filter((row) => row.month === monthKey(month) && (sumRange ? sumRange(row.collision_probability_range) : true))
      .reduce((sum, row) => sum + row.count, 0)
    const value = sumFor(selectedResult.data, selectedMonth)
    const previousValue = sumFor(previousResult.data, previousMonth)
    const delta = computeDelta(value, previousValue, { goodWhenDown: true })
    return { label, value, delta: delta.text, deltaGood: delta.deltaGood, href, isLive: true }
  }

  const fixture = loadFixture(fixturePath)
  return { label, value: fixture.count, delta: fixture.delta, deltaGood: undefined, href, isLive: false }
}

function buildDonutFromFixtureEntries (entries) {
  return buildDonut(entries.map((entry) => ({ label: entry.label, value: entry.value })))
}

async function buildMonthlyOverviewViewModel (requestedMonth) {
  const selectedMonth = parseMonthParam(requestedMonth) || currentMonth()
  const previousMonth = shiftMonths(selectedMonth, -1)

  const asteroids = loadFixture('asteroids/summary.json')
  const spaceWeather = loadFixture('space-weather/summary.json')
  const ukObjects = loadFixture('resident-space-objects/uk-objects.json')
  const otherAlerts = loadFixture('monthly-overview/other-alerts.json')
  const serviceStatus = loadFixture('monthly-overview/service-status.json')

  const [
    reentryCountTile,
    reentryAlertTile,
    launchesTile,
    fragmentationTile,
    reentryObjectTypeRows,
    selectedConjunctionResult,
    previousConjunctionResult
  ] = await Promise.all([
    buildMonthTile({
      sectionKey: 're-entry',
      label: 'Uncontrolled Re-Entries',
      href: '/re-entry',
      fixturePath: 're-entry/count.json',
      fetchRows: fetchReentryMonthlyRows,
      valueField: 'count',
      goodWhenDown: true,
      selectedMonth
    }),
    buildMonthTile({
      sectionKey: 're-entry',
      label: 'Re-Entry Alerts from NSpOC',
      href: '/re-entry',
      fixturePath: 're-entry/alert-count.json',
      fetchRows: fetchReentryMonthlyRows,
      valueField: 'alert_count',
      goodWhenDown: true,
      selectedMonth
    }),
    buildMonthTile({
      sectionKey: 'launches',
      label: 'Global Launches',
      href: '/launches',
      fixturePath: 'launches/summary.json',
      fetchRows: fetchLaunchesMonthlyRows,
      valueField: 'count',
      selectedMonth
    }),
    buildMonthTile({
      sectionKey: 'collision-fragmentation',
      label: 'Fragmentation Incidents',
      href: '/collision-fragmentation',
      fixturePath: 'collision-fragmentation/fragmentation-count.json',
      fetchRows: fetchFragmentationMonthlyRows,
      valueField: 'count',
      goodWhenDown: true,
      selectedMonth
    }),
    getSectionData('re-entry', { liveFetcher: () => fetchReentryByObjectTypeRows(selectedMonth), fixturePath: 're-entry/by-object-type.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: () => fetchConjunctionByRangeRows(selectedMonth), fixturePath: 'collision-fragmentation/by-range.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: () => fetchConjunctionByRangeRows(previousMonth), fixturePath: 'collision-fragmentation/by-range.json' })
  ])

  const collisionRiskTile = buildCollisionTile({
    label: 'Collision Risks to UK Satellites',
    href: '/collision-fragmentation',
    fixturePath: 'collision-fragmentation/risk-count.json',
    selectedMonth,
    previousMonth,
    selectedResult: selectedConjunctionResult,
    previousResult: previousConjunctionResult
  })

  const collisionAlertTile = buildCollisionTile({
    label: 'Collision Alerts from NSpOC',
    href: '/collision-fragmentation',
    fixturePath: 'collision-fragmentation/alert-count.json',
    sumRange: (range) => range === '> 1e-3',
    selectedMonth,
    previousMonth,
    selectedResult: selectedConjunctionResult,
    previousResult: previousConjunctionResult
  })

  const tiles = [
    reentryCountTile,
    reentryAlertTile,
    collisionRiskTile,
    collisionAlertTile,
    {
      label: 'Close Approach Asteroids',
      value: asteroids.closeApproachCount,
      delta: asteroids.closeApproachDelta,
      href: '/asteroids',
      isLive: false
    },
    {
      label: 'Asteroid Alerts from NSpOC',
      value: asteroids.alertCount,
      delta: asteroids.alertDelta,
      href: '/asteroids',
      isLive: false
    },
    {
      label: 'Space Weather Alerts from Met Office',
      value: spaceWeather.alertCount,
      delta: spaceWeather.delta,
      deltaGood: true,
      href: '/space-weather',
      isLive: false
    },
    launchesTile,
    fragmentationTile,
    {
      label: 'UK Objects in Space',
      value: ukObjects.count,
      delta: ukObjects.delta,
      href: '/resident-space-objects',
      isLive: false
    },
    {
      label: 'Other Alerts / Issues',
      value: otherAlerts.count,
      delta: otherAlerts.delta,
      isLive: false
    }
  ]

  const reentryDonut = reentryObjectTypeRows.isLive
    ? buildDonut(
        Object.entries(
          reentryObjectTypeRows.data
            .filter((row) => row.month === monthKey(selectedMonth))
            .reduce((acc, row) => {
              const bucket = bucketObjectType(row.object_type)
              acc[bucket] = (acc[bucket] || 0) + row.count
              return acc
            }, {})
        ).map(([label, value]) => ({ label, value }))
      )
    : buildDonut([{ label: 'No data available this reporting period', value: 1 }])

  const collisionDonut = selectedConjunctionResult.isLive
    ? buildDonut(
        Object.entries(
          selectedConjunctionResult.data
            .filter((row) => row.month === monthKey(selectedMonth))
            .reduce((acc, row) => {
              const bucket = labelCollisionRange(row.collision_probability_range)
              acc[bucket] = (acc[bucket] || 0) + row.count
              return acc
            }, {})
        ).map(([label, value]) => ({ label, value }))
      )
    : buildDonut([{ label: 'No data available this reporting period', value: 1 }])

  const monthOptions = listRecentMonths(MONTH_OPTIONS_COUNT).map((month) => ({
    value: monthKey(month),
    text: monthLabel(month) + (monthKey(month) === monthKey(currentMonth()) ? ' (current)' : '')
  }))

  return {
    selectedMonth: monthKey(selectedMonth),
    selectedMonthLabel: monthLabel(selectedMonth),
    monthOptions,
    tiles,
    donuts: [
      { title: 'Re-Entry', chart: reentryDonut, isLive: reentryObjectTypeRows.isLive, href: '/re-entry' },
      { title: 'Collision', chart: collisionDonut, isLive: selectedConjunctionResult.isLive, href: '/collision-fragmentation' },
      { title: 'Asteroids', chart: buildDonutFromFixtureEntries(asteroids.donut), isLive: false, href: '/asteroids' },
      { title: 'Space Weather', chart: buildDonutFromFixtureEntries(spaceWeather.donut), isLive: false, href: '/space-weather' },
      { title: 'Service Status', chart: buildDonutFromFixtureEntries(serviceStatus.donut), isLive: false, href: null }
    ]
  }
}

module.exports = { buildMonthlyOverviewViewModel }
