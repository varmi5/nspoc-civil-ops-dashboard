//
// For guidance on how to create routes see:
// https://prototype-kit.service.gov.uk/docs/create-routes
//

const govukPrototypeKit = require('govuk-prototype-kit')
const router = govukPrototypeKit.requests.setupRouter()

// Add your routes here

const { buildReEntryViewModel, buildReEntryObjectViewModel } = require('./lib/view-models/re-entry')
const { buildMonthlyOverviewViewModel } = require('./lib/view-models/monthly-overview')

router.get('/', async (req, res, next) => {
  try {
    const viewModel = await buildMonthlyOverviewViewModel(req.query.month)
    res.render('index', { viewModel })
  } catch (err) {
    next(err)
  }
})

router.get('/re-entry', async (req, res, next) => {
  try {
    const viewModel = await buildReEntryViewModel(req.query.months)
    res.render('re-entry/index', { viewModel })
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
