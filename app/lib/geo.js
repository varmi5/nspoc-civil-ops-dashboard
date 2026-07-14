// MSH returns longitude in a mix of -180..180 and 0..360 conventions depending on the
// source feed — normalise to -180..180 so downstream formatting/projection code doesn't
// have to worry about which convention a given record used.
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
