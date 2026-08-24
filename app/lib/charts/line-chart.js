// Pure maths, no rendering, mirrors bar-chart.js. Turns { month, count, alertCount? }
// entries into two polylines, matching NSpOC's "Number of Re-Entries Tracked" chart.
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

// Each series is scaled to its own max rather than one shared scale. A shared scale
// works for re-entry (dozens vs dozens) but flattens conjunction events (tens of
// thousands vs single digits) into a flat line at the bottom.
function buildLineChart (entries) {
  // NSpOC's chart runs oldest to newest left to right, the reverse of the order
  // entries arrive in.
  const chronological = entries.slice().reverse()
  const countMax = Math.max(...chronological.map((entry) => entry.count), 1)

  const countPoints = pointsFor(chronological, 'count', countMax)

  // MSH doesn't distinguish "alerts" from incidents for fragmentation, so draw only
  // the one real line rather than a fake flat-zero second series.
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
