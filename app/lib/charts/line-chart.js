// Pure maths, no rendering — mirrors bar-chart.js. Turns a series of
// { month, count, alertCount? } entries (already in display order, latest-first — see
// month-strip.njk) into two polylines sharing one scale, matching NSpOC's own "Number of
// Re-Entries Tracked" chart (count + alerts issued on the same axis) rather than the
// single-series bar chart this replaces on the Re-Entry page.
const VIEWBOX_WIDTH = 600
const VIEWBOX_HEIGHT = 260
const POINT_INSET = 12 // keeps the first/last point's circle marker from clipping at the edge

function pointsFor (entries, key, maxValue) {
  const usableWidth = VIEWBOX_WIDTH - POINT_INSET * 2
  const slotWidth = usableWidth / Math.max(entries.length - 1, 1)

  return entries.map((entry, index) => ({
    x: Math.round((POINT_INSET + index * slotWidth) * 100) / 100,
    y: Math.round((VIEWBOX_HEIGHT - (entry[key] / maxValue) * VIEWBOX_HEIGHT) * 100) / 100,
    label: entry.month,
    value: entry[key]
  }))
}

// Matches NSpOC's own chart, which plots "Number of Collision Events" and "Alerts Issued"
// on two separate y-axes rather than one shared scale. Sharing one scale looks fine when
// the two series are comparable in size (re-entry: dozens vs dozens), but for conjunction
// events (tens of thousands vs single digits) it flattens the smaller series to a straight
// line along the bottom — each series is scaled independently to its own max instead, so
// both are readable regardless of how differently sized they are.
function buildLineChart (entries) {
  // NSpOC's chart is oldest-to-newest left-to-right — the reverse of the month-strip
  // card view (latest-first) these entries arrive in.
  const chronological = entries.slice().reverse()
  const countMax = Math.max(...chronological.map((entry) => entry.count), 1)

  const countPoints = pointsFor(chronological, 'count', countMax)

  // Fragmentation's trend has no alerts-equivalent field at all (MSH doesn't distinguish
  // "alerts" from incidents for fragmentation) — draw only the one real line rather than a
  // fake flat-zero second line that would look like a genuine (empty) data series.
  const hasAlertSeries = chronological.some((entry) => entry.alertCount !== undefined)
  let alertLine = null
  if (hasAlertSeries) {
    const alertMax = Math.max(...chronological.map((entry) => entry.alertCount || 0), 1)
    const alertPoints = pointsFor(chronological, 'alertCount', alertMax)
    alertLine = { points: alertPoints, path: toPath(alertPoints), maxValue: alertMax }
  }

  return {
    width: VIEWBOX_WIDTH,
    height: VIEWBOX_HEIGHT,
    countMax,
    countLine: { points: countPoints, path: toPath(countPoints) },
    alertLine
  }
}

function toPath (points) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ')
}

module.exports = { buildLineChart }
