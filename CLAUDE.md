# NSpOC Civil Operations Dashboard

A GOV.UK Prototype Kit dashboard for the UK Space Agency's National Space Operations
Centre (NSpOC), live-connected to the real Monitor Space Hazards (MSH) API. It mirrors a
real monthly OFFICIAL-classified PPTX report NSpOC produces, rebuilt as a live, browsable
dashboard with drill-down detail pages, an interactive map, presentation mode, and an
auto-generated executive summary.

Sibling to an untouched GOV.UK Prototype Kit framework checkout at `../govuk-prototype-kit/`
— don't confuse the two; this repo (`nspoc-civil-ops-dashboard/`) is the actual project.

## Stack

Node/Express + Nunjucks + govuk-frontend v6.3.0, via `govuk-prototype-kit`. No build step
beyond Sass compilation and the kit's own dev server (`npm run dev`).

## Directory map

```
app/
  routes.js                    All routes. Map route MUST be registered before the
                                /re-entry/:noradId catch-all, or Express matches "map" as
                                a noradId and 404s.
  config/
    sections.js                Per-section nav config + liveCapable flag (gates whether
                                MSH is even attempted for that section — see data-source.js)
    present-slides.js          Ordered slide registry for Presentation Mode
  lib/
    msh/
      client.js                mshRequest() — the only way to call MSH. 4s timeout,
                                throws on failure (no silent fallback here).
      config.js                Reads MSH_* env vars (client id/secret, auth/API URLs)
      token-cache.js            OAuth2 client_credentials token fetch + cache
      response-cache.js        withCache() — stale-while-revalidate cache in front of
                                mshRequest, keyed by full URL path; also coalesces
                                concurrent cold-miss requests for the same key
      cache-warmer.js           warmCache() — fires each section's default view once at
                                server boot so the cache above is warm before any real
                                request arrives
      get-section-data.js      getSectionData(sectionKey, {liveFetcher, fixturePath}) —
                                THE pattern every view-model uses. Tries live if the
                                section is liveCapable AND USE_LIVE_MSH=true, catches any
                                error, falls back to the fixture. Returns {data, isLive}.
      data-source.js            isConfiguredForLive(sectionKey) — liveCapable && useLiveMsh
      conjunction-analysis.js  Shared /for-analysis fetch + CDM-revision dedup logic
                                (used by both Monthly Overview and Collision & Fragmentation)
    space-weather/
      config.js                USE_LIVE_SPACE_WEATHER flag — separate from USE_LIVE_MSH,
                                NOAA needs no credentials
      client.js                fetchAlerts() — NOAA SWPC's public alerts.json, no auth
      parse-alert.js            Classifies product_id -> alert type, extracts NOAA
                                Rx/Sx/Gx scale from message text where present
      sector-rules.js           sectorStatusesForDay() — FIRST DRAFT sector-colour
                                mapping, not signed off by NSpOC (see comments in file)
    view-models/
      monthly-overview.js      buildMonthlyOverviewViewModel(month)
      re-entry.js              buildReEntryViewModel(months), buildReEntryObjectViewModel
                                (noradId), buildReEntryMapViewModel()
      collision-fragmentation.js  buildCollisionFragmentationViewModel(months)
      space-weather.js          buildSpaceWeatherViewModel(month) — one row per calendar
                                day, GREEN/YELLOW/RED per sector
    charts/
      donut.js                 Pure maths -> SVG donut segments (no rendering)
      bar-chart.js              Pure maths -> SVG bar geometry (no rendering)
      world-projection.js       Equirectangular lat/long -> x/y for the Re-Entry map
    narrative.js                Deterministic (NOT an LLM) executive-summary sentence
                                templates — no hallucination risk on OFFICIAL content
    present-nav.js               Presentation Mode slide navigation helper
    date-range.js, format-date.js, format-risk.js, geo.js, fixtures.js
                                Small shared utilities
  views/
    index.html, summary.html    Monthly Overview + auto-summary pages
    re-entry/                   index (tabbed table), object (detail), map (SVG map)
    collision-fragmentation/    index
    space-weather/               index — monthly per-day sector table
    present/                    Chrome-free slide versions of the above
    macros/                     Nunjucks components — kpi-tile, donut-chart, bar-chart,
                                month-strip, trend-view (toggles between the two),
                                tracked-objects-table, risk-tag, badge, explainer,
                                period-selector, month-selector, present-controls, etc.
    layouts/                    main.html (normal pages), present.html (chrome-free)
  data-fixtures/                Sample-data JSON, one file per figure, used when MSH is
                                unreachable or a section isn't live-capable
  assets/
    javascripts/application.js  All custom JS: print link, month-selector auto-submit,
                                fast-nav (fetches just #main-content on filter changes),
                                trend-view toggle, re-entry map pan/zoom, present-mode
                                keyboard nav
    sass/                       One partial per feature area
scripts/                        One-off Node scripts used to test live MSH endpoints
                                directly (run with `node --env-file=.env scripts/x.js`).
                                Kept intentionally — they document real, tested API
                                behaviour, not throwaway scratch work.
```

