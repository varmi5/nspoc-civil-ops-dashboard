const { mshRequestBackground } = require('../app/lib/msh/client')

function sleep (ms) { return new Promise(resolve => setTimeout(resolve, ms)) }

async function main () {
  const path = '/v1/conjunction-events/?limit=50&sort_by=tca_time&sort_order=asc'

  console.log('First call (expect immediate throw, background fetch kicked off)...')
  const t0 = Date.now()
  try {
    await mshRequestBackground(path)
    console.log('unexpected: first call succeeded')
  } catch (err) {
    console.log(`First call threw after ${Date.now() - t0}ms as expected: ${err.message}`)
  }

  console.log('Waiting 10s for background fetch to land...')
  await sleep(10000)

  console.log('Second call (expect cached real data, instant)...')
  const t1 = Date.now()
  const data = await mshRequestBackground(path)
  console.log(`Second call returned in ${Date.now() - t1}ms, count=${data.length}`)
}

main().catch(err => { console.error('FAILED:', err); process.exit(1) })
