//
// For guidance on how to create filters see:
// https://prototype-kit.service.gov.uk/docs/filters
//

const govukPrototypeKit = require('govuk-prototype-kit')
const addFilter = govukPrototypeKit.views.addFilter
const sections = require('./config/sections')

// Add your filters here

govukPrototypeKit.views.addFunction('mshNavigation', (currentSection) =>
  sections.map((section) => ({
    href: section.href,
    text: section.text,
    current: section.key === currentSection
  }))
)

