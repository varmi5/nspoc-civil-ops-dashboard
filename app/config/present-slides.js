// Ordered slide registry for Presentation Mode — extensible as more sections get built
// (mirrors the pattern of app/config/sections.js).
module.exports = [
  { key: 'summary', title: 'Executive Summary', href: '/present/summary', exitHref: '/summary' },
  { key: 'monthly-overview', title: 'Monthly Overview', href: '/present/monthly-overview', exitHref: '/' },
  { key: 're-entry', title: 'Re-Entry', href: '/present/re-entry', exitHref: '/re-entry' },
  { key: 're-entry-map', title: 'Re-Entry Map', href: '/present/re-entry/map', exitHref: '/re-entry/map' }
]
