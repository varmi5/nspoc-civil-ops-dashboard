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

// Copy button on tech docs code blocks (macros/code-block.njk) — hidden until here, same
// reasoning as enhancePrintLinks: copying to the clipboard needs JS, so there's no point
// showing the button to a no-JS visitor at all.
function enhanceCodeBlocks (root) {
  root.querySelectorAll('.msh-code-block').forEach((block) => {
    const button = block.querySelector('.msh-code-block__copy')
    const pre = block.querySelector('.msh-code-block__pre')
    if (!button || !pre || button.dataset.mshEnhanced) return
    button.dataset.mshEnhanced = 'true'
    button.classList.remove('msh-code-block__copy--hidden')

    button.addEventListener('click', () => {
      navigator.clipboard.writeText(pre.textContent).then(() => {
        button.textContent = 'Copied'
        setTimeout(() => { button.textContent = 'Copy' }, 2000)
      })
    })
  })
}

function enhanceMonthSelectors (root) {
  root.querySelectorAll('.js-month-selector').forEach((select) => {
    select.addEventListener('change', () => select.form.requestSubmit())
  })
}

// Card view / graph view toggle for a trend-view.njk instance. Hidden until here (see
// .msh-trend-view__toggle--hidden) so a no-JS visitor only ever sees the cards panel
// that's already rendered server-side — same reasoning as enhancePrintLinks above.
function enhanceTrendViews (root) {
  root.querySelectorAll('[data-msh-trend-view]').forEach((container) => {
    const toggle = container.querySelector('.msh-trend-view__toggle')
    if (!toggle || toggle.dataset.mshEnhanced) return
    toggle.dataset.mshEnhanced = 'true'
    toggle.classList.remove('msh-trend-view__toggle--hidden')

    toggle.querySelectorAll('.msh-trend-view__toggle-btn').forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.dataset.view
        toggle.querySelectorAll('.msh-trend-view__toggle-btn').forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button))
        })
        container.querySelectorAll('[data-msh-trend-panel]').forEach((panel) => {
          panel.hidden = panel.dataset.mshTrendPanel !== view
        })
      })
    })
  })
}

function enhance (root) {
  enhancePrintLinks(root)
  enhanceCodeBlocks(root)
  enhanceMonthSelectors(root)
  enhanceTrendViews(root)
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
      // The initial page load's govuk-frontend initAll() (see govuk-prototype-kit's own
      // init.js) only ever scans the DOM once — swapped-in markup (e.g. a freshly-rendered
      // govukTabs component after changing the period selector) needs its own JS
      // component init, or things like tab-switching silently stop working.
      if (window.GOVUKFrontend && typeof window.GOVUKFrontend.initAll === 'function') {
        window.GOVUKFrontend.initAll({ scope: main })
      }
      enhance(main)
      // Anything set up once at initial page load (not part of the shared enhance()
      // pipeline above — e.g. re-entry-map.js booting Mapbox into a specific container)
      // needs its own signal that swapped-in markup just replaced whatever it was
      // attached to, since this swap doesn't re-run page <script> tags.
      document.dispatchEvent(new CustomEvent('msh:content-swapped', { detail: { root: main } }))
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

// Presentation Mode: ArrowLeft/ArrowRight follow the prev/next slide links (which are
// plain <a rel="prev"/"next"> underneath — this is a keyboard shortcut on top of normal
// navigation, not a replacement for it), plus a fullscreen toggle. A no-op on any page
// that isn't in presentation mode.
function initPresentMode () {
  const controls = document.querySelector('.msh-present-controls')
  if (!controls) return

  const prevLink = controls.querySelector('a[rel="prev"]')
  const nextLink = controls.querySelector('a[rel="next"]')
  const fullscreenButton = controls.querySelector('.js-present-fullscreen')

  document.addEventListener('keydown', (event) => {
    const tag = event.target.tagName
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || event.target.isContentEditable) return
    if (event.key === 'ArrowRight' && nextLink) window.location.href = nextLink.href
    if (event.key === 'ArrowLeft' && prevLink) window.location.href = prevLink.href
  })

  if (fullscreenButton) {
    fullscreenButton.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen()
      } else {
        document.documentElement.requestFullscreen()
      }
    })
  }
}

window.GOVUKPrototypeKit.documentReady(() => {
  enhance(document)
  initFastNav()
  initPresentMode()
})
