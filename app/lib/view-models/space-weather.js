const { fetchAlerts } = require('../space-weather/client')
const { parseAlert } = require('../space-weather/parse-alert')
const { sectorStatusesForDay, SECTORS, SECTOR_LABELS } = require('../space-weather/sector-rules')
const spaceWeatherConfig = require('../space-weather/config')
const { isSectionLiveCapable } = require('../msh/data-source')
const { STATUS } = require('../msh/status')
const { currentMonth, parseMonthParam, monthKey, monthLabel, listRecentMonths } = require('../date-range')

const MONTH_OPTIONS_COUNT = 24

// Mirrors getSectionData's live/status contract but isn't MSH. NOAA needs no credentials
// and isn't gated by USE_LIVE_MSH, so it gets its own small equivalent.
function isConfiguredForLive () {
  return isSectionLiveCapable('space-weather') && spaceWeatherConfig.useLiveSpaceWeather
}

async function getAlerts () {
  if (!isConfiguredForLive()) {
    return { data: null, status: STATUS.NOT_CONNECTED }
  }
  try {
    const data = await fetchAlerts()
    return { data, status: STATUS.LIVE }
  } catch (err) {
    console.error(`Space weather live fetch failed: ${err.message}`)
    return { data: null, status: STATUS.UNAVAILABLE }
  }
}

// NOAA's issue_datetime is UTC (no timezone marker, but SWPC's docs and the values
// confirm it), and alert.issueDate (parse-alert.js) is a plain substring of that string,
// not a parsed Date. Days here are built and keyed entirely in UTC to match, mixing in
// local-timezone getters (as date-range.js and format-date.js correctly do elsewhere)
// would silently shift a day's alerts onto the wrong row on a non-UK-timezone server.
function daysInUtcMonth (month) {
  return new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate()
}

function listDaysInMonth (month) {
  const total = daysInUtcMonth(month)
  const days = []
  for (let day = 1; day <= total; day++) {
    days.push(new Date(Date.UTC(month.year, month.month, day)))
  }
  return days
}

function utcDateKey (date) {
  return date.toISOString().slice(0, 10)
}

function formatUtcDate (date) {
  const day = String(date.getUTCDate()).padStart(2, '0')
  const monthName = date.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })
  const year = String(date.getUTCFullYear()).slice(-2)
  return `${day}-${monthName}-${year}`
}

async function buildSpaceWeatherViewModel (monthParam) {
  const month = parseMonthParam(monthParam) || currentMonth()
  const { data: rawAlerts, status } = await getAlerts()

  const parsedAlerts = status === STATUS.LIVE ? rawAlerts.map(parseAlert).filter(Boolean) : []
  const alertsByDay = parsedAlerts.reduce((acc, alert) => {
    (acc[alert.issueDate] = acc[alert.issueDate] || []).push(alert)
    return acc
  }, {})

  const rows = listDaysInMonth(month).map((date) => {
    const dayAlerts = alertsByDay[utcDateKey(date)] || []
    const statuses = sectorStatusesForDay(dayAlerts)
    return {
      date: formatUtcDate(date),
      alertCount: dayAlerts.length,
      sectors: SECTORS.map((key) => ({ key, label: SECTOR_LABELS[key], status: statuses[key] }))
    }
  })

  const worstStatusCounts = rows.reduce((acc, row) => {
    row.sectors.forEach(({ status }) => {
      if (status !== 'Green') acc[status] = (acc[status] || 0) + 1
    })
    return acc
  }, {})

  const monthOptions = listRecentMonths(MONTH_OPTIONS_COUNT).map((m) => ({
    value: monthKey(m),
    text: monthLabel(m) + (monthKey(m) === monthKey(currentMonth()) ? ' (current)' : '')
  }))

  return {
    status,
    monthKeyValue: monthKey(month),
    monthLabel: monthLabel(month),
    monthOptions,
    sectorLabels: SECTORS.map((key) => SECTOR_LABELS[key]),
    rows,
    totalAlerts: parsedAlerts.length,
    daysWithAlerts: rows.filter((row) => row.alertCount > 0).length,
    yellowRatingCount: worstStatusCounts.Yellow || 0,
    redRatingCount: worstStatusCounts.Red || 0
  }
}

module.exports = { buildSpaceWeatherViewModel }
