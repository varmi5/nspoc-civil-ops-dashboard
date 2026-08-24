// Pure maths, no rendering, mirrors donut.js. Turns { month, count, alertCount? } entries
// into bar geometry for a fixed-height SVG viewBox, scaled to that series' own max so
// sparse datasets (fragmentation, mostly 0-1) and dense ones (conjunction events, tens
// of thousands) both fill the height sensibly.
const VIEWBOX_WIDTH = 600
const VIEWBOX_HEIGHT = 200
const BAR_GAP_RATIO = 0.3

function buildBarChart (entries) {
  const maxValue = Math.max(...entries.map((entry) => entry.count), 1)
  const slotWidth = VIEWBOX_WIDTH / Math.max(entries.length, 1)
  const barWidth = slotWidth * (1 - BAR_GAP_RATIO)

  const bars = entries.map((entry, index) => {
    const barHeight = (entry.count / maxValue) * VIEWBOX_HEIGHT
    return {
      x: Math.round((index * slotWidth + (slotWidth - barWidth) / 2) * 100) / 100,
      y: Math.round((VIEWBOX_HEIGHT - barHeight) * 100) / 100,
      width: Math.round(barWidth * 100) / 100,
      height: Math.round(barHeight * 100) / 100,
      label: entry.month,
      value: entry.count,
      alertCount: entry.alertCount
    }
  })

  return { width: VIEWBOX_WIDTH, height: VIEWBOX_HEIGHT, maxValue, bars }
}

module.exports = { buildBarChart }
