/* Redlands Wifi Project — security breakdown under the map (#12). Plain script, no build step.
   map.js calls RWPStats.render() with the networks it plotted, or RWPStats.fail() when it can't. */
(function () {
  'use strict';

  // Slice and legend order. Colours are in site.css (.cat-<id>).
  var CATEGORIES = [
    { id: 'default', label: 'Default-looking' },
    { id: 'open', label: 'Open' },
    { id: 'wep', label: 'WEP' },
    { id: 'wpa', label: 'WPA' },
    { id: 'wpa-wpa2', label: 'WPA/WPA2' },
    { id: 'wpa2', label: 'WPA2' },
    { id: 'wpa2-enterprise', label: 'WPA2 Enterprise' },
    { id: 'wpa2-wpa3', label: 'WPA2/WPA3' },
    { id: 'wpa3', label: 'WPA3' },
    { id: 'other', label: 'Other' }
  ];

  // SSIDs that still carry an ISP or router factory name. Each pattern needs the factory id part,
  // so a renamed network ("Frontier Speedy") does not count. Documented in data/README.md.
  var DEFAULT_SSID_PATTERNS = [
    /^spectrum ?setup/i,                          // SpectrumSetup-XX
    /^myspectrumwifi/i,                           // MySpectrumWiFiXX-2G
    /^spectrum[-_ ]?\d+$/i,                       // Spectrum1234
    /^frontier\d{3,}/i,                           // Frontier1234
    /^att-wifi-\d{4}/i,                           // ATT-WIFI-1234
    /^att(?=[a-z]*\d)[0-9a-z]{7}$/i,              // ATTa1b2c3d (must hold a digit)
    /^centurylink\d{4}/i,                         // CenturyLink1234
    /^tmobile-[0-9a-f]{4}/i,                      // TMOBILE-1A2B, TMOBILE-1A2B_EXT
    /^verizon[-_][0-9a-z]{4,6}(?![0-9a-z])/i,     // Verizon-1E06, Verizon_AB12CD
    /^verizon-(mifi|m\d{4}-|sm-)/i,               // Verizon hotspots: MiFi8800L, M2100, SM-G781V
    /^netgear(\d{2}|-?guest$|_?ext$|$)/i,         // NETGEAR42, NETGEAR42-5G, NETGEAR-Guest
    /^orbi(\d{2}|$)/i,                            // ORBI12, ORBI12-Guest
    /^tp-link_([0-9a-f]{6}|[0-9a-f]{4})(?![0-9a-z])/i, // TP-Link_1A2B, TP-LINK_1B8B_5G
    /^linksys\d{5}/i,                             // Linksys01234, Linksys01234-guest
    /^direct-/i,                                  // DIRECT-xx-HP … (printers, Wi-Fi Direct)
    /^dlink(-[0-9a-f]{4}|$)/i,                    // dlink-1A2B
    /^asus(_[0-9a-f]{2,4}|_?[25]g|\d{2})?([-_ ].*)?$/i, // ASUS, ASUS_5G, ASUS_9C28, ASUS22
    /^tenda_[0-9a-f]{4,6}/i,                      // Tenda_22F7F0
    /^xfinitywifi$/i,                             // xfinitywifi
    /^xfsetup-[0-9a-f]{4}/i                       // XFSETUP-1A2B
  ];

  // Encrypted auth strings (brackets removed) as the ESP32 Marauder logs them.
  var AUTH_CATEGORY = {
    WEP: 'wep',
    WPA_PSK: 'wpa',
    WPA_WPA2_PSK: 'wpa-wpa2',
    WPA2_PSK: 'wpa2',
    WPA2: 'wpa2-enterprise',
    WPA2_WPA3_PSK: 'wpa2-wpa3',
    WPA3_PSK: 'wpa3',
    WPA3: 'wpa3'
  };

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function isDefaultLooking(ssid) {
    if (typeof ssid !== 'string' || ssid.trim() === '') return false; // hidden networks never are
    for (var i = 0; i < DEFAULT_SSID_PATTERNS.length; i++) {
      if (DEFAULT_SSID_PATTERNS[i].test(ssid)) return true;
    }
    return false;
  }

  // Must agree with isEncrypted() in map.js, so the Open slice matches the amber markers.
  function isEncrypted(auth) {
    return /WEP|WPA|RSN/i.test(String(auth || ''));
  }

  function classify(net) {
    net = net || {};
    if (isDefaultLooking(net.ssid)) return 'default';
    var auth = String(net.auth == null ? '' : net.auth).toUpperCase();
    if (!isEncrypted(auth)) return 'open';
    if (/EAP|ENTERPRISE/.test(auth)) return 'wpa2-enterprise';
    return AUTH_CATEGORY[auth.replace(/[\[\]\s]/g, '')] || 'other';
  }

  function countCategories(nets) {
    var counts = {};
    CATEGORIES.forEach(function (c) { counts[c.id] = 0; });
    (nets || []).forEach(function (net) { counts[classify(net)] += 1; });
    return counts;
  }

  // Percentages to one decimal that add up to exactly 100 (largest remainder), keyed by category.
  function percentages(counts) {
    var total = 0;
    CATEGORIES.forEach(function (c) { total += counts[c.id] || 0; });
    var result = {};
    if (total === 0) return result;
    var rows = CATEGORIES.map(function (c, i) {
      var exact = (counts[c.id] || 0) * 1000 / total; // in tenths of a percent
      return { id: c.id, order: i, tenths: Math.floor(exact), rest: exact - Math.floor(exact) };
    });
    var left = 1000 - rows.reduce(function (sum, r) { return sum + r.tenths; }, 0);
    rows.slice().sort(function (a, b) { return b.rest - a.rest || a.order - b.order; })
      .slice(0, left).forEach(function (r) { r.tenths += 1; });
    rows.forEach(function (r) { result[r.id] = r.tenths / 10; });
    return result;
  }

  function svg(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, String(attrs[k])); });
    return el;
  }

  function point(fraction) {
    var angle = 2 * Math.PI * fraction - Math.PI / 2; // start at 12 o'clock, go clockwise
    return (Math.cos(angle)).toFixed(5) + ' ' + (Math.sin(angle)).toFixed(5);
  }

  function formatCount(n) {
    return n.toLocaleString('en-US');
  }

  var status = document.getElementById('security-status');
  var chart = document.getElementById('security-chart');

  function clear() {
    while (chart.firstChild) chart.removeChild(chart.firstChild);
    chart.hidden = true;
  }

  function setStatus(text) {
    status.textContent = text;
    status.hidden = false;
  }

  function render(nets) {
    if (!status || !chart) return;
    clear();
    var counts = countCategories(nets);
    var total = (nets || []).length;
    if (total === 0) {
      setStatus('> no networks mapped yet');
      return;
    }
    var pct = percentages(counts);
    var slices = CATEGORIES.filter(function (c) { return counts[c.id] > 0; });

    var pie = svg('svg', {
      viewBox: '-1.05 -1.05 2.1 2.1',
      role: 'img',
      'aria-labelledby': 'security-pie-title',
      'aria-describedby': 'security-summary',
      'class': 'pie'
    });
    var title = svg('title', { id: 'security-pie-title' });
    title.textContent = 'Pie chart: how the ' + formatCount(total) + ' mapped networks are secured';
    pie.appendChild(title);

    var start = 0;
    slices.forEach(function (c) {
      var share = counts[c.id] / total;
      var shape;
      if (slices.length === 1) {
        shape = svg('circle', { cx: 0, cy: 0, r: 1 });
      } else {
        var end = start + share;
        shape = svg('path', {
          d: 'M0 0L' + point(start) + 'A1 1 0 ' + (share > 0.5 ? 1 : 0) + ' 1 ' + point(end) + 'Z'
        });
        start = end;
      }
      shape.setAttribute('class', 'slice cat-' + c.id);
      shape.setAttribute('data-category', c.id);
      pie.appendChild(shape);
    });

    var legend = document.createElement('ul');
    legend.className = 'pie-legend';
    legend.id = 'security-legend';
    var summary = [];
    slices.forEach(function (c) {
      var li = document.createElement('li');
      li.setAttribute('data-category', c.id);
      var swatch = document.createElement('span');
      swatch.className = 'pie-swatch cat-' + c.id;
      swatch.setAttribute('aria-hidden', 'true');
      var label = document.createElement('span');
      label.className = 'pie-label';
      label.textContent = c.label;
      var value = document.createElement('span');
      value.className = 'pie-value';
      var shown = pct[c.id].toFixed(1) + '%';
      value.textContent = shown + ' (' + formatCount(counts[c.id]) + ')';
      li.appendChild(swatch);
      li.appendChild(label);
      li.appendChild(value);
      legend.appendChild(li);
      summary.push(c.label + ' ' + shown);
    });

    var summaryEl = document.createElement('p');
    summaryEl.id = 'security-summary';
    summaryEl.className = 'visually-hidden';
    summaryEl.textContent = formatCount(total) + ' networks: ' + summary.join(', ') + '.';

    var totalEl = document.createElement('p');
    totalEl.className = 'pie-total';
    totalEl.textContent = '> ' + formatCount(total) + ' network' + (total === 1 ? '' : 's') + ' classified';

    chart.appendChild(pie);
    chart.appendChild(summaryEl);
    chart.appendChild(legend);
    chart.appendChild(totalEl);
    status.hidden = true;
    chart.hidden = false;
  }

  function fail() {
    if (!status || !chart) return;
    clear();
    setStatus('> security breakdown unavailable');
  }

  window.RWPStats = {
    CATEGORIES: CATEGORIES,
    DEFAULT_SSID_PATTERNS: DEFAULT_SSID_PATTERNS,
    classify: classify,
    countCategories: countCategories,
    percentages: percentages,
    render: render,
    fail: fail
  };
})();
