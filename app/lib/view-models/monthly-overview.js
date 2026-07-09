const { getSectionData } = require('../msh/get-section-data')
const { mshRequest } = require('../msh/client')
const { buildDonut } = require('../charts/donut')
const { loadFixture } = require('../fixtures')

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

async function fetchReentryStats () {
  return mshRequest('/v1/reentry-events/stats')
}

async function fetchReentryMonthlyTrend () {
  const rows = await mshRequest('/v1/stats/monthly/reentry-events')
  return rows.slice(-2)
}

async function fetchReentryListForDonut () {
  return mshRequest('/v1/reentry-events/')
}

async function fetchConjunctionStats () {
  return mshRequest('/v1/conjunction-events/stats')
}

async function fetchConjunctionListForDonut () {
  return mshRequest('/v1/conjunction-events/')
}

async function fetchFragmentationCount () {
  const list = await mshRequest('/v1/fragmentation-events/')
  return { count: list.length }
}

async function fetchLaunchesMonthlyTrend () {
  const rows = await mshRequest('/v1/stats/monthly/objects-launched')
  return rows.slice(-2)
}

// Most reentry events are still pending analyst review (risk fields null) — the honest
// default bucket is "No risk to Earth" rather than forcing every unassessed event into a
// more alarming category. UK-interest and Earth-impact buckets only apply once an analyst
// has actually flagged something.
function bucketReentryRisk (event) {
  if (event.uk_reentry_probability !== null && event.uk_reentry_probability !== undefined && event.uk_reentry_probability > 0) {
    return 'Risk to UK interests'
  }
  if (event.atmospheric_risk !== null && event.atmospheric_risk !== undefined) {
    return 'Earth Impact Risk'
  }
  return 'No risk to Earth'
}

function bucketCollisionRisk (event) {
  if (event.report_number !== null && event.report_number !== undefined) {
    return 'Events Reported to UK Government'
  }
  if (event.additional_analysis !== null && event.additional_analysis !== undefined) {
    return 'Events Requiring Additional Analysis'
  }
  return 'Low Risk Collision Probability'
}

function buildDonutFromBucketed (items, bucketFn) {
  const counts = items.reduce((acc, item) => {
    const bucket = bucketFn(item)
    acc[bucket] = (acc[bucket] || 0) + 1
    return acc
  }, {})
  return buildDonut(Object.entries(counts).map(([label, value]) => ({ label, value })))
}

function buildDonutFromFixtureEntries (entries) {
  return buildDonut(entries.map((entry) => ({ label: entry.label, value: entry.value })))
}

