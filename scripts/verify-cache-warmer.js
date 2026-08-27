// One-off dev tool: sanity-checks the cache-warmer in isolation (not via the full
// Express app, since govukPrototypeKit.requests.setupRouter() needs the kit's runtime
// context). Calls warmCache() directly and confirms it completes without throwing and
// actually populates the shared response cache.
//
// Run with: node --env-file=.env scripts/verify-cache-warmer.js

const { warmCache } = require('../app/lib/msh/cache-warmer')
const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  console.log('Calling warmCache()...')
  warmCache()

  // warmCache() is fire-and-forget by design (routes.js doesn't await it either), give it
  // a moment, then confirm a key it should have warmed now resolves instantly from cache.
  await new Promise((resolve) => setTimeout(resolve, 4000))

  console.log('\nConfirming a warmed key now resolves instantly from cache...')
  const t0 = Date.now()
  await mshRequest('/v1/satellites/with-metadata?limit=1000')
  console.log(`/v1/satellites/with-metadata -> ${Date.now() - t0}ms (should be ~0ms if warm-up already populated it)`)
}

main().catch((err) => {
  console.error('FAILED:', err)
  process.exitCode = 1
})
