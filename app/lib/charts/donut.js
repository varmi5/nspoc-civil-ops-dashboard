// Pure maths, no rendering — the donut-chart.njk macro turns this into SVG <circle>
// segments (stroke-dasharray/stroke-dashoffset, rotated -90deg so 0% starts at 12
// o'clock) plus a legend list. Radius is chosen so the circumference is ~100, letting
// percentages map almost directly onto dash lengths.
const RADIUS = 15.9155
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function buildDonut (rawSegments) {
  const positiveSegments = rawSegments.filter((segment) => segment.value > 0)
  const total = positiveSegments.reduce((sum, segment) => sum + segment.value, 0)

  if (total <= 0) {
    return { total: 0, radius: RADIUS, circumference: CIRCUMFERENCE, segments: [] }
  }

  let cumulativeLength = 0
  const segments = positiveSegments.map((segment, index) => {
    const percent = segment.value / total
    const length = percent * CIRCUMFERENCE
    const dashOffset = CIRCUMFERENCE - cumulativeLength
    cumulativeLength += length
    return {
      label: segment.label,
      value: segment.value,
      percent: Math.round(percent * 1000) / 10,
      colourIndex: index % 8,
      dashArray: `${length} ${CIRCUMFERENCE - length}`,
      dashOffset
    }
  })

  return { total, radius: RADIUS, circumference: CIRCUMFERENCE, segments }
}

module.exports = { buildDonut }
