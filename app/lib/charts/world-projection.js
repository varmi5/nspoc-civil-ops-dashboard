// Pure maths, no rendering — mirrors charts/donut.js. Equirectangular projection: 1 SVG
// unit = 1 degree, so the viewBox is simply 360x180 and lat/long map onto it directly.
// This is a self-drawn grid (graticule), not a coastline map — there's no licensed
// coastline dataset in hand, and sending real OFFICIAL-classified coordinates through a
// third-party map tile provider (Google/Mapbox/OSM) would leak query patterns to that
// provider. Swapping in a real map asset later is possible without touching this module —
// projectPoint's output (x, y in the same viewBox) is provider-agnostic.
const { normaliseLongitude } = require('../geo')

const VIEWBOX_WIDTH = 360
const VIEWBOX_HEIGHT = 180

function projectPoint (latitude, longitude) {
  const lon = normaliseLongitude(longitude)
  return {
    x: lon + 180,
    y: 90 - latitude
  }
}

function buildGraticule ({ step = 30 } = {}) {
  const meridians = []
  for (let lon = -180; lon <= 180; lon += step) {
    meridians.push({ x: lon + 180, isPrime: lon === 0 })
  }

  const parallels = []
  for (let lat = -90; lat <= 90; lat += step) {
    parallels.push({ y: 90 - lat, isEquator: lat === 0 })
  }

  return { meridians, parallels }
}

module.exports = { projectPoint, buildGraticule, VIEWBOX_WIDTH, VIEWBOX_HEIGHT }
