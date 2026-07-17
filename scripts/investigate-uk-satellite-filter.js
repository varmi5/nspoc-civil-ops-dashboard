const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  const t0 = Date.now()
  const sats = await mshRequest('/v1/satellites/with-metadata?limit=2000')
  console.log(`fetched ${sats.length} satellites in ${Date.now() - t0}ms`)
  console.log('sample record keys:', Object.keys(sats[0] || {}))

  const countryCounts = sats.reduce((acc, s) => {
    const c = s.license_country || 'null/unknown'
    acc[c] = (acc[c] || 0) + 1
    return acc
  }, {})
  console.log('license_country distribution:', JSON.stringify(countryCounts, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
