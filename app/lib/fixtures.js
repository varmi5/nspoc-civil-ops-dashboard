const path = require('path')

const cache = new Map()

function loadFixture (relativePath) {
  if (!cache.has(relativePath)) {
    const fixturePath = path.join(__dirname, '..', 'data-fixtures', relativePath)
    cache.set(relativePath, require(fixturePath))
  }
  return cache.get(relativePath)
}

module.exports = { loadFixture }
