const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  const events = await mshRequest('/v1/conjunction-events/?limit=2000&sort_by=tca_time&sort_order=desc')
  const withProb = events.filter(e => e.collision_probability !== null && e.collision_probability !== undefined)
  console.log(`collision_probability set: ${withProb.length} of ${events.length} (${(100*withProb.length/events.length).toFixed(1)}%)`)
  console.log('sample with probability:', JSON.stringify(withProb.slice(0,3).map(e => ({short_id: e.short_id, tca_time: e.tca_time, collision_probability: e.collision_probability, user_interest: e.user_interest, data_source: e.data_source})), null, 2))

  const byInterest = events.reduce((acc, e) => { const k = e.user_interest || 'null'; acc[k] = (acc[k]||0)+1; return acc }, {})
  console.log('\nuser_interest distribution:', JSON.stringify(byInterest, null, 2))

  const byDataSource = events.reduce((acc, e) => { const k = e.data_source || 'null'; acc[k] = (acc[k]||0)+1; return acc }, {})
  console.log('\ndata_source distribution:', JSON.stringify(byDataSource, null, 2))
}

main().catch(err => { console.error(err); process.exit(1) })
