// Single source of truth for "which endpoint backs this figure", read by the
// /data-sources page. Keep CLAUDE.md's endpoint table in sync with this list.
//
// `gate` decides how "connected" is worked out for each row:
//   'msh'  - live when sections.js's liveCapable flag is true AND USE_LIVE_MSH=true
//   'noaa' - live when liveCapable is true AND USE_LIVE_SPACE_WEATHER=true
//   'none' - never connected, no endpoint exists for this figure
module.exports = [
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Uncontrolled Re-Entries / Re-Entry Alerts from NSpOC',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/stats/monthly/reentry-events'],
    description: 'Monthly re-entry and alert counts, vs previous month.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Global Launches',
    sectionKey: 'launches', gate: 'msh',
    endpoints: ['/v1/stats/monthly/objects-launched'],
    description: 'Monthly launch count.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Fragmentation Incidents',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/monthly/fragmentation-events'],
    description: 'Monthly fragmentation incident count.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Conjunction Events Tracked (current catalogue)',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/conjunction-events/stats?epoch=future'],
    description: 'Current snapshot, not month-scoped (endpoint has no date filter). Not limited to UK satellites, so differs from NSpOC\'s reported figure.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Collision Alerts from NSpOC',
    sectionKey: 'collision-fragmentation', gate: 'none',
    endpoints: [],
    description: 'The nearest MSH field (conjunction_event_alert_count) is a live classification of the whole current catalogue, not a monthly alert count. Confirmed it can coincidentally match NSpOC\'s figure while measuring something else entirely, so this shows no live source rather than a misleading number.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Collision Risks (This Month)',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/monthly/conjunction-events-aggregated'],
    description: 'Every screening this month, all CDM revisions. Differs from NSpOC\'s own monthly figure; no endpoint gives that narrower number.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Collision Events Requiring Analyst Review',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/conjunction-events/for-analysis?threshold=0.001'],
    description: 'Events past the collision-probability threshold, awaiting analyst review.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Re-Entry donut (by object type)',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/stats/monthly/reentry-events-by-object-type'],
    description: 'Monthly re-entry breakdown by object type.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Collision donut (by interest rating)',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/conjunction-events/?sort_by=tca_time&sort_order=desc'],
    description: 'Last 100 tracked conjunction events, by NSpOC interest rating.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Close Approach Asteroids / Asteroid Alerts from NSpOC',
    sectionKey: 'asteroids', gate: 'none',
    endpoints: [],
    description: 'No MSH asteroid endpoint wired in yet.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Space Weather Alerts from Met Office (tile) / Space Weather donut',
    sectionKey: 'space-weather', gate: 'none',
    endpoints: [],
    description: 'The live NOAA feed only powers the Space Weather page; this tile and donut aren\'t wired to it.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'UK Objects in Space',
    sectionKey: 'resident-space-objects', gate: 'none',
    endpoints: [],
    description: 'No Resident Space Objects page or feed exists yet.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Other Alerts / Issues',
    sectionKey: null, gate: 'none',
    endpoints: [],
    description: 'No data source exists for this figure.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Asteroids donut / Service Status donut',
    sectionKey: null, gate: 'none',
    endpoints: [],
    description: 'No data source exists for either donut.'
  },
  {
    page: 'Re-Entry', pageHref: '/re-entry',
    figure: 'Tracked objects list, trend strip, and interactive map',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=2000', '/v1/stats/monthly/reentry-events'],
    description: 'Full re-entry archive and monthly trend, filtered to the selected period.'
  },
  {
    page: 'Re-Entry', pageHref: '/re-entry',
    figure: 'Per-object location and catalog enrichment',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/tips/{norad_id}', '/v1/satellites/with-metadata?limit=1000'],
    description: 'Latest location (from TIPs) plus mass, apogee, perigee and inclination from the satellite catalog.'
  },
  {
    page: 'Re-Entry', pageHref: '/re-entry',
    figure: 'Risk rating (table, map and object page)',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/tips/{norad_id}'],
    description: 'Highest risk the object has ever reached, not just its current rating (risk usually decays to none by decay date). Human casualty risk excluded, confirmed with NSpOC as not checked. No MSH endpoint returns this directly, so it\'s worked out here from full TIP history.'
  },
  {
    page: 'Re-Entry', pageHref: '/re-entry',
    figure: 'Object detail page',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/reentry-events/by-norad-id/{norad_id}', '/v1/tips/{norad_id}', '/v1/satellites/{norad_id}'],
    description: 'Full re-entry record, TIP history, and catalog fields for one object.'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: '"Recent fragmentation incidents" table',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/fragmentation-events/?epoch=all&limit=200&sort_by=event_epoch&sort_order=desc'],
    description: 'Last 200 tracked incidents, filtered client-side to the selected lookback (no date filter on this endpoint).'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: '"Conjunction alerts issued" chart and "Conjunction Probability Breakdown" donut',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/monthly/conjunction-events-aggregated'],
    description: 'Monthly screenings by probability band. Chart shows only the > 1e-3 band as a proxy for NSpOC\'s "Alerts Issued" figure; the raw total was dropped, it runs far too high against NSpOC\'s own number.'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: '"Fragmentation incidents tracked" chart',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/monthly/fragmentation-events'],
    description: 'Monthly fragmentation incident counts.'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: '"Fragmentation Cause" donut',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/fragmentation-events/?epoch=all&limit=200&sort_by=event_epoch&sort_order=desc'],
    description: 'Same fetch as the incidents table, bucketed by cause and filtered to the selected month specifically.'
  },
  {
    page: 'Space Weather', pageHref: '/space-weather',
    figure: 'Sector conditions table and Total Alerts tile',
    sectionKey: 'space-weather', gate: 'noaa',
    endpoints: ['https://services.swpc.noaa.gov/products/alerts.json'],
    description: 'NOAA\'s public alerts feed, no authentication required. Sector colour mapping is a first draft, not yet signed off by NSpOC.'
  },
  {
    page: 'Procurement', pageHref: '/procurement',
    figure: 'Procurement',
    sectionKey: 'procurement', gate: 'none',
    endpoints: [],
    description: 'Listed in navigation; no route, view, or data source yet.'
  },
  {
    page: 'Org Chart', pageHref: '/org-chart',
    figure: 'Org Chart',
    sectionKey: 'org-chart', gate: 'none',
    endpoints: [],
    description: 'Listed in navigation; no route, view, or data source yet.'
  }
]
