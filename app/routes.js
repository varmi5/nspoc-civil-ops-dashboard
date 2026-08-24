//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

// Add your routes here

const { buildReEntryViewModel, buildReEntryObjectViewModel, buildReEntryMapViewModel } = require('./lib/view-models/re-entry')
const { buildMonthlyOverviewViewModel } = require('./lib/view-models/monthly-overview')
const { buildCollisionFragmentationViewModel } = require('./lib/view-models/collision-fragmentation')
const { buildSpaceWeatherViewModel } = require('./lib/view-models/space-weather')
const { buildDataSourcesViewModel } = require('./lib/view-models/data-sources')
const { buildExecutiveSummary } = require('./lib/narrative')
const { presentNav } = require('./lib/present-nav')
const { warmCache } = require('./lib/msh/cache-warmer')

// Runs once at server boot, routes.js is only required once per process. See
// cache-warmer.js for why.
warmCache()

// The landing page: a hub linking out to each section, mirroring MSH's own
// authenticated home page. Monthly Overview lives at its own URL, not here.
router.get('/', (req, res) => res.render('home'))

router.get('/monthly-overview', async (req, res, next) => {
  try {
    const viewModel = await buildMonthlyOverviewViewModel(req.query.month)
    const summary = buildExecutiveSummary(viewModel, { maxSentences: 2 })
    res.render('index', { viewModel, summary })
  } catch (err) {
    next(err)
  }
})

router.get('/summary', async (req, res, next) => {
  try {
    const viewModel = await buildMonthlyOverviewViewModel(req.query.month)
    const summary = buildExecutiveSummary(viewModel, { maxSentences: 5 })
    res.render('summary', { viewModel, summary })
  } catch (err) {
    next(err)
  }
})

router.get('/re-entry', async (req, res, next) => {
  try {
    const viewModel = await buildReEntryViewModel(req.query.month)
    res.render('re-entry/index', { viewModel })
  } catch (err) {
    next(err)
  }
})

// Must be registered before the /re-entry/:noradId catch-all below, or Express matches
// "map" as a noradId and 404s inside buildReEntryObjectViewModel instead.
router.get('/re-entry/map', async (req, res, next) => {
  try {
    const viewModel = await buildReEntryMapViewModel()
    res.render('re-entry/map', { viewModel })
  } catch (err) {
    next(err)
  }
})

router.get('/re-entry/:noradId', async (req, res, next) => {
  try {
    const viewModel = await buildReEntryObjectViewModel(req.params.noradId)
    if (!viewModel) {
      return next()
    }
    res.render('re-entry/object', { viewModel })
  } catch (err) {
    next(err)
  }
})

router.get('/collision-fragmentation', async (req, res, next) => {
  try {
    const viewModel = await buildCollisionFragmentationViewModel(req.query.month, req.query.fragmentationMonths)
    res.render('collision-fragmentation/index', { viewModel })
  } catch (err) {
    next(err)
  }
})

router.get('/space-weather', async (req, res, next) => {
  try {
    const viewModel = await buildSpaceWeatherViewModel(req.query.month)
    res.render('space-weather/index', { viewModel })
  } catch (err) {
    next(err)
  }
})

router.get('/data-sources', (req, res, next) => {
  try {
    const viewModel = buildDataSourcesViewModel()
    res.render('data-sources/index', { viewModel })
  } catch (err) {
    next(err)
  }
})

router.get('/tech-docs', (req, res) => res.render('tech-docs/index'))

router.get('/present', (req, res) => res.redirect('/present/summary'))

router.get('/present/summary', async (req, res, next) => {
  try {
    const viewModel = await buildMonthlyOverviewViewModel(req.query.month)
    const summary = buildExecutiveSummary(viewModel, { maxSentences: 5 })
    res.render('present/summary', { summary, nav: presentNav('summary') })
  } catch (err) {
    next(err)
  }
})

router.get('/present/monthly-overview', async (req, res, next) => {
  try {
    const viewModel = await buildMonthlyOverviewViewModel(req.query.month)
    res.render('present/monthly-overview', { viewModel, nav: presentNav('monthly-overview') })
  } catch (err) {
    next(err)
  }
})

router.get('/present/re-entry', async (req, res, next) => {
  try {
    const viewModel = await buildReEntryViewModel(req.query.month)
    res.render('present/re-entry', { viewModel, nav: presentNav('re-entry') })
  } catch (err) {
    next(err)
  }
})

router.get('/present/re-entry/map', async (req, res, next) => {
  try {
    const viewModel = await buildReEntryMapViewModel()
    res.render('present/re-entry-map', { viewModel, nav: presentNav('re-entry-map') })
  } catch (err) {
    next(err)
  }
})

router.get('/present/collision-fragmentation', async (req, res, next) => {
  try {
    const viewModel = await buildCollisionFragmentationViewModel(req.query.month, req.query.fragmentationMonths)
    res.render('present/collision-fragmentation', { viewModel, nav: presentNav('collision-fragmentation') })
  } catch (err) {
    next(err)
  }
})
