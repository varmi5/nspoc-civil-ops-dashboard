const config = require('./config')

let cachedToken = null
let fetchingTokenPromise = null

async function fetchNewToken () {
  const response = await fetch(config.authUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      audience: config.audience,
      grant_type: 'client_credentials'
    })
  })

  if (!response.ok) {
    throw new Error(`MSH auth token request failed with status ${response.status}`)
  }

  const body = await response.json()
  if (!body.access_token) {
    throw new Error('MSH auth token response did not include an access_token')
  }
  return body.access_token
}

async function getAccessToken () {
  if (cachedToken) {
    return cachedToken
  }
  if (!fetchingTokenPromise) {
    fetchingTokenPromise = fetchNewToken()
      .then((token) => {
        cachedToken = token
        return token
      })
      .finally(() => {
        fetchingTokenPromise = null
      })
  }
  return fetchingTokenPromise
}

function clearToken () {
  cachedToken = null
}

module.exports = { getAccessToken, clearToken }
