//
// For guidance on how to create filters see:
// https://prototype-kit.service.gov.uk/docs/filters
//

const govukPrototypeKit = require('govuk-prototype-kit')
const addFilter = govukPrototypeKit.views.addFilter
const sections = require('./config/sections')

// Add your filters here

// Exposes the section list to templates (e.g. the home page's link-out list), so it
// stays the one place that list is maintained rather than being copied into a view.
govukPrototypeKit.views.addFunction('mshSections', () => sections)

govukPrototypeKit.views.addFunction('mshNavigation', (currentSection) =>
  sections.map((section) => ({
    href: section.href,
    text: section.text,
    current: section.key === currentSection
  }))
)

// Mirrors MSH's own breadcrumb convention (Home / Section / Current page) — no
// breadcrumb on the true home page itself (it never sets currentSection, so the lookup
// below simply finds nothing), and the current page is always the final, unlinked item.
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

// Mirrors MSH's real footer (src/templates/components/Footer.tsx +
// AppConfig.footerNavigation): a titled navigation block above the standard footer
// meta links. Built from the same section list the top nav uses, rather than a
// separate hand-maintained link list, so it can't drift out of sync with real routes.
govukPrototypeKit.views.addFunction('mshFooterNavigation', () => [
  {
    title: 'Dashboard sections',
    columns: 2,
    items: sections.map((section) => ({ href: section.href, text: section.text }))
  }
])

