/* Redlands Wifi Project — map. Plain script, no build step. */
(function () {
  'use strict';

  var DB_URL = 'data/networks.json';
  var BOUNDARY_URL = 'data/redlands-boundary.geojson';
  // Used only if the boundary file fails to load: bbox of ZCTA 92373 + 92374.
  var FALLBACK_BOUNDS = [[33.93438, -117.24996], [34.09923, -117.03414]];
  var COLORS = { encrypted: '#33ff66', open: '#ffb000' };

  var statsEl = document.getElementById('stats');
  var errorEl = document.getElementById('error');

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

  function popupFor(net) {
    var dl = document.createElement('dl');
    dl.className = 'net-popup';
    var ssid = typeof net.ssid === 'string' && net.ssid.trim() !== '' ? net.ssid : 'hidden';
    var rows = [
      ['SSID', ssid, 'ssid'],
      ['BSSID', net.bssid],
      ['Auth', net.auth || 'unknown'],
      ['Channel', net.channel],
      ['First seen', net.first_seen]
    ];
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

  // Expose read-only hooks for the smoke test.
  window.__rwp = { map: map, markers: [] };

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
    if (!db || !Array.isArray(db.networks)) throw new Error('database is not in the expected format');
    var plotted = 0;
    var skipped = 0;
    var duplicates = 0;
    var seen = Object.create(null);
    db.networks.forEach(function (net) {
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
      var kind = isEncrypted(net.auth) ? 'encrypted' : 'open';
      var marker = L.circleMarker([lat, lon], {
        radius: 5,
        weight: 1,
        color: '#000',
        fillColor: COLORS[kind],
        fillOpacity: 0.9,
        className: 'net-marker net-' + kind
      }).bindPopup(popupFor(net)).addTo(map);
      window.__rwp.markers.push(marker);
      plotted += 1;
    });
    statsEl.textContent = '> ' + plotted.toLocaleString('en-US') + ' network' + (plotted === 1 ? '' : 's') +
      ' mapped · last updated ' + formatUpdated(db.updated_at);
    if (skipped > 0) {
      console.warn('Skipped ' + skipped + ' network record(s) with invalid coordinates.');
    }
    if (duplicates > 0) {
      console.warn('Skipped ' + duplicates + ' duplicate network record(s) (same BSSID).');
    }
  }).catch(function (err) {
    statsEl.textContent = '> database unavailable';
    showError('Could not load the network database (' + err.message + '). Please try again later.');
  });
})();