async function buildMonthlyOverviewViewModel () {
  const [
    reentryStatsResult,
    reentryTrendResult,
    reentryListResult,
    conjunctionStatsResult,
    conjunctionListResult,
    fragmentationCountResult,
    launchesTrendResult
  ] = await Promise.all([
    getSectionData('re-entry', { liveFetcher: fetchReentryStats, fixturePath: 're-entry/summary.json' }),
    getSectionData('re-entry', { liveFetcher: fetchReentryMonthlyTrend, fixturePath: 're-entry/trend.json' }),
    getSectionData('re-entry', { liveFetcher: fetchReentryListForDonut, fixturePath: 're-entry/objects.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: fetchConjunctionStats, fixturePath: 'collision-fragmentation/summary.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: fetchConjunctionListForDonut, fixturePath: 'collision-fragmentation/events.json' }),
    getSectionData('collision-fragmentation', { liveFetcher: fetchFragmentationCount, fixturePath: 'collision-fragmentation/fragmentation-count.json' }),
    getSectionData('launches', { liveFetcher: fetchLaunchesMonthlyTrend, fixturePath: 'launches/summary.json' })
  ])

  const asteroids = loadFixture('asteroids/summary.json')
  const spaceWeather = loadFixture('space-weather/summary.json')
  const ukObjects = loadFixture('resident-space-objects/uk-objects.json')
  const otherAlerts = loadFixture('monthly-overview/other-alerts.json')
  const serviceStatus = loadFixture('monthly-overview/service-status.json')

  const reentryTrend = Array.isArray(reentryTrendResult.data) ? reentryTrendResult.data : []
  const reentryPrev = reentryTrend[0]
  const reentryLatest = reentryTrend[1]
  const reentryCountDelta = reentryPrev && reentryLatest
    ? computeDelta(reentryLatest.count, reentryPrev.count, { goodWhenDown: true })
    : { text: null }
  const reentryAlertDelta = reentryPrev && reentryLatest
    ? computeDelta(reentryLatest.alert_count, reentryPrev.alert_count, { goodWhenDown: true })
    : { text: null }

  const launchesTrend = Array.isArray(launchesTrendResult.data) ? launchesTrendResult.data : []
  const launchesPrev = launchesTrend[0]
  const launchesLatest = launchesTrend[1]
  const launchesCount = launchesLatest ? launchesLatest.count : (loadFixture('launches/summary.json').count)
  const launchesDelta = launchesPrev && launchesLatest
    ? computeDelta(launchesLatest.count, launchesPrev.count, {})
    : { text: loadFixture('launches/summary.json').delta }

  const tiles = [
    {
      label: 'Uncontrolled Re-Entries',
      value: reentryStatsResult.data.reentry_event_total_count,
      delta: reentryCountDelta.text,
      deltaGood: reentryCountDelta.deltaGood,
      href: '/re-entry',
      isLive: reentryStatsResult.isLive && reentryTrendResult.isLive
    },
    {
      label: 'Re-Entry Alerts from NSpOC',
      value: reentryStatsResult.data.reentry_event_alert_count,
      delta: reentryAlertDelta.text,
      deltaGood: reentryAlertDelta.deltaGood,
      href: '/re-entry',
      isLive: reentryStatsResult.isLive && reentryTrendResult.isLive
    },
    {
      label: 'Collision Risks to UK Satellites',
      value: conjunctionStatsResult.data.conjunction_event_total_count,
      href: '/collision-fragmentation',
      isLive: conjunctionStatsResult.isLive
    },
    {
      label: 'Collision Alerts from NSpOC',
      value: conjunctionStatsResult.data.conjunction_event_alert_count,
      href: '/collision-fragmentation',
      isLive: conjunctionStatsResult.isLive
    },
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
    {
      label: 'Global Launches',
      value: launchesCount,
      delta: launchesDelta.text,
      href: '/launches',
      isLive: launchesTrendResult.isLive
    },
    {
      label: 'Fragmentation Incidents',
      value: fragmentationCountResult.data.count,
      href: '/collision-fragmentation',
      isLive: fragmentationCountResult.isLive
    },
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

  const reentryDonut = reentryListResult.isLive
    ? buildDonutFromBucketed(reentryListResult.data, bucketReentryRisk)
    : buildDonut([{ label: 'No risk to Earth', value: 1 }])

  const collisionDonut = conjunctionListResult.isLive
    ? buildDonutFromBucketed(conjunctionListResult.data, bucketCollisionRisk)
    : buildDonut([{ label: 'Low Risk Collision Probability', value: 1 }])

  return {
    tiles,
    donuts: [
      { title: 'Re-Entry', chart: reentryDonut, isLive: reentryListResult.isLive, href: '/re-entry' },
      { title: 'Collision', chart: collisionDonut, isLive: conjunctionListResult.isLive, href: '/collision-fragmentation' },
      { title: 'Asteroids', chart: buildDonutFromFixtureEntries(asteroids.donut), isLive: false, href: '/asteroids' },
      { title: 'Space Weather', chart: buildDonutFromFixtureEntries(spaceWeather.donut), isLive: false, href: '/space-weather' },
      { title: 'Service Status', chart: buildDonutFromFixtureEntries(serviceStatus.donut), isLive: false, href: null }
    ]
  }
}

module.exports = { buildMonthlyOverviewViewModel }
