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

// Pan/zoom for the Re-Entry map (app/views/macros/re-entry-map.njk) — no library, just a
// CSS transform on the <g data-msh-map-zoom-group> element. The on-screen +/-/reset
// buttons are the keyboard-operable path (native <button>s, already Tab/Enter-accessible);
// wheel-to-zoom and drag-to-pan are mouse/touch conveniences on top of that, not the only
// way to use the map.
function initReEntryMapControls () {
  const map = document.querySelector('[data-msh-map]')
  if (!map) return

  const svg = map.querySelector('.msh-map__svg')
  const zoomGroup = map.querySelector('[data-msh-map-zoom-group]')
  const zoomInButton = map.querySelector('[data-msh-map-zoom-in]')
  const zoomOutButton = map.querySelector('[data-msh-map-zoom-out]')
  const resetButton = map.querySelector('[data-msh-map-reset]')
  if (!svg || !zoomGroup) return

  const MIN_SCALE = 1
  const MAX_SCALE = 6
  let scale = 1
  let translateX = 0
  let translateY = 0

  function clampTranslate () {
    const maxX = (360 * (scale - 1)) / 2 + 180
    const maxY = (180 * (scale - 1)) / 2 + 90
    translateX = Math.max(-maxX, Math.min(maxX, translateX))
    translateY = Math.max(-maxY, Math.min(maxY, translateY))
  }

  function apply () {
    clampTranslate()
    zoomGroup.style.transformOrigin = '180px 90px'
    zoomGroup.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`
  }

  function zoomBy (factor) {
    scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor))
    apply()
  }

  function reset () {
    scale = 1
    translateX = 0
    translateY = 0
    apply()
  }

  svg.addEventListener('wheel', (event) => {
    event.preventDefault()
    zoomBy(event.deltaY < 0 ? 1.2 : 1 / 1.2)
  }, { passive: false })

  let isDragging = false
  let lastX = 0
  let lastY = 0

  svg.addEventListener('pointerdown', (event) => {
    // Don't capture the pointer when starting on a marker — doing so retargets the
    // resulting click to the <svg> itself and silently swallows the marker's navigation.
    if (event.target.closest('a.msh-map__marker')) return
    isDragging = true
    lastX = event.clientX
    lastY = event.clientY
    svg.setPointerCapture(event.pointerId)
  })

  svg.addEventListener('pointermove', (event) => {
    if (!isDragging) return
    const dx = event.clientX - lastX
    const dy = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    const rect = svg.getBoundingClientRect()
    translateX += dx * (360 / rect.width)
    translateY += dy * (180 / rect.height)
    apply()
  })

  const endDrag = (event) => {
    isDragging = false
    if (svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId)
  }
  svg.addEventListener('pointerup', endDrag)
  svg.addEventListener('pointercancel', endDrag)

  if (zoomInButton) zoomInButton.addEventListener('click', () => zoomBy(1.4))
  if (zoomOutButton) zoomOutButton.addEventListener('click', () => zoomBy(1 / 1.4))
  if (resetButton) resetButton.addEventListener('click', reset)
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
  initReEntryMapControls()
  initPresentMode()
})
