const { mshRequest } = require('../app/lib/msh/client')

async function timeCall (label, path, timeoutMs) {
  const t0 = Date.now()
  try {
    const data = await mshRequest(path, { timeoutMs })
    console.log(`${label} -> ${Date.now() - t0}ms`)
    return data
  } catch (err) {
    console.log(`${label} -> FAILED after ${Date.now() - t0}ms: ${err.message}`)
    return null
  }
}

async function main () {
  console.log('now:', new Date().toISOString())
  console.log()

  const pastSmall = await timeCall('conjunction-events/?epoch=past&limit=5&sort_by=tca_time&sort_order=desc', '/v1/conjunction-events/?epoch=past&limit=5&sort_by=tca_time&sort_order=desc', 8000)
  if (pastSmall) {
    console.log('sample past events (desc):')
    pastSmall.forEach(e => console.log(`  short_id=${e.short_id} tca_time=${e.tca_time} user_interest=${e.user_interest} cdm_external_id=${e.cdm_external_id}`))
  }
  console.log()

  const pastOldest = await timeCall('conjunction-events/?epoch=past&limit=5&sort_by=tca_time&sort_order=asc', '/v1/conjunction-events/?epoch=past&limit=5&sort_by=tca_time&sort_order=asc', 8000)
  if (pastOldest) {
    console.log('sample past events (asc, oldest first):')
    pastOldest.forEach(e => console.log(`  short_id=${e.short_id} tca_time=${e.tca_time} user_interest=${e.user_interest} cdm_external_id=${e.cdm_external_id}`))
  }
  console.log()

  await timeCall('count epoch=future', '/v1/stats/count/conjunction-events?epoch=future', 8000)
  await timeCall('count epoch=past', '/v1/stats/count/conjunction-events?epoch=past', 8000)
}

main().catch(err => { console.error(err); process.exit(1) })
