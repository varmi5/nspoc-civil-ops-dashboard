// Boots the Mapbox GL map on the Re-Entry Map page/slide, and on the smaller map embedded
// on the Re-Entry page. Progressive enhancement: the container and data island render
// server-side regardless, this just fills the container in once mapbox-gl (loaded via CDN
// in the page's own <script> tags) is available.
//
// Runs once at initial page load, and again on every application.js fast-nav swap (e.g.
// clicking the Re-Entry page's reporting-period selector) — that swap replaces the whole
// #main-content subtree, including this container, but doesn't re-run page <script> tags,
// so without this the map would only ever exist for the very first render and silently go
// blank on every subsequent period change.
(function () {
  var currentMap = null

  function initMap () {
    var container = document.querySelector('[data-msh-mapbox-map]')
    var dataScript = document.querySelector('[data-msh-mapbox-data]')

    // The previous swap's container (and the map attached to it) is gone from the DOM
    // either way — always tear down the old instance so it isn't left listening for
    // events (resize, etc.) against a detached canvas.
    if (currentMap) {
      currentMap.remove()
      currentMap = null
    }

    if (!container || !dataScript || typeof mapboxgl === 'undefined') return

    var mapData = JSON.parse(dataScript.textContent)
    mapboxgl.accessToken = mapData.accessToken

    // The dedicated Re-Entry Map page keeps Mapbox's default 3D globe view. The map
    // embedded on the Re-Entry page is meant to be screenshotted straight into a report —
    // like NSpOC's own flat "Re-Entry Map (Reporting Period)" slide — so it's forced to a
    // flat Mercator projection instead, set via data-msh-map-projection on the container
    // (see views/macros/re-entry-map.njk).
    var projection = container.dataset.mshMapProjection || 'globe'

    var map = new mapboxgl.Map({
      container: container,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [0, 20],
      zoom: 1.2,
      projection: projection
    })
    currentMap = map

    map.addControl(new mapboxgl.NavigationControl())

    mapData.markers.forEach(function (marker) {
      // A plain button, not a link: Mapbox's own click handling toggles the popup, so
      // making this element itself a navigating <a> would fight that. The "open full
      // detail" link lives inside the popup instead — select once for a summary, select
      // the link in it to go to the full Tracking and Impact Prediction (TIP) page.
      var el = document.createElement('button')
      el.type = 'button'
      el.className = 'msh-map__marker msh-map__marker--' + (marker.risk ? marker.risk.toLowerCase() : 'pending')
      el.setAttribute('aria-label', marker.objectName + ', ' + marker.objectType +
        ', predicted decay ' + marker.decayDate + ', risk ' + (marker.risk || 'pending analysis') +
        ', location ' + marker.location)

      var popupHtml = '<strong>' + escapeHtml(marker.objectName) + '</strong><br>' +
        escapeHtml(marker.objectType) + '<br>' +
        'Predicted decay: ' + escapeHtml(marker.decayDate) + '<br>' +
        'Risk: ' + escapeHtml(marker.risk || 'pending analysis') + '<br>' +
        escapeHtml(marker.location) + '<br>' +
        '<a class="govuk-link" href="/re-entry/' + encodeURIComponent(marker.noradId) + '">Full tracking detail</a>'

      new mapboxgl.Marker(el)
        .setLngLat([marker.longitude, marker.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(popupHtml))
        .addTo(map)
    })
  }

  function escapeHtml (value) {
    var div = document.createElement('div')
    div.textContent = value == null ? '' : String(value)
    return div.innerHTML
  }

  initMap()
  document.addEventListener('msh:content-swapped', initMap)
})()
