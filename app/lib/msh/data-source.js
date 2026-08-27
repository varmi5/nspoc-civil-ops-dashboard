const config = require('./config')
const sections = require('../../config/sections')

// 'launches' has a live MSH endpoint (Global Launches tile on Monthly Overview) but no
// nav entry or page of its own, so it isn't in sections.js.
const LIVE_CAPABLE_SECTIONS_WITHOUT_NAV = ['launches']

function isSectionLiveCapable (sectionKey) {
  if (LIVE_CAPABLE_SECTIONS_WITHOUT_NAV.includes(sectionKey)) return true
  const section = sections.find((s) => s.key === sectionKey)
  return Boolean(section && section.liveCapable)
}

function isConfiguredForLive (sectionKey) {
  return isSectionLiveCapable(sectionKey) && config.useLiveMsh
}

module.exports = { isSectionLiveCapable, isConfiguredForLive }
