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

// Copy button on tech docs code blocks. Hidden until JS enhances it, same as
// enhancePrintLinks, since copying to clipboard needs JS anyway.
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

// Card/graph toggle for a trend-view.njk instance. Hidden until enhanced so a no-JS
// visitor just sees the server-rendered cards panel.
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

// Period/month filters swap just <main> via fetch instead of a full page reload.
// Both controls are plain GET links/forms, so this falls back to normal navigation
// if JS or the fetch fails.
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
      // govuk-frontend's initAll() only scans the DOM once at page load, so swapped-in
      // markup (e.g. a govukTabs component) needs re-initialising or tab-switching breaks.
      if (window.GOVUKFrontend && typeof window.GOVUKFrontend.initAll === 'function') {
        window.GOVUKFrontend.initAll({ scope: main })
      }
      enhance(main)
      // This swap doesn't re-run page <script> tags, so anything set up once at load
      // (e.g. re-entry-map.js's Mapbox instance) needs this event to know to reinit.
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

// Presentation Mode: arrow keys follow the prev/next slide links (plain <a rel> links
// underneath), plus a fullscreen toggle. No-op outside presentation mode.
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