## Core patterns

**View-model → macro, always.** Routes call a `build*ViewModel()` function, which returns
a plain object; templates only read from `viewModel.*` and render via macros. Nunjucks
templates never call JS chart-building functions directly (`buildDonut`/`buildBarChart`
run in the view-model; the macro just receives the already-built `chart` object) —
mirrors how `donutChart(title, chart)` and `barChart(title, chart)` are used everywhere.

**Live/fallback via `getSectionData`.** Every live-capable figure goes through
`getSectionData(sectionKey, {liveFetcher, fixturePath})`, which returns `{data, isLive}`.
The `mshBadge` macro renders `isLive` as a real "Live from MSH API" / "Sample data" tag —
this reflects what actually happened on THIS request, not a static config flag. A section
only ever attempts live if `sections.js` marks it `liveCapable: true` AND
`USE_LIVE_MSH=true` in `.env`.

**Response caching (`response-cache.js`).** Stale-while-revalidate: once a key succeeds,
stale data is served instantly on expiry (5 min) while a background refresh runs; a key
that has never succeeded is retried at most every 30s. This is why "Sample data" flickers
in only ever happen on a truly cold key, not on every page load. **Concurrent cold-miss
requests for the same key are coalesced** into one shared in-flight promise — confirmed
this mattered live: `buildReEntryViewModel()` and `buildReEntryMapViewModel()` both need
the same `/v1/satellites/with-metadata` and reentry-list keys, and without coalescing each
fired its own duplicate live request when called concurrently (see cache-warmer.js below),
doubling load for zero benefit.

