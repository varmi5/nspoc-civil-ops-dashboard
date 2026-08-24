//
// For guidance on how to create filters see:
// https://prototype-kit.service.gov.uk/docs/filters
//

const govukPrototypeKit = require('govuk-prototype-kit')
const addFilter = govukPrototypeKit.views.addFilter
const sections = require('./config/sections')

// Add your filters here

// Exposes the section list to templates so it stays the one place it's maintained.
govukPrototypeKit.views.addFunction('mshSections', () => sections)

govukPrototypeKit.views.addFunction('mshNavigation', (currentSection) =>
  sections.map((section) => ({
    href: section.href,
    text: section.text,
    current: section.key === currentSection
  }))
)

// Mirrors MSH's breadcrumb convention: Home / Section / Current page. No breadcrumb on
// the home page itself, since it never sets currentSection.
govukPrototypeKit.views.addFunction('mshBreadcrumbs', (currentSection, pageName) => {
  const section = sections.find((candidate) => candidate.key === currentSection)
  if (!section) {
    return null
  }

  const items = [{ href: '/', text: 'Home' }]

  if (pageName && pageName !== section.text) {
    items.push({ href: section.href, text: section.text })
    items.push({ text: pageName })
  } else {
    items.push({ text: section.text })
  }

  return items
})

// Mirrors MSH's real footer (src/templates/components/Footer.tsx + AppConfig.footerNavigation).
// Built from the same section list as the top nav, so it can't drift out of sync.
govukPrototypeKit.views.addFunction('mshFooterNavigation', () => [
  {
    title: 'Dashboard sections',
    columns: 2,
    items: sections.map((section) => ({ href: section.href, text: section.text }))
  },
  {
    title: 'About this data',
    columns: 1,
    items: [
      { href: '/data-sources', text: 'Data sources' },
      { href: '/tech-docs', text: 'Tech docs' }
    ]
  }
])

