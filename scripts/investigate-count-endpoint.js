const { mshRequest } = require('../app/lib/msh/client')

async function timeCall (label, path, timeoutMs) {
  const t0 = Date.now()
  try {
    const data = await mshRequest(path, { timeoutMs })
    console.log(`${label} -> ${Date.now() - t0}ms:`, JSON.stringify(data))
  } catch (err) {
    console.log(`${label} -> FAILED after ${Date.now() - t0}ms: ${err.message}`)
  }
}

async function main () {
  await timeCall('count epoch=future', '/v1/stats/count/conjunction-events?epoch=future', 8000)
  await timeCall('count epoch=past', '/v1/stats/count/conjunction-events?epoch=past', 8000)
  await timeCall('count epoch=all', '/v1/stats/count/conjunction-events?epoch=all', 8000)
  await timeCall('count no epoch', '/v1/stats/count/conjunction-events', 8000)
}

main().catch(err => { console.error(err); process.exit(1) })