**Startup cache-warming (`cache-warmer.js`).** `warmCache()` runs once when `routes.js` is
first required (server boot) and fires the same default-view builders every route already
calls, so the response cache is warm before any real visitor hits a cold page. This exists
because a cold nodemon restart used to mean every section a developer clicked into within
the next few seconds fought over the same MSH connection budget at once — confirmed live
(`scripts/diagnose-concurrent-load.js`): ~73 concurrent calls (monthly-overview + re-entry +
collision-fragmentation + launches all cold together) took 3.5-4s wall time, right at the
4s abort timeout, and some individual calls did tip over it (the "This operation was
aborted" log lines). This is NOT the background-fetch-per-request workaround warned about
below — it's a one-time boot-time action using the endpoints already confirmed fast, not a
mechanism that masks a slow one.

**mshRequest has ONE fixed 4s timeout, no exceptions.** Do not build per-call custom
timeouts or background-fetch workarounds for a slow endpoint — the fix for a slow endpoint
is almost always to find the actual fast/aggregated variant MSH provides (see the
conjunction-events lesson below), not to work around slowness client-side. A
background-only fetch mechanism (`mshRequestBackground`/`peekAndRefresh`) was built twice
this project and reverted twice once the real fast endpoint was found each time — don't
reintroduce it without first checking whether an `-aggregated` or similarly optimised
sibling endpoint exists.

## MSH API — what's been learned the hard way

Base URL: `https://api.monitor-space-hazards.service.gov.uk` (prod-ish; there's also a
`-dev` tenant/API at `api.dev.monitor-space-hazards.service.gov.uk`, a **different**
Auth0 tenant with different signing keys — a token from one will not validate against the
other's `/docs`). Auth: Auth0 `client_credentials` grant against
`https://monitor-your-satellites.eu.auth0.com/oauth/token`
(audience `monitor-your-satellites.service.gov.uk/api`). Swagger at `/docs`, spec at
`/openapi.json` — always check the FULL spec for sibling endpoints before assuming one you
know about is the only option (see below).

**Every finding here was confirmed by direct live testing** (see `scripts/investigate-*.js`
for the actual test code), not inferred from docs — MSH's Swagger descriptions are sparse
and occasionally silent on exactly this kind of behavioural gotcha.

- **`epoch` query param** (future/past/all) on list endpoints defaults to `future` when
  omitted. This caused a real bug: Re-Entry's tracked-objects list only ever showed 2
  objects because it silently used the future-only default. Always pass `epoch` explicitly
  when you mean "all".
- **"Aggregated" vs plain monthly endpoints are NOT interchangeable.** e.g.
  `/v1/stats/monthly/conjunction-events` (plain) takes 15-60s+ and can outright 504 —
  `/v1/stats/monthly/conjunction-events-aggregated` (same params, one row per month
  instead of one row per probability-range) responds in under a second, even for a
  12-month range. This exact confusion cost real implementation churn (a background-fetch
  workaround was built, then removed once the aggregated endpoint was found). **Always
  check `/openapi.json` for an `-aggregated` sibling before assuming an endpoint is
  irreducibly slow.**
- **No UK-satellite filter exists on any conjunction/satellite endpoint** — confirmed by
  dumping the full parameter list for every path in the spec. However, MSH's own
  `/v1/satellites/with-metadata` / `/v1/satellites/monitored` catalogs are themselves
  ~87% UK-licensed (727 of 834) — this is NSpOC's own monitored watchlist, not a global
  catalog — and 91.8% of conjunction events already involve a UK-licensed object. So the
  conjunction-events data is UK-scoped by construction; a UK filter wouldn't reduce the
  numbers much even if one existed.
- **CDM revisions**: `/v1/conjunction-events/for-analysis` returns one row per CDM
  revision, not per unique event (one real object pair appeared 5 times with 5 different
  `cdm_external_id`s) — dedupe by `short_id`, keeping the highest `cdm_external_id`
  (see `conjunction-analysis.js`). The plain `/v1/conjunction-events/` list, by contrast,
  showed zero duplicate `short_id`s in a 2,000-row sample — it appears to already be
  deduplicated to one row per event. Don't assume duplication behaviour transfers between
  endpoints without testing each one.
- **Reporting-pipeline fields exist but are rarely populated**: `report_number`, `risk`,
  `collision_probability_uksa`, `collision_probability_report` on conjunction events. They
  were empty in every fast-path sample tested — likely because they only get filled in as
  an event's closest-approach date nears, and the only fast query path (default sort,
  descending) returns the far-future tail where that hasn't happened yet.
- **Risk is a 6-value enum**: None, Very low, Low, Medium, High, Pending — not a
  3-value-plus-null scheme. Confirmed via the reentry/conjunction/fragmentation report
  `/schema` endpoints.
- **Satellite catalog (`/v1/satellites/{norad_id}`) has fields reentry/conjunction records
  usually don't** (mass, apogee, perigee, inclination, license_country,
  international_designator) — merge with `firstDefined()` fallback rather than trusting
  the event record alone.
- **Large fetches are fine; the wrong sort/filter combo is what's slow.** e.g.
  `/v1/reentry-events/` handles a full 3,696-row all-time fetch in ~2s. But on
  `/v1/conjunction-events/`, only the default sort (`sort_by=tca_time&sort_order=desc`, no
  explicit `epoch`) is fast — adding `sort_order=asc` or an explicit `epoch` param on that
  specific endpoint pushed response times to 5-8s in testing. Test the exact param
  combination you intend to use, don't assume speed generalises across sort orders.
