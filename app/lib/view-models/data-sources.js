const dataSources = require('../../config/data-sources')
const { isSectionLiveCapable, isConfiguredForLive } = require('../msh/data-source')
const spaceWeatherConfig = require('../space-weather/config')

// Mirrors each fetch layer's own live-check exactly, so this page can never claim a
// figure is "connected" when the code path that actually renders it would disagree.
function isRowConnected (row) {
  if (row.gate === 'msh') return isConfiguredForLive(row.sectionKey)
  if (row.gate === 'noaa') return isSectionLiveCapable(row.sectionKey) && spaceWeatherConfig.useLiveSpaceWeather
  return false
}

function buildDataSourcesViewModel () {
  const pages = []
  const pageByTitle = new Map()

  for (const row of dataSources) {
    if (!pageByTitle.has(row.page)) {
      const page = { title: row.page, href: row.pageHref, rows: [] }
      pageByTitle.set(row.page, page)
      pages.push(page)
    }
    pageByTitle.get(row.page).rows.push({
      figure: row.figure,
      endpoints: row.endpoints,
      description: row.description,
      connected: isRowConnected(row)
    })
  }

  return { pages }
}

module.exports = { buildDataSourcesViewModel }
