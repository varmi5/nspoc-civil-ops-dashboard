const slides = require('../config/present-slides')

function presentNav (currentKey) {
  const index = slides.findIndex((slide) => slide.key === currentKey)
  const current = slides[index]
  return {
    slides,
    index,
    total: slides.length,
    current,
    prevHref: index > 0 ? slides[index - 1].href : null,
    nextHref: index < slides.length - 1 ? slides[index + 1].href : null
  }
}

module.exports = { presentNav }
