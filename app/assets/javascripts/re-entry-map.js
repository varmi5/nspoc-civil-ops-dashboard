// Boots the Mapbox GL map on the Re-Entry Map page/slide and the smaller embedded map
// on the Re-Entry page. Container and data render server-side either way, this just
// fills it in once mapbox-gl loads.
//
// Also re-runs on application.js's fast-nav swap event, since that replaces
// #main-content (including this container) without re-running page <script> tags.
// Without this the map would go blank after the first period change.
(function () {
  var currentMap = null

  function initMap () {
    var container = document.querySelector('[data-msh-mapbox-map]')
    var dataScript = document.querySelector('[data-msh-mapbox-data]')

    // Always tear down the old map instance first, otherwise it's left listening for
    // events against a detached canvas.
    if (currentMap) {
      currentMap.remove()
      currentMap = null
    }

    if (!container || !dataScript || typeof mapboxgl === 'undefined') return

    var mapData = JSON.parse(dataScript.textContent)
    mapboxgl.accessToken = mapData.accessToken

    // The Re-Entry Map page keeps Mapbox's 3D globe. The embedded map on the Re-Entry
    // page is forced to flat Mercator instead, since it's meant to be screenshotted
    // straight into a report like NSpOC's own flat "Re-Entry Map (Reporting Period)" slide.
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
      // Plain button, not a link, since Mapbox's click handling toggles the popup and
      // a navigating <a> here would fight that. The full TIP detail link lives inside
      // the popup instead.
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
