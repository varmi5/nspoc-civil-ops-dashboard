//
// For guidance on how to add JavaScript see:
// https://prototype-kit.service.gov.uk/docs/adding-css-javascript-and-images
//

function enhancePrintLinks (root) {
  root.querySelectorAll('.js-print-link').forEach((link) => {
    link.classList.remove('msh-print-link--hidden')
    link.addEventListener('click', (event) => {
      event.preventDefault()
      window.print()
    })
  })
}

function enhanceMonthSelectors (root) {
  root.querySelectorAll('.js-month-selector').forEach((select) => {
    select.addEventListener('change', () => select.form.requestSubmit())
  })
}

function enhance (root) {
  enhancePrintLinks(root)
  enhanceMonthSelectors(root)
}

// Progressive enhancement for the period/month filters (period-selector links, the
// month-selector form): swaps just <main> via fetch instead of a full page navigation,
// so switching between "3 months" and "12 months" (or between reporting months) doesn't
// flash/reload the whole page. Both controls are plain GET links/forms underneath, so
// this degrades to a normal full navigation if JavaScript or fetch is unavailable, or if
// the fetch fails for any reason.
function initFastNav () {
  const main = document.getElementById('main-content')
  const status = document.getElementById('msh-fast-nav-status')
  if (!main) return

  async function swapTo (url, pushState) {
    main.setAttribute('aria-busy', 'true')
    try {
      const response = await fetch(url, { headers: { 'X-Requested-With': 'fetch' } })
      if (!response.ok) throw new Error('fast-nav fetch failed with status ' + response.status)
      const html = await response.text()
      const nextDocument = new DOMParser().parseFromString(html, 'text/html')
      const nextMain = nextDocument.getElementById('main-content')
      if (!nextMain) throw new Error('fast-nav: no #main-content in response')

      main.innerHTML = nextMain.innerHTML
      document.title = nextDocument.title
      if (pushState) window.history.pushState({ mshFastNav: true }, '', url)
      enhance(main)
      if (status) status.textContent = 'Page updated.'
      return true
    } catch (err) {
      return false
    } finally {
      main.removeAttribute('aria-busy')
    }
  }

  document.body.addEventListener('click', (event) => {
    const link = event.target.closest('.msh-period-selector__link')
    if (!link) return
    event.preventDefault()
    swapTo(link.href, true).then((ok) => { if (!ok) window.location.href = link.href })
  })

  document.body.addEventListener('submit', (event) => {
    const form = event.target.closest('.msh-month-selector')
    if (!form) return
    event.preventDefault()
    const params = new URLSearchParams(new window.FormData(form))
    const url = form.getAttribute('action') + '?' + params.toString()
    swapTo(url, true).then((ok) => { if (!ok) window.location.href = url })
  })

  window.addEventListener('popstate', () => {
    swapTo(window.location.href, false)
  })
}

window.GOVUKPrototypeKit.documentReady(() => {
  enhance(document)
  initFastNav()
})
