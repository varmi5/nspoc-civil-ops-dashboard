module.exports = {
  get clientId () { return process.env.MSH_CLIENT_ID },
  get clientSecret () { return process.env.MSH_CLIENT_SECRET },
  get authUrl () { return process.env.MSH_AUTH_URL || 'https://monitor-your-satellites.eu.auth0.com/oauth/token' },
  get apiBaseUrl () { return process.env.MSH_API_BASE_URL || 'https://api.monitor-space-hazards.service.gov.uk' },
  get audience () { return process.env.MSH_AUDIENCE || 'monitor-your-satellites.service.gov.uk/api' },
  get useLiveMsh () { return process.env.USE_LIVE_MSH === 'true' }
}
