const config = require('./config')
const tokenCache = require('./token-cache')

async function requestOnce (path, options) {
  const token = await tokenCache.getAccessToken()
  const url = new URL(path, config.apiBaseUrl)
  return fetch(url, {
    ...options,
    headers: {
      ...(options && options.headers),
      Authorization: `Bearer ${token}`
    }
  })
}

async function mshRequest (path, options = {}) {
  if (!config.useLiveMsh) {
    throw new Error('mshRequest called while USE_LIVE_MSH is not "true" — use getSectionData() with a fixture fallback instead')
  }

  let response = await requestOnce(path, options)

  if (response.status === 401) {
    tokenCache.clearToken()
    response = await requestOnce(path, options)
  }

  if (!response.ok) {
    throw new Error(`MSH API request to ${path} failed with status ${response.status}`)
  }

  return response.json()
}

module.exports = { mshRequest }
