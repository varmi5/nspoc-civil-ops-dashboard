const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
const { loadFixture } = require('../fixtures')
const { fetchEventsForAnalysis } = require('../msh/conjunction-analysis')
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

// /v1/conjunction-events/stats responds in ~200ms, but only via epoch=future (confirmed
// live: epoch=all and epoch=past both time out against a much larger, likely
// non-deduplicated historical archive) — meaning this is really "current tracked
// catalogue", not a month, and not a lifetime total. Made explicit in the explainer text
// and in both tile labels below. epoch is passed explicitly rather than relied on as a
// default — see the epoch lesson further up this file's history / CLAUDE.md.
async function fetchConjunctionStats () {
  return mshRequest('/v1/conjunction-events/stats?epoch=future')
}

// CORRECTED: earlier this called /v1/stats/monthly/conjunction-events, which is genuinely
// slow (15-60s+, needed a background-only fetch to avoid blocking page load — see prior
// git history). There is a SEPARATE, distinct "-aggregated" endpoint with the same
// start_date/end_date params — confirmed directly at 66-311ms including a full 12-month
// range in one call, no background-fetch workaround needed at all. It returns one row per
// month (not one row per probability-range per month) with an explicit `total` field.
//
// CAVEAT, still not resolved: this total remains far higher than the figure NSpOC's own
// real monthly report shows — but monthly volume itself is highly volatile (confirmed
// directly: June 2026 was 2,357 vs 40,000-78,000 in every surrounding month), so which
// specific month NSpOC's reference figure was for matters a lot to any comparison. Ruled
// out directly: CDM-revision duplication (zero duplicate short_ids in a 2,000-event
// sample) and a missing UK filter (91.8% of events already involve a UK-licensed object).
// Flagged honestly in the page's explainer text — treat this as real but unverified
// against NSpOC's own methodology until confirmed with the MSH/NSpOC team.
async function fetchConjunctionMonthlyTotal (month) {
  const { start, end } = dateRangeFor(month)
  const rows = await mshRequest(`/v1/stats/monthly/conjunction-events-aggregated?start_date=${start}&end_date=${end}`)
  const row = rows.find((r) => r.month === monthKey(month))
  return row ? row.total : 0
}

// Individual conjunction events carry a "user_interest" rating (Low/Medium/High), not the
// numeric probability-range field the (slow) monthly-aggregate endpoint used — same
// bucketing approach already proven on the dedicated Collision & Fragmentation page.
async function fetchConjunctionListForDonut () {
  return mshRequest('/v1/conjunction-events/?limit=100&sort_by=tca_time&sort_order=desc')
}

function bucketByInterest (event) {
  return event.user_interest || 'Unknown'
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

// A single month's total pulled from a {month, count} (or {month, alert_count}) style
// monthly-breakdown endpoint, with a real month-over-month delta computed from the same
// endpoint — not a separate, differently-scoped "lifetime" stats call.
async function buildMonthTile ({ key, sectionKey, label, href, fixturePath, fetchRows, valueField, goodWhenDown, selectedMonth }) {
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
    return { key, label, value: result.data.value, previousValue: result.data.previousValue, delta: delta.text, deltaGood: delta.deltaGood, href, isLive: true }
  }

  const fixture = loadFixture(fixturePath)
  return { key, label, value: fixture.count, previousValue: null, delta: fixture.delta, deltaGood: undefined, href, isLive: false }
}

// Takes the already-fetched conjunction-events/stats result rather than fetching itself
// — one call shared between both collision tiles, not two. No month-over-month delta:
// this is a lifetime total, not a date-ranged figure, so a delta would be meaningless —
// shown as none rather than a fabricated comparison.
function buildConjunctionStatsTile ({ key, label, href, fixturePath, valueField, statsResult }) {
  if (statsResult.isLive) {
    return { key, label, value: statsResult.data[valueField], previousValue: null, delta: null, href, isLive: true }
  }

  const fixture = loadFixture(fixturePath)
  return { key, label, value: fixture.count, previousValue: null, delta: fixture.delta, deltaGood: undefined, href, isLive: false }
}