- **Per-object fan-outs have a bulk sibling too, at least for the satellite catalog.**
  Re-Entry's tracked-objects enrichment (`attachLatestLocation` in `re-entry.js`) used to
  call `/v1/satellites/{norad_id}` once per object — up to `TRACKED_OBJECTS_CAP` (60) calls
  on a single `/re-entry` page load, none sharing a cache key. Confirmed live
  (`scripts/investigate-tips-satellites-batch.js`,
  `investigate-tips-latest-and-catalog-size.js`): the entire catalog is only 834 records,
  and `/v1/satellites/with-metadata?limit=1000` returns all of them in ~470ms — now fetched
  once per batch via `fetchSatelliteCatalogMap()` instead. **`/v1/tips/latest` looked like
  it might be the same kind of bulk shortcut for the other half of the fan-out
  (`/v1/tips/{norad_id}`), but isn't** — it returns only the single most-recently-created
  TIP system-wide (one object, not one per norad_id), confirmed by cross-checking against
  real tracked objects that don't appear in it. That per-object TIP call remains genuinely
  per-object; don't reintroduce an attempt to bulk it without new evidence.

### Endpoints currently called in production code (not scripts/)

| Endpoint | Used by | Notes |
|---|---|---|
| `/v1/stats/monthly/reentry-events` | monthly-overview, re-entry | month-scoped counts |
| `/v1/stats/monthly/reentry-events-by-object-type` | monthly-overview | donut source |
| `/v1/conjunction-events/stats?epoch=future` (epoch passed explicitly, not relied on as default) | monthly-overview | ~200ms; "current catalogue" total, not a lifetime total (epoch=all/past both time out); feeds two tiles labelled "(current snapshot)" that don't change with the month selector — this is by design, not a bug |
| `/v1/stats/monthly/conjunction-events-aggregated` | monthly-overview, collision-fragmentation | fast (see above); "this month" tile + trend chart |
| `/v1/conjunction-events/?limit=100&sort_by=tca_time&sort_order=desc` | monthly-overview, collision-fragmentation | donut + table source |
| `/v1/conjunction-events/for-analysis?threshold=0.001` | conjunction-analysis.js (shared) | needs CDM dedup |
| `/v1/stats/monthly/fragmentation-events` | monthly-overview, collision-fragmentation | sparse — gap-fill missing months to zero |
| `/v1/stats/fragmentation-events/by-fragmentation-type` | collision-fragmentation | donut source |
| `/v1/fragmentation-events/?epoch=all&limit=100` | collision-fragmentation | table source |
| `/v1/stats/monthly/objects-launched` | monthly-overview | |
| `/v1/reentry-events/?epoch=all&sort_by=decay_epoch&sort_order=desc&limit=2000` | re-entry | epoch=all is deliberate, see above |
| `/v1/reentry-events/by-norad-id/{id}` | re-entry (object detail) | |
| `/v1/tips/{norad_id}` | re-entry | returns an ARRAY of TIP messages, not one object; genuinely per-object, no bulk equivalent (see below) |
| `/v1/satellites/{norad_id}` | re-entry (object detail page only) | catalog fallback fields for a single object |
| `/v1/satellites/with-metadata?limit=1000` | re-entry (tracked-objects list + map) | bulk catalog fetch, one call for up to 834 records — replaces what used to be up to 60 individual `/v1/satellites/{norad_id}` calls, see below |

## What's been built

- **Monthly Overview** (`/`) — KPI tiles (re-entry, collision catalogue + this-month +
  requires-analyst-review, asteroids/space-weather/launches/UK-objects — several still
  fixture-only, see `sections.js`), two donuts, month selector, auto-generated 2-sentence
  summary panel.
- **Re-Entry** (`/re-entry`) — KPI tiles, latest-first month-strip trend (toggleable
  card/graph view), object-type donut, **tabbed** tracked-objects table (Upcoming /
  Pending Analysis / Analysed), each tab in a scrollable fixed-height panel, tied to the
  same 1-24 month period selector as the trend. Detail page per object
  (`/re-entry/:noradId`) with full TIP history. Interactive SVG map (`/re-entry/map`) —
  self-drawn lat/long graticule (no third-party map tiles, deliberately, to avoid leaking
  OFFICIAL-classified query patterns to an external provider), pan/zoom, clickable markers.
- **Collision & Fragmentation** (`/collision-fragmentation`) — KPI tiles, two trend charts
  (conjunction + fragmentation, same card/graph toggle), two donuts, events-requiring-
  analysis table, fragmentation-incidents table.
- **Presentation Mode** (`/present/*`) — chrome-free slide deck reusing the same
  view-models unmodified; keyboard arrow navigation; fullscreen toggle.
