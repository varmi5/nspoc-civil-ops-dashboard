const config = require('./config')
const sections = require('../../config/sections')

function isSectionLiveCapable (sectionKey) {
  const section = sections.find((s) => s.key === sectionKey)
  return Boolean(section && section.liveCapable)
}

function isConfiguredForLive (sectionKey) {
  return isSectionLiveCapable(sectionKey) && config.useLiveMsh
}

module.exports = { isSectionLiveCapable, isConfiguredForLive }
