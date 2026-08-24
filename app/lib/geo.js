// MSH returns longitude as either -180..180 or 0..360 depending on the source feed.
// Normalise to -180..180 so downstream code doesn't need to care which one it got.
function normaliseLongitude (longitude) {
  let value = longitude % 360
  if (value > 180) value -= 360
  if (value < -180) value += 360
  return value
}

function hasResolvedLocation (point) {
  return Boolean(point) && point.latitude !== null && point.latitude !== undefined &&
    point.longitude !== null && point.longitude !== undefined
}

module.exports = { normaliseLongitude, hasResolvedLocation }
