const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  const events = await mshRequest('/v1/conjunction-events/?limit=2000&sort_by=tca_time&sort_order=desc')
  console.log(`sample size: ${events.length}`)

  const withReportNumber = events.filter(e => e.report_number !== null && e.report_number !== undefined)
  const withRisk = events.filter(e => e.risk !== null && e.risk !== undefined)
  const withUksaProb = events.filter(e => e.collision_probability_uksa !== null && e.collision_probability_uksa !== undefined)
  const withReportProb = events.filter(e => e.collision_probability_report !== null && e.collision_probability_report !== undefined)
  const withAnalysis = events.filter(e => e.additional_analysis !== null && e.additional_analysis !== undefined && e.additional_analysis !== '')

  console.log(`report_number set: ${withReportNumber.length} (${(100*withReportNumber.length/events.length).toFixed(1)}%)`)
  console.log(`risk set: ${withRisk.length} (${(100*withRisk.length/events.length).toFixed(1)}%)`)
  console.log(`collision_probability_uksa set: ${withUksaProb.length} (${(100*withUksaProb.length/events.length).toFixed(1)}%)`)
  console.log(`collision_probability_report set: ${withReportProb.length} (${(100*withReportProb.length/events.length).toFixed(1)}%)`)
  console.log(`additional_analysis set: ${withAnalysis.length} (${(100*withAnalysis.length/events.length).toFixed(1)}%)`)

  console.log('\nsample of a reported event (if any):', JSON.stringify(withReportNumber[0] || 'none found', null, 2))
  console.log('\nsample of a risk-set event (if any):', JSON.stringify(withRisk[0] || 'none found', null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