- **Space Weather** (`/space-weather`) — the first non-MSH live data source: a monthly,
  per-day GREEN/YELLOW/RED table across seven industry sectors (Local Resilience, Energy,
  Aviation, Marine, Satellite Operators, Satellite Comms, Rail), sourced live from NOAA
  SWPC's free public alerts feed (`app/lib/space-weather/`), not MSH — its own
  `USE_LIVE_SPACE_WEATHER` flag (default true, no credentials needed), separate from
  `USE_LIVE_MSH`. **The sector-colour mapping (`sector-rules.js`) is an explicit first
  draft, not signed off by NSpOC** — built from NOAA's own published impact text per scale
  level, not NSpOC's real methodology (an open question raised in the Krish meeting-prep
  script but not yet answered). The fixture (`data-fixtures/space-weather/alerts.json`)
  is Krish's real June 2026 MOSWOC alert log, converted to NOAA's raw shape. Confirmed live
  (`scripts/investigate-noaa-alerts-shape.js`) that NOAA's own `noaa-scales.json` endpoint
  is NOT a substitute for this — it's a ~5-day current/forecast snapshot, not a monthly
  historical archive, so the per-day table has to come from parsing `alerts.json`.
- **Executive Summary** (`/summary` + condensed panel on Monthly Overview) — fully
  deterministic sentence templates (`narrative.js`), explicitly not an LLM.
- **Progressive enhancement throughout**: print links, month-selector auto-submit,
  fast-nav (swaps `#main-content` via fetch on period/month changes without a full
  reload), trend-view card/graph toggle, map pan/zoom — all degrade to a working
  no-JS experience (plain links/forms, or just the default view with no toggle).

## Known, deliberate behaviour — not a bug

**"Collision Risks to UK Satellites (current snapshot)" and "Collision Alerts from NSpOC
(current snapshot)" never change when the month selector changes.** Both are built from
`fetchConjunctionStats()` (`monthly-overview.js`), which hits
`/v1/conjunction-events/stats?epoch=future` — an endpoint with no date-range parameter at
all (confirmed live: `epoch=all`/`epoch=past` both time out against the full archive, so
there's no month- or lifetime-scoped variant to fall back to). The "(current snapshot)"
label suffix (same convention as "Objects Analysed for Risk (current snapshot)" on
Re-Entry and "Conjunction Events Tracked (current snapshot)" on Collision & Fragmentation)
and the Monthly Overview explainer text both call this out explicitly. If this ever looks
like a regression, check the label/explainer are still present before assuming the value
is stuck — it's expected to be identical across every month and every one of `/`,
`/summary`, `/present/summary`, `/present/monthly-overview` (same shared cache key).

## Known open issue — NOT resolved

**NSpOC's own real monthly report shows a conjunction-events figure that's often far
smaller than what MSH's aggregated endpoint returns** for the same kind of month (monthly
totals here range roughly 2,000-78,000 depending on the month — hugely volatile — while
NSpOC's real figure has been reported around 1,300). Ruled out directly: CDM-revision
duplication and a missing UK filter (see above — neither explains the gap). Leading
hypothesis, unconfirmed: NSpOC's figure counts only risk-assessed/reported events, not
every routine screening — but the fields that would prove this
(`report_number`/`risk`/`collision_probability_uksa`) are empty in every fast-path sample
available. This needs an answer from the MSH/NSpOC team directly, not more guessing from
this side. Flagged in both the Monthly Overview and Collision & Fragmentation explainer
text — don't remove that caveat without resolving the underlying question first.

## Working conventions for this repo

- **Test live, don't guess.** Every claim about API behaviour in this file was verified
  with a real request (see `scripts/investigate-*.js`). If you're unsure how an endpoint
  behaves, write a throwaway script and hit it — don't infer from Swagger descriptions
  alone, they're often incomplete or wrong (e.g. `string($date)` params, undocumented
  `-aggregated` siblings).
- **No secrets in committed files.** `.env` holds `MSH_CLIENT_ID`/`MSH_CLIENT_SECRET`/etc
  and is gitignored. When testing with a credential pasted into a chat, treat it as
  compromised and rotate it — don't reuse it beyond that session.
- **Fixture files are real placeholders, not filler.** Every fixture in
  `data-fixtures/` mirrors the real shape a live fetch would return, so the Sample-data
  fallback view stays visually consistent with the live one.
