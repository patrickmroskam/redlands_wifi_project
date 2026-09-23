/* Redlands Wifi Project — map. Plain script, no build step. */
(function () {
  'use strict';

  // Every page shares this map: the fence, the canvas markers and the popup panning are
  // the same everywhere, only the dataset differs. A page sets window.RWPMapConfig before
  // loading this script to plot something other than the WiFi networks; the defaults below
  // are the main map, so index.html needs no configuration at all.
  var CONFIG = window.RWPMapConfig || {};
  var DB_URL = CONFIG.dbUrl || 'data/networks.json';
  // The JSON key holding the records: 'networks' for the WiFi map, 'devices' for the rest.
  var RECORDS_KEY = CONFIG.recordsKey || 'networks';
  var NOUN = CONFIG.noun || 'network';
  var BOUNDARY_URL = 'data/redlands-boundary.geojson';
  // Used only if the boundary file fails to load: bbox of ZCTA 92373 + 92374.
  var FALLBACK_BOUNDS = [[33.93438, -117.24996], [34.09923, -117.03414]];
  var COLORS = CONFIG.colors || { encrypted: '#33ff66', open: '#ffb000' };
  // Keep auto-panned popups clear of the zoom control (top left); Leaflet's default elsewhere.
  var POPUP_OPTIONS = { autoPanPaddingTopLeft: [50, 10], autoPanPaddingBottomRight: [5, 5] };
  // Extra room on every side of the popup when the fence is loosened for it. Must cover the largest
  // auto-pan padding above (50) plus the popup tip below the box (~20, outside offsetHeight).
  var POPUP_SLACK = 60;

  var statsEl = document.getElementById('stats');
  // stats.js may have failed to load; the breakdown must not say "loading" forever.
  if (!window.RWPStats) {
    var breakdownStatus = document.getElementById('security-status');
    if (breakdownStatus) breakdownStatus.textContent = '> security breakdown unavailable';
  }
  // A missing stats.js, or a cached one from before the list existed (#13), never fills the list.
  if (!window.RWPStats || !window.RWPStats.securityCategory) {
    var listStatus = document.getElementById('list-status');
    if (listStatus) listStatus.textContent = '> category list unavailable';
  }
  // Likewise for a stats.js cached from before the kind column existed (#65).
  if (!window.RWPStats || !window.RWPStats.kindOf) {
    var kindStatusEl = document.getElementById('kind-status');
    if (kindStatusEl) kindStatusEl.textContent = '> kind list unavailable';
  }
  var errorEl = document.getElementById('error');

  // Per-kind map filter (#65, R10.3). Only the main map has both the toggle container and a
  // classifier to drive it; the Bluetooth and Flock pages share this script but have neither, so
  // they keep the single unfiltered layer they have always had. A stats.js cached from before R10
  // has no kindOf either, and degrades the same way.
  var filtersEl = document.getElementById('kind-filters');
  var KINDS = window.RWPStats && window.RWPStats.KINDS;
  var kindClassifier = window.RWPStats && window.RWPStats.kindOf;
  var kindFilterOn = !!(filtersEl && KINDS && kindClassifier);

  function showError(message) {
    var line = document.createElement('p');
    line.style.margin = '0';
    line.textContent = '! ' + message;
    errorEl.appendChild(line);
    errorEl.hidden = false;
  }

  function isEncrypted(auth) {
    return /WEP|WPA|RSN/i.test(String(auth || ''));
  }

  function fetchJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (res) {
      if (!res.ok) throw new Error(url + ' returned HTTP ' + res.status);
      return res.json();
    });
  }

  // [label, value, optional CSS class] per row, in display order.
  function defaultPopupRows(net) {
    var ssid = typeof net.ssid === 'string' && net.ssid.trim() !== '' ? net.ssid : 'hidden';
    return [
      ['SSID', ssid, 'ssid'],
      ['BSSID', net.bssid],
      ['Auth', net.auth || 'unknown'],
      ['Channel', net.channel],
      ['First seen', net.first_seen]
    ];
  }
  var popupRows = CONFIG.popupRows || defaultPopupRows;

  // One colour per record. The WiFi map splits on encryption; other maps are single-colour.
  function defaultKindOf(net) {
    return isEncrypted(net.auth) ? 'encrypted' : 'open';
  }
  var kindOf = CONFIG.kindOf || defaultKindOf;

  function popupFor(net) {
    var dl = document.createElement('dl');
    dl.className = 'net-popup';
    var rows = popupRows(net);
    rows.forEach(function (row) {
      var dt = document.createElement('dt');
      dt.textContent = row[0];
      var dd = document.createElement('dd');
      dd.textContent = row[1] === undefined || row[1] === null || row[1] === '' ? '—' : String(row[1]);
      if (row[2]) dd.className = row[2];
      dl.appendChild(dt);
      dl.appendChild(dd);
    });
    return dl;
  }

  // Coordinates must be real numbers; null, blank, and 0,0 are bad data, not a location.
  function toCoord(value) {
    if (value === null || value === undefined || String(value).trim() === '') return NaN;
    return Number(value);
  }

  // A network's identity is its BSSID, whatever its spelling (case, ':' '-' '.' separators).
  // Returns '' when there is no usable BSSID; such records are still shown.
  function bssidKey(value) {
    if (typeof value !== 'string') return '';
    var hex = value.toLowerCase().replace(/[^0-9a-f]/g, '');
    return hex.length === 12 ? hex : '';
  }

  function formatUpdated(value) {
    if (!value) return 'never';
    var text = String(value);
    // The database stores UTC; treat a zone-less timestamp as UTC rather than viewer-local time.
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text)) text = text.replace(' ', 'T') + 'Z';
    var d = new Date(text);
    if (isNaN(d.getTime())) return String(value);
    return d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z').replace(/:\d\dZ$/, ' UTC');
  }

  if (typeof window.L === 'undefined') {
    statsEl.textContent = '> map unavailable';
    if (window.RWPStats) window.RWPStats.fail();
    showError('The map library failed to load. Check your connection and reload.');
    return;
  }

  var map = L.map('map', {
    zoomControl: true,
    maxBoundsViscosity: 1.0,
    worldCopyJump: false
  });

  // Standard OpenStreetMap tiles: no key or account. Darkened with a CSS filter (.osm-tiles).
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'osm-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  // ~18k networks: one canvas for every marker instead of one SVG element each (#11). The boundary
  // stays SVG. Padding keeps nearby markers drawn while dragging; more would risk mobile canvas limits.
  var markerRenderer = L.canvas({ padding: 0.3 });
  var MARKER_RADIUS = 5;
  // How far from a marker's centre a click still picks it, in CSS pixels: the drawn circle, plus
  // some slop for fingers.
  var COARSE_POINTER = !!(window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
  var HIT_RADIUS = MARKER_RADIUS + 1 + (COARSE_POINTER ? 6 : 0);

  var fenceBounds = null;

  // Lowest zoom at which the whole fenced area still fits the current map size.
  // getBoundsZoom clamps to the current minZoom, so clear it before measuring.
  function updateMinZoom() {
    map.options.minZoom = 0;
    map.setMinZoom(map.getBoundsZoom(fenceBounds, false));
  }

  function fence(bounds) {
    fenceBounds = bounds.pad(0.1);
    map.setMaxBounds(fenceBounds);
    map.fitBounds(bounds);
    updateMinZoom();
  }

  // Keep the zoom-out limit right after a resize or rotation.
  map.on('resize', function () {
    if (fenceBounds) updateMinZoom();
  });

  // Leaflet auto-pans an opening popup into view, but the fence's moveend handler snaps the view
  // straight back, leaving the popup clipped by the map edge (on a tall phone screen the fence is
  // shorter than the map, so there is no room at all). While a popup is open, loosen the fence by
  // that popup's size at the current zoom; the exact fence returns, and pans back, when it closes.
  map.on('autopanstart', function () {
    var popup = map.getPane('popupPane').lastElementChild;
    if (!fenceBounds || !popup) return;
    var zoom = map.getZoom();
    var slack = L.point(popup.offsetWidth + POPUP_SLACK, popup.offsetHeight + POPUP_SLACK);
    map.setMaxBounds(L.latLngBounds(
      map.unproject(map.project(fenceBounds.getNorthWest(), zoom).subtract(slack), zoom),
      map.unproject(map.project(fenceBounds.getSouthEast(), zoom).add(slack), zoom)));
  });

  // Anything that measures the map while it is moving measures a position the map is about to
  // leave (#29). A drag counts: Leaflet stops the running pan at the top of its own dragstart
  // handler, so "no pan animation" alone would read a finger-driven map as settled. Both flags are
  // private; if a future Leaflet drops them the map reads as still and the behaviour is what it
  // was before this guard, not something worse.
  function moving() {
    if (map._panAnim && map._panAnim._inProgress) return true;
    return !!(map.dragging && map.dragging.moving && map.dragging.moving());
  }

  // Run fn once the map has stopped moving. Polled rather than hung off moveend, because Leaflet
  // fires moveend from inside the dragstart that is about to move the map again: work resumed there
  // would start a pan that fights the finger for a quarter of a second. Give up after a couple of
  // seconds and run fn anyway — the fence restore below must happen even if the map somehow never
  // settles (a backgrounded tab freezes an animation mid-flight).
  function whenStill(fn) {
    var deadline = Date.now() + 2000;
    (function check() {
      if (!moving() || Date.now() > deadline) return fn();
      setTimeout(check, 30);
    })();
  }

  // Deferred work is about the view the map was heading for. Once the reader takes the wheel, that
  // view is no longer the one they want, so anything still pending is dropped.
  var takeovers = 0;
  map.on('dragstart zoomstart', function () { takeovers += 1; });

  // Switching markers closes one popup and opens the next in the same tick. Restore the fence only
  // once no popup is open, or its snap-back would pan the new popup out of view again. If a popup
  // reopened before the check, the fence stays loose until that popup closes, which restores it.
  var openPopups = 0;
  // Which marker the open popup belongs to, so hiding that marker's kind can close it (R10.3).
  var openPopupSource = null;
  map.on('popupopen', function (e) {
    openPopups += 1;
    openPopupSource = e.popup && e.popup._source;
    // Leaflet decides whether this popup needs auto-panning into view before it fires popupopen,
    // and it measures against wherever the map is sitting at that instant. Open a popup while the
    // fence's restore pan is still running — a tap on one marker moments after closing another —
    // and it measures a position the map is leaving, so the pan it asks for (or skips) is wrong and
    // the rest of that pan carries the popup off the map edge (#29). Measuring again on a still map
    // fixes it. This runs after most opens, because a popup's own auto-pan is itself a pan in
    // flight here; that case re-measures a popup that already fits, and _adjustPan does nothing.
    if (!moving()) return;
    var popup = e.popup;
    var seen = takeovers;
    whenStill(function () {
      if (takeovers !== seen) return;
      if (map.hasLayer(popup) && popup._adjustPan) popup._adjustPan();
    });
  });
  map.on('popupclose', function () {
    openPopups -= 1;
    openPopupSource = null;
    setTimeout(function () {
      if (!fenceBounds || openPopups !== 0) return;
      // Restoring the fence pans the map back inside it. Doing that while the popup's own auto-pan
      // is still running cuts that animation off and starts a second one from wherever it had got
      // to: one close, two visible pans (#29). Let the first one land. Unlike the re-measure above
      // this is not dropped when the reader takes over — the fence is not a nicety.
      whenStill(function () {
        if (fenceBounds && openPopups === 0) map.setMaxBounds(fenceBounds);
      });
    }, 0);
  });

  // Expose read-only hooks for the smoke test.
  window.__rwp = { map: map, markers: [], fence: function () { return fenceBounds; } };

  // Canvas hit-testing gives a click to the last-drawn marker in range, not the one aimed at, and
  // opens the popup at the click point. So markers are not interactive themselves: a click on the
  // map opens the marker whose centre is nearest, anchored on that centre.
  var projected = { zoom: null, points: [] };

  // Every marker in plot order, and the kinds currently switched off. window.__rwp.markers holds
  // only the visible ones: a hidden marker must not win a click, and the smoke test reads the same
  // list. With every kind on — the default — the two are identical, order included.
  var allMarkers = [];
  var hiddenKinds = {};
  var kindLayers = {};

  function refreshVisibleMarkers() {
    window.__rwp.markers = kindFilterOn
      ? allMarkers.filter(function (m) { return !hiddenKinds[m.options.networkKind]; })
      : allMarkers;
    // The projection cache is keyed on that list; a toggle can change it without changing its
    // length (one kind off, another on), so drop the cache outright rather than letting it guess.
    projected = { zoom: null, points: [] };
  }

  function setKindVisible(id, visible) {
    var layer = kindLayers[id];
    if (!layer) return;
    hiddenKinds[id] = !visible;
    if (visible) {
      if (!map.hasLayer(layer)) layer.addTo(map);
    } else {
      // Removing a marker's layer does not close a popup already open on it.
      if (openPopupSource && openPopupSource.options.networkKind === id) map.closePopup();
      if (map.hasLayer(layer)) map.removeLayer(layer);
    }
    refreshVisibleMarkers();
  }

  // One checkbox per kind, all checked (R10.3). Built here rather than in index.html so the
  // controls only ever exist when there are markers behind them.
  function buildKindFilters() {
    KINDS.forEach(function (k) {
      var item = document.createElement('label');
      item.className = 'filter-item';
      var box = document.createElement('input');
      box.type = 'checkbox';
      box.checked = true;
      box.id = 'kind-toggle-' + k.id;
      box.setAttribute('data-kind', k.id);
      box.addEventListener('change', function () { setKindVisible(k.id, box.checked); });
      var swatch = document.createElement('span');
      swatch.className = 'pie-swatch kind-' + k.id;
      swatch.setAttribute('aria-hidden', 'true');
      var text = document.createElement('span');
      text.className = 'filter-label';
      text.textContent = k.label;
      item.appendChild(box);
      item.appendChild(swatch);
      item.appendChild(text);
      filtersEl.appendChild(item);
    });
    filtersEl.hidden = false;
  }

  function nearestMarker(latlng) {
    var markers = window.__rwp.markers;
    var zoom = map.getZoom();
    if (projected.zoom !== zoom || projected.points.length !== markers.length) {
      projected = { zoom: zoom, points: markers.map(function (m) { return map.project(m.getLatLng(), zoom); }) };
    }
    var at = map.project(latlng, zoom);
    var best = -1;
    var bestDistance = HIT_RADIUS * HIT_RADIUS;
    for (var i = 0; i < projected.points.length; i++) {
      var dx = projected.points[i].x - at.x;
      var dy = projected.points[i].y - at.y;
      var distance = dx * dx + dy * dy;
      // On a tie the later marker wins: it is drawn on top.
      if (distance <= bestDistance) {
        bestDistance = distance;
        best = i;
      }
    }
    return best < 0 ? null : markers[best];
  }

  map.on('click', function (e) {
    var marker = nearestMarker(e.latlng);
    if (marker) marker.openPopup();
  });

  // A pointer cursor over markers, checked at most once per frame. This listens to the DOM, because
  // the canvas renderer drops map mousemove events that come within 32 ms of the last one.
  var hoverFrame = 0;
  var hoverAt = null;
  L.DomEvent.on(map.getContainer(), 'mousemove', function (e) {
    hoverAt = map.mouseEventToLatLng(e);
    if (hoverFrame) return;
    hoverFrame = window.requestAnimationFrame(function () {
      hoverFrame = 0;
      L.DomUtil[nearestMarker(hoverAt) ? 'addClass' : 'removeClass'](map.getContainer(), 'over-marker');
    });
  });
  map.on('mouseout', function () {
    window.cancelAnimationFrame(hoverFrame);
    hoverFrame = 0;
    L.DomUtil.removeClass(map.getContainer(), 'over-marker');
  });

  var boundaryReady = fetchJson(BOUNDARY_URL).then(function (geo) {
    var layer = L.geoJSON(geo, {
      interactive: false,
      style: { color: '#33ff66', weight: 2, opacity: 0.8, fill: false, dashArray: '6 4', className: 'boundary' }
    }).addTo(map);
    fence(layer.getBounds());
  }).catch(function (err) {
    fence(L.latLngBounds(FALLBACK_BOUNDS));
    showError('Could not load the Redlands boundary (' + err.message + ').');
  });

  boundaryReady.then(function () {
    return fetchJson(DB_URL);
  }).then(function (db) {
    var records = db && db[RECORDS_KEY];
    if (!records || !Array.isArray(records)) throw new Error('database is not in the expected format');
    var plotted = 0;
    var skipped = 0;
    var duplicates = 0;
    var seen = Object.create(null);
    // One layer group per kind where the filter runs, so a toggle is a single add/remove; one
    // group for everything where it does not (the Bluetooth and Flock maps).
    var markers = kindFilterOn ? null : L.layerGroup();
    if (kindFilterOn) KINDS.forEach(function (k) { kindLayers[k.id] = L.layerGroup(); });
    var plottedNets = [];
    records.forEach(function (net) {
      var lat = toCoord(net && net.lat);
      var lon = toCoord(net && net.lon);
      if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) {
        skipped += 1;
        return;
      }
      // Defense in depth: the pipeline never stores a BSSID twice, but one marker per network regardless.
      var key = bssidKey(net.bssid);
      if (key) {
        if (seen[key]) {
          duplicates += 1;
          return;
        }
        seen[key] = true;
      }
      var kind = kindOf(net);
      var netKind = kindFilterOn ? kindClassifier(net) : null;
      // The popup is built only when it opens; 18k detached popup trees would cost memory at load.
      var marker = L.circleMarker([lat, lon], {
        renderer: markerRenderer,
        interactive: false,
        kind: kind,
        networkKind: netKind,
        radius: MARKER_RADIUS,
        weight: 1,
        color: '#000',
        fillColor: COLORS[kind],
        fillOpacity: 0.9
      }).bindPopup(function () { return popupFor(net); }, POPUP_OPTIONS)
        .addTo(kindFilterOn ? kindLayers[netKind] : markers);
      allMarkers.push(marker);
      plottedNets.push(net);
      plotted += 1;
    });
    if (kindFilterOn) {
      KINDS.forEach(function (k) { kindLayers[k.id].addTo(map); });
      if (plotted > 0) buildKindFilters();
    } else {
      markers.addTo(map);
    }
    refreshVisibleMarkers();
    statsEl.textContent = '> ' + plotted.toLocaleString('en-US') + ' ' + NOUN + (plotted === 1 ? '' : 's') +
      ' mapped · last updated ' + formatUpdated(db.updated_at);
    // The breakdown counts exactly the networks on the map (#12). A bug there must not blank the map.
    try {
      if (window.RWPStats) window.RWPStats.render(plottedNets);
    } catch (statsErr) {
      console.error(statsErr);
      window.RWPStats.fail();
    }
    if (skipped > 0) {
      console.warn('Skipped ' + skipped + ' ' + NOUN + ' record(s) with invalid coordinates.');
    }
    if (duplicates > 0) {
      console.warn('Skipped ' + duplicates + ' duplicate ' + NOUN + ' record(s) (same BSSID).');
    }
  }).catch(function (err) {
    statsEl.textContent = '> database unavailable';
    if (window.RWPStats) window.RWPStats.fail();
    showError('Could not load the ' + NOUN + ' database (' + err.message + '). Please try again later.');
  });
})();
