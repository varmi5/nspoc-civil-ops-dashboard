// Template-built from fixed logic, not free text, so figures can't be misstated on
// OFFICIAL-classified content going in front of a minister. Every number comes straight
// from the Monthly Overview view-model, this module only picks the wording.

function findTile (tiles, key) {
  return tiles.find((tile) => tile.key === key) || null
}

function reentryHeadlineSentence (viewModel) {
  const tile = findTile(viewModel.tiles, 'reentry-count')
  if (!tile || tile.status !== 'live') return null

  const lead = `${viewModel.selectedMonthLabel} saw ${tile.value} uncontrolled re-entries tracked by NSpOC`

  if (tile.previousValue === null || tile.previousValue === undefined) {
    return `${lead}.`
  }
  if (tile.previousValue === 0) {
    return tile.value === 0 ? `${lead}.` : `${lead}, up from none in ${viewModel.previousMonthLabel}.`
  }
  const diff = tile.value - tile.previousValue
  if (diff === 0) {
    return `${lead}, unchanged from ${viewModel.previousMonthLabel}.`
  }
  const pct = Math.round((Math.abs(diff) / tile.previousValue) * 100)
  const changeWord = diff > 0 ? 'an increase' : 'a decrease'
  return `${lead}, ${changeWord} of ${pct}% on ${viewModel.previousMonthLabel}.`
}

function reentryAlertSentence (viewModel) {
  const tile = findTile(viewModel.tiles, 'reentry-alerts')
  if (!tile || tile.status !== 'live') return null

  if (tile.value === 0) {
    return 'No re-entry alerts were issued this period.'
  }

  const lead = `${tile.value} of these were flagged as re-entry alerts by NSpOC`

  if (tile.previousValue === null || tile.previousValue === undefined || tile.previousValue === 0) {
    return `${lead}.`
  }
  const diff = tile.value - tile.previousValue
  if (diff === 0) {
    return `${lead}, the same as ${viewModel.previousMonthLabel}.`
  }
  const pct = Math.round((Math.abs(diff) / tile.previousValue) * 100)
  const changeWord = diff > 0 ? 'a rise' : 'a fall'
  return `${lead}, ${changeWord} of ${pct}% on last month.`
}

function collisionSentence (viewModel) {
  const riskTile = findTile(viewModel.tiles, 'collision-risk')
  if (!riskTile || riskTile.status !== 'live') return null
  const alertTile = findTile(viewModel.tiles, 'collision-alerts')
  const alertCount = alertTile && alertTile.status === 'live' ? alertTile.value : 0

  // Not UK-scoped, this endpoint has no UK filter, so word it as the tracked-catalogue
  // total it actually is.
  if (alertCount === 0) {
    return `${riskTile.value} conjunction events are on record across the tracked catalogue, none of which reached the highest-risk band.`
  }
  return `${riskTile.value} conjunction events are on record across the tracked catalogue, of which ${alertCount} reached the highest-risk band and prompted an alert.`
}

// Only worth saying if the change is large enough to be interesting, keeps the summary
// from padding out every month with routine noise.
function fragmentationLaunchesSentence (viewModel) {
  const parts = []

  const fragTile = findTile(viewModel.tiles, 'fragmentation')
  if (fragTile && fragTile.previousValue) {
    const pct = Math.round((Math.abs(fragTile.value - fragTile.previousValue) / fragTile.previousValue) * 100)
    if (pct >= 20) {
      parts.push(`fragmentation incidents ${fragTile.value > fragTile.previousValue ? 'rose' : 'fell'} to ${fragTile.value}`)
    }
  }

  const launchTile = findTile(viewModel.tiles, 'launches')
  if (launchTile && launchTile.previousValue) {
    const pct = Math.round((Math.abs(launchTile.value - launchTile.previousValue) / launchTile.previousValue) * 100)
    if (pct >= 20) {
      parts.push(`global launches ${launchTile.value > launchTile.previousValue ? 'rose' : 'fell'} to ${launchTile.value}`)
    }
  }

  if (parts.length === 0) return null
  return `Elsewhere, ${parts.join(', and ')} compared with ${viewModel.previousMonthLabel}.`
}

// Surfaces the same live/unavailable/not-connected distinction the mshBadge shows on
// every card. Never substitutes a stand-in number for a missing figure.
function dataQualitySentence (viewModel) {
  const unavailable = viewModel.tiles.filter((tile) => tile.status === 'unavailable').length
  const notConnected = viewModel.tiles.filter((tile) => tile.status === 'not-connected').length

  if (unavailable) {
    return 'Some figures could not be shown because the live MSH service did not respond to this request, see Data sources.'
  }
  if (notConnected) {
    return 'Some figures on this page are not yet connected to a live data source and are not shown, see Data sources.'
  }
  return null
}

// Filler, only used if fewer than 3 sentences fired above, so the summary doesn't read
// as thin.
function closingSentence (viewModel) {
  const ukTile = findTile(viewModel.tiles, 'uk-objects')
  if (ukTile && ukTile.status === 'live') {
    return `The UK-licensed population in orbit currently stands at ${ukTile.value} objects.`
  }
  return 'No further significant changes were recorded this period.'
}

function buildExecutiveSummary (viewModel, { maxSentences = 5 } = {}) {
  const sentences = [
    reentryHeadlineSentence(viewModel),
    reentryAlertSentence(viewModel),
    collisionSentence(viewModel),
    fragmentationLaunchesSentence(viewModel),
    dataQualitySentence(viewModel)
  ].filter(Boolean)

  if (sentences.length < 3) {
    const filler = closingSentence(viewModel)
    if (filler) sentences.push(filler)
  }

  return {
    monthLabel: viewModel.selectedMonthLabel,
    sentences: sentences.slice(0, maxSentences)
  }
}

module.exports = { buildExecutiveSummary }
