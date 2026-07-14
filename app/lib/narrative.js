// Deterministic, template-built plain-English summary sentences — no LLM involved, so
// there's no hallucination risk for OFFICIAL-classified figures going in front of a
// minister. Every number here is read straight off the same view-model the Monthly
// Overview page already renders; this module only chooses which sentences to say and how
// to phrase a delta, never invents a figure.

function findTile (tiles, key) {
  return tiles.find((tile) => tile.key === key) || null
}

function reentryHeadlineSentence (viewModel) {
  const tile = findTile(viewModel.tiles, 'reentry-count')
  if (!tile) return null

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
  if (!tile) return null

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
  if (!riskTile) return null
  const alertTile = findTile(viewModel.tiles, 'collision-alerts')
  const alertCount = alertTile ? alertTile.value : 0

  if (alertCount === 0) {
    return `${riskTile.value} conjunction events were tracked involving UK-monitored satellites, none of which reached the highest-risk band.`
  }
  return `${riskTile.value} conjunction events were tracked involving UK-monitored satellites, of which ${alertCount} reached the highest-risk band and prompted an alert.`
}

// The only conditional sentence — only worth saying if the change is large enough to be
// narratively interesting, keeping the total sentence count in the 3-5 range rather than
// padding out every month with routine noise.
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

// Keeps the auto-generated prose honest about the same live/sample distinction the
// mshBadge already shows on every card — this isn't hidden in the narrative.
function dataQualitySentence (viewModel) {
  const hasSampleTile = viewModel.tiles.some((tile) => tile.isLive === false)
  if (!hasSampleTile) return null
  return 'Figures marked "Sample data" are illustrative placeholders and have not yet been confirmed against a live MSH source.'
}

// Unconditional filler — only used if fewer than 3 sentences fired above, so the summary
// never reads as suspiciously thin.
function closingSentence (viewModel) {
  const ukTile = findTile(viewModel.tiles, 'uk-objects')
  if (ukTile) {
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
