const { mshRequest } = require('../app/lib/msh/client')

async function main () {
  const spec = await mshRequest('/openapi.json')
  const targets = [
    '/v1/conjunction-events/stats',
    '/v1/stats/count/conjunction-events',
    '/v1/stats/monthly/conjunction-events'
  ]
  for (const path of targets) {
    const item = spec.paths[path]
    if (!item || !item.get) {
      console.log(`${path} -> NOT FOUND`)
      continue
    }
    const get = item.get
    const params = (get.parameters || []).map(p => p.name)
    console.log(`${path}`)
    console.log(`  tags: ${JSON.stringify(get.tags)}`)
    console.log(`  summary: ${get.summary}`)
    console.log(`  params: ${JSON.stringify(params)}`)
    console.log()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
