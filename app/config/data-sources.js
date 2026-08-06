// The single source of truth for "which endpoint backs this figure" — read by both
// buildDataSourcesViewModel() (the /data-sources page) and, going forward, CLAUDE.md's
// own endpoint table should be kept in sync with this list rather than maintained
// separately, so there's one place this can drift out of date, not two.
//
// `gate` decides how "connected" is worked out for each row:
//   'msh'  — connected when sections.js's liveCapable flag for `sectionKey` is true AND
//            USE_LIVE_MSH=true (the same check getSectionData uses)
//   'noaa' — connected when sections.js's liveCapable flag for `sectionKey` is true AND
//            USE_LIVE_SPACE_WEATHER=true (space-weather's independent gate)
//   'none' — never connected; no endpoint exists for this figure at all
module.exports = [
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Uncontrolled Re-Entries / Re-Entry Alerts from NSpOC',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/stats/monthly/reentry-events'],
    description: 'Month-scoped re-entry count and alert count, with a month-over-month comparison.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Global Launches',
    sectionKey: 'launches', gate: 'msh',
    endpoints: ['/v1/stats/monthly/objects-launched'],
    description: 'Month-scoped launch count.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Fragmentation Incidents',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/monthly/fragmentation-events'],
    description: 'Month-scoped fragmentation incident count.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Collision Risks to UK Satellites / Collision Alerts from NSpOC (current snapshot)',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/conjunction-events/stats?epoch=future'],
    description: 'A snapshot of the current tracked catalogue, not scoped to the selected month — this endpoint has no date-range parameter at all, which is why the figure never changes when you pick a different month.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Collision Risks (This Month)',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/monthly/conjunction-events-aggregated'],
    description: 'Every MSH screening recorded this month, across every CDM revision. Confirmed live: this is not the same metric as NSpOC’s own reported monthly figure, and no MSH endpoint currently produces that narrower figure — see the caveat on the tile.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Collision Events Requiring Analyst Review',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/conjunction-events/for-analysis?threshold=0.001'],
    description: 'Events that have crossed a computed collision-probability threshold and need analyst attention right now.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Re-Entry donut (by object type)',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/stats/monthly/reentry-events-by-object-type'],
    description: 'Month-scoped re-entry breakdown by object type.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Collision donut (by interest rating)',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/conjunction-events/?sort_by=tca_time&sort_order=desc'],
    description: 'The 100 most recent tracked conjunction events, bucketed by NSpOC’s own interest rating.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Close Approach Asteroids / Asteroid Alerts from NSpOC',
    sectionKey: 'asteroids', gate: 'none',
    endpoints: [],
    description: 'No MSH asteroid endpoint is wired in yet.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Space Weather Alerts from Met Office (tile) / Space Weather donut',
    sectionKey: 'space-weather', gate: 'none',
    endpoints: [],
    description: 'The real live NOAA feed only powers the dedicated Space Weather page (see below) — this Monthly Overview tile and donut are not wired to it.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'UK Objects in Space',
    sectionKey: 'resident-space-objects', gate: 'none',
    endpoints: [],
    description: 'No Resident Space Objects page or live fetch exists yet.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Other Alerts / Issues',
    sectionKey: null, gate: 'none',
    endpoints: [],
    description: 'No data source of any kind exists for this figure.'
  },
  {
    page: 'Monthly Overview', pageHref: '/monthly-overview',
    figure: 'Asteroids donut / Service Status donut',
    sectionKey: null, gate: 'none',
    endpoints: [],
    description: 'No data source exists for either of these donuts.'
  },
  {
    page: 'Re-Entry', pageHref: '/re-entry',
    figure: 'Tracked objects list, trend strip, and interactive map',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=2000', '/v1/stats/monthly/reentry-events'],
    description: 'The full tracked re-entry archive plus its monthly trend breakdown, filtered client-side to the selected reporting period.'
  },
  {
    page: 'Re-Entry', pageHref: '/re-entry',
    figure: 'Per-object location and catalog enrichment',
    sectionKey: 're-entry', gate: 'msh',
    endpoints: ['/v1/tips/{norad_id}', '/v1/satellites/with-metadata?limit=1000'],
    description: 'Latest predicted location per object (TIP messages) plus mass/apogee/perigee/inclination from the shared satellite catalog.'
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
    figure: 'Conjunction events tracked (count, donut)',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/conjunction-events/?limit=100&sort_by=tca_time&sort_order=desc'],
    description: 'The 100 most recent tracked conjunction events.'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: 'Events requiring analysis',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/conjunction-events/for-analysis?threshold=0.001'],
    description: 'Events past a computed collision-probability threshold, with full physical details per object.'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: 'Fragmentation incidents tracked',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/fragmentation-events/?epoch=all&limit=100&sort_by=event_epoch&sort_order=desc'],
    description: 'The 100 most recent tracked fragmentation incidents.'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: 'Conjunction events trend',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/monthly/conjunction-events-aggregated'],
    description: 'Every MSH screening recorded per month. Confirmed live: not the same metric as NSpOC’s own reported monthly figure — see the caveat on this chart.'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: 'Fragmentation incidents trend',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/monthly/fragmentation-events'],
    description: 'Month-scoped fragmentation incident counts.'
  },
  {
    page: 'Collision & Fragmentation', pageHref: '/collision-fragmentation',
    figure: 'Fragmentation Cause donut',
    sectionKey: 'collision-fragmentation', gate: 'msh',
    endpoints: ['/v1/stats/fragmentation-events/by-fragmentation-type'],
    description: 'Fragmentation incidents broken down by cause.'
  },
  {
    page: 'Space Weather', pageHref: '/space-weather',
    figure: 'Sector conditions table and Total Alerts tile',
    sectionKey: 'space-weather', gate: 'noaa',
    endpoints: ['https://services.swpc.noaa.gov/products/alerts.json'],
    description: 'NOAA Space Weather Prediction Center’s public alerts feed — no authentication required. The sector colour mapping is a first draft built from NOAA’s own published impact text, not yet signed off by NSpOC.'
  },
  {
    page: 'Procurement', pageHref: '/procurement',
    figure: 'Procurement',
    sectionKey: 'procurement', gate: 'none',
    endpoints: [],
    description: 'Listed in navigation; no route, view, or data source exists yet.'
  },
  {
    page: 'Org Chart', pageHref: '/org-chart',
    figure: 'Org Chart',
    sectionKey: 'org-chart', gate: 'none',
    endpoints: [],
    description: 'Listed in navigation; no route, view, or data source exists yet.'
  }
]
