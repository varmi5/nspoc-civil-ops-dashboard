module.exports = {
  get apiBaseUrl () { return process.env.SPACE_WEATHER_API_BASE_URL || 'https://services.swpc.noaa.gov' },
  // NOAA SWPC's alerts feed is free and needs no credentials, unlike MSH — defaults to
  // live so the feature actually works out of the box. Set to "false" to show the
  // "not-connected" state instead (e.g. for a deterministic demo).
  get useLiveSpaceWeather () { return process.env.USE_LIVE_SPACE_WEATHER !== 'false' }
}