// Mirrors buildConjunctionStatsTile above, but the live value here is already a plain
// number (fetchConjunctionMonthlyTotal has already summed the probability-range rows),
// not an object keyed by valueField. No delta: computing "vs last month" would mean a
// second background-only fetch for the previous month, doubling the slow-endpoint load
// for a comparison that isn't the point of this tile.
function buildConjunctionMonthTile ({ key, label, href, fixturePath, monthResult }) {
  if (monthResult.isLive) {
    return { key, label, value: monthResult.data, previousValue: null, delta: null, href, isLive: true }
  }

  const fixture = loadFixture(fixturePath)
  return { key, label, value: fixture.count, previousValue: null, delta: fixture.delta, deltaGood: undefined, href, isLive: false }
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
    conjunctionStatsResult,
    conjunctionListResult,
    eventsForAnalysisResult,
    conjunctionMonthTotalResult
  ] = await Promise.all([
    buildMonthTile({
      key: 'reentry-count',
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
      key: 'reentry-alerts',
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
      key: 'launches',
      sectionKey: 'launches',
      label: 'Global Launches',
      href: '/launches',
      fixturePath: 'launches/summary.json',
      fetchRows: fetchLaunchesMonthlyRows,
      valueField: 'count',
      selectedMonth
    }),
    buildMonthTile({
      key: 'fragmentation',
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
    getSectionData('collision-fragmentation', { liveFetcher: fetchConjunctionStats, fixturePath: 'collision-fragmentation/risk-count.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: fetchConjunctionListForDonut, fixturePath: 'collision-fragmentation/events.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: fetchEventsForAnalysis, fixturePath: 'collision-fragmentation/events-for-analysis.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: () => fetchConjunctionMonthlyTotal(selectedMonth), fixturePath: 'collision-fragmentation/monthly-total.json' })
  ])

  const collisionRiskTile = buildConjunctionStatsTile({
    key: 'collision-risk',
    label: 'Collision Risks to UK Satellites (current snapshot)',
    href: '/collision-fragmentation',
    fixturePath: 'collision-fragmentation/risk-count.json',
    valueField: 'conjunction_event_total_count',
    statsResult: conjunctionStatsResult
  })

  const collisionAlertTile = buildConjunctionStatsTile({
    key: 'collision-alerts',
    label: 'Collision Alerts from NSpOC (current snapshot)',
    href: '/collision-fragmentation',
    fixturePath: 'collision-fragmentation/alert-count.json',
    valueField: 'conjunction_event_alert_count',
    statsResult: conjunctionStatsResult
  })

  // The small subset that's actually crossed a probability threshold and needs a human
  // analyst, live and fast (~1-2s) — a different, narrower figure from the month-scoped
  // tile below (a current outstanding-review count, not a historical monthly total).
  const collisionAnalysisTile = {
    key: 'collision-analysis-required',
    label: 'Collision Events Requiring Analyst Review',
    value: eventsForAnalysisResult.data.length,
    previousValue: null,
    delta: null,
    href: '/collision-fragmentation',
    isLive: eventsForAnalysisResult.isLive
  }

  // The genuine month-scoped figure, via the background-only fetch above. Deliberately
  // not directly comparable to "Collision Risks to UK Satellites (current snapshot)" —
  // that's a live
  // snapshot of the current catalogue (one row per event, most-recent CDM only); this is
  // every screening recorded against the selected month specifically, across every CDM
  // revision issued that month, which is why it can be a larger number even though it's
  // "narrower" in time. Both facts are spelled out in the page's explainer text.
  const collisionMonthTile = buildConjunctionMonthTile({
    key: 'collision-month-total',
    label: 'Collision Risks (This Month)',
    href: '/collision-fragmentation',
    fixturePath: 'collision-fragmentation/monthly-total.json',
    monthResult: conjunctionMonthTotalResult
  })

  const tiles = [
    reentryCountTile,
    reentryAlertTile,
    collisionRiskTile,
    collisionAlertTile,
    collisionMonthTile,
    collisionAnalysisTile,
    {
      key: 'asteroids-count',
      label: 'Close Approach Asteroids',
      value: asteroids.closeApproachCount,
      previousValue: null,
      delta: asteroids.closeApproachDelta,
      href: '/asteroids',
      isLive: false
    },
    {
      key: 'asteroid-alerts',
      label: 'Asteroid Alerts from NSpOC',
      value: asteroids.alertCount,
      previousValue: null,
      delta: asteroids.alertDelta,
      href: '/asteroids',
      isLive: false
    },
    {
      key: 'space-weather-alerts',
      label: 'Space Weather Alerts from Met Office',
      value: spaceWeather.alertCount,
      previousValue: null,
      delta: spaceWeather.delta,
      deltaGood: true,
      href: '/space-weather',
      isLive: false
    },
    launchesTile,
    fragmentationTile,
    {
      key: 'uk-objects',
      label: 'UK Objects in Space',
      value: ukObjects.count,
      previousValue: null,
      delta: ukObjects.delta,
      href: '/resident-space-objects',
      isLive: false
    },
    {
      key: 'other-alerts',
      label: 'Other Alerts / Issues',
      value: otherAlerts.count,
      previousValue: null,
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

  const collisionDonut = conjunctionListResult.isLive
    ? buildDonut(
        Object.entries(
          conjunctionListResult.data.reduce((acc, event) => {
            const bucket = bucketByInterest(event)
            acc[bucket] = (acc[bucket] || 0) + 1
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
    previousMonthLabel: monthLabel(previousMonth),
    monthOptions,
    tiles,
    donuts: [
      { title: 'Re-Entry', chart: reentryDonut, isLive: reentryObjectTypeRows.isLive, href: '/re-entry' },
      { title: 'Collision', chart: collisionDonut, isLive: conjunctionListResult.isLive, href: '/collision-fragmentation' },
      { title: 'Asteroids', chart: buildDonutFromFixtureEntries(asteroids.donut), isLive: false, href: '/asteroids' },
      { title: 'Space Weather', chart: buildDonutFromFixtureEntries(spaceWeather.donut), isLive: false, href: '/space-weather' },
      { title: 'Service Status', chart: buildDonutFromFixtureEntries(serviceStatus.donut), isLive: false, href: null }
    ]
  }
}

module.exports = { buildMonthlyOverviewViewModel }
