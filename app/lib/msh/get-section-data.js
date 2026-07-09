const dataSource = require('./data-source')
const { loadFixture } = require('../fixtures')

// Every view-model calls this instead of the MSH client directly. It tries a live fetch
// when the section is configured for it, and falls back to fixtures (with isLive: false)
// on any error — this is what makes the "Live from MSH API" badge reflect what actually
// happened on this request, not just a static config flag.
async function getSectionData (sectionKey, { liveFetcher, fixturePath }) {
  if (dataSource.isConfiguredForLive(sectionKey)) {
    try {
      const data = await liveFetcher()
      return { data, isLive: true }
    } catch (err) {
      console.error(`MSH live fetch failed for section "${sectionKey}" (falling back to fixture data): ${err.message}`)
    }
  }
  return { data: loadFixture(fixturePath), isLive: false }
}

module.exports = { getSectionData }
