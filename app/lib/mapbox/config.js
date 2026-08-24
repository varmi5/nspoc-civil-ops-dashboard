module.exports = {
  // Public token, meant to be sent to the browser — Mapbox scopes/restricts it by URL
  // in the Mapbox account, not by keeping it secret server-side.
  get accessToken () { return process.env.MAPBOX_ACCESS_TOKEN || '' }
}
