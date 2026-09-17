/* Redlands Wifi Project — network breakdown under the map: security pie (#12) and category list (#13).
   Plain script, no build step. map.js calls RWPStats.render() with the networks it plotted, or
   RWPStats.fail() when it can't; both columns always show the same data and the same state. */
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
  // Factory suffixes routers add after the name: -Guest, -IoT, _EXT, -5G, -2.4G, _2G_Guest …
  var SUFFIX = '([-_ ]?(guest\\d*|iot|ext|2g|5g|2\\.4g|2\\.4ghz|5ghz))*';
  var DEFAULT_SSID_PATTERNS = [
    /^spectrum ?setup/i,                          // SpectrumSetup-XX
    /^myspectrumwifi/i,                           // MySpectrumWiFiXX-2G
    /^spectrum[-_ ]?\d+$/i,                       // Spectrum1234
    /^frontier\d{3,}/i,                           // Frontier1234
    /^att-wifi-\d{4}/i,                           // ATT-WIFI-1234
    /^att(?=[a-z]*\d)[0-9a-z]{7}(_ext)?$/i,       // ATTa1b2c3d, ATTa1b2c3d_EXT (must hold a digit)
    /^centurylink\d{4}/i,                         // CenturyLink1234
    /^tmobile-[0-9a-f]{4}/i,                      // TMOBILE-1A2B, TMOBILE-1A2B_EXT
    /^verizon[-_][0-9a-z]{4,6}(?![0-9a-z])/i,     // Verizon-1E06, Verizon_AB12CD
    /^verizon-(mifi|m\d{4}-|sm-)/i,               // Verizon hotspots: MiFi8800L, M2100, SM-G781V
    /^netgear(\d{2}|-?guest$|_?ext$|$)/i,         // NETGEAR42, NETGEAR42-5G, NETGEAR-Guest
    new RegExp('^orbi(\\d{2})?' + SUFFIX + '$', 'i'), // ORBI, ORBI12, ORBI12-Guest
    /^tp-link_([0-9a-f]{6}|[0-9a-f]{4})(?![0-9a-z])/i, // TP-Link_1A2B, TP-LINK_1B8B_5G
    /^linksys\d{5}/i,                             // Linksys01234, Linksys01234-guest
    /^direct-/i,                                  // DIRECT-xx-HP … (printers, Wi-Fi Direct)
    /^dlink(-[0-9a-f]{4}|$)/i,                    // dlink-1A2B
    new RegExp('^asus(_[0-9a-f]{2,4}|\\d{2})?' + SUFFIX + '$', 'i'), // ASUS, ASUS_5G, ASUS_9C28, ASUS22
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

  // Must agree with isEncrypted() in map.js: every Open network is an amber marker. (Amber markers with a
  // default-looking name count in that slice instead, so the Open slice can be smaller than the amber count.)
  function isEncrypted(auth) {
    return /WEP|WPA|RSN/i.test(String(auth || ''));
  }

  // The category a network's auth string alone puts it in (never 'default').
  function securityCategory(net) {
    net = net || {};
    var auth = String(net.auth == null ? '' : net.auth).toUpperCase();
    if (!isEncrypted(auth)) return 'open';
    if (/EAP|ENTERPRISE/.test(auth)) return 'wpa2-enterprise';
    return AUTH_CATEGORY[auth.replace(/[\[\]\s]/g, '')] || 'other';
  }

  function classify(net) {
    net = net || {};
    return isDefaultLooking(net.ssid) ? 'default' : securityCategory(net);
  }

  function isHidden(net) {
    var ssid = (net || {}).ssid;
    return typeof ssid !== 'string' || ssid.trim() === '';
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
  var listStatus = document.getElementById('list-status');
  var list = document.getElementById('category-list');

  function empty(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    el.hidden = true;
  }

  function clear() {
    empty(chart);
    empty(list);
  }

  function setStatus(text, screenReaderOnly) {
    status.textContent = text;
    status.classList.toggle('visually-hidden', !!screenReaderOnly);
  }

  // The list's status is not a live region: the pie's status already announces every change.
  function setListStatus(text) {
    if (!listStatus) return;
    listStatus.textContent = text || '';
    listStatus.hidden = !text;
  }

  function cell(tag, text, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  // One table row. opts.swatch draws the category colour; opts.context is read by screen readers only.
  function row(className, category, label, count, share, opts) {
    opts = opts || {};
    var tr = document.createElement('tr');
    tr.className = className;
    tr.setAttribute('data-category', category);
    var th = cell('th', null, 'cat-name');
    th.setAttribute('scope', 'row');
    if (opts.swatch) {
      var sw = cell('span', null, 'pie-swatch cat-' + category);
      sw.setAttribute('aria-hidden', 'true');
      th.appendChild(sw);
    }
    if (opts.context) th.appendChild(cell('span', opts.context + ' ', 'visually-hidden'));
    th.appendChild(cell('span', label, 'cat-label'));
    tr.appendChild(th);
    tr.appendChild(cell('td', count, 'cat-count'));
    tr.appendChild(cell('td', share, 'cat-share'));
    return tr;
  }

  // Right column (#13): the same numbers as the pie, as a table, plus the default-looking split.
  // split = security categories of the default-looking networks; hidden = blank-name count.
  function renderList(counts, split, hidden, pct, total) {
    if (!list) return;

    var table = cell('table', null, 'cat-table');
    table.id = 'category-table';
    table.appendChild(cell('caption', 'Networks by category', 'visually-hidden'));
    var head = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['Category', 'Networks', 'Share'].forEach(function (text) {
      var th = cell('th', text);
      th.setAttribute('scope', 'col');
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    var body = document.createElement('tbody');
    CATEGORIES.forEach(function (c) {
      body.appendChild(row('cat-row', c.id, c.label, formatCount(counts[c.id]),
        pct[c.id].toFixed(1) + '%', { swatch: true }));
      if (c.id !== 'default') return;
      CATEGORIES.forEach(function (s) {
        if (s.id === 'default' || split[s.id] === 0) return;
        // The share cell stays blank so the Share column still adds up to 100%.
        body.appendChild(row('sub-row', s.id, 'on\u00a0' + s.label, formatCount(split[s.id]), '',
          { context: c.label }));
      });
    });
    table.appendChild(body);

    var foot = document.createElement('tfoot');
    foot.appendChild(row('total-row', 'total', 'Total', formatCount(total), '100.0%'));
    table.appendChild(foot);

    list.appendChild(table);
    list.appendChild(cell('p', '> ' + formatCount(hidden) + ' hidden network' + (hidden === 1 ? '' : 's') +
      ' (blank name), counted under their security type', 'col-note hidden-note'));
    list.hidden = false;
    setListStatus('');
  }

  function render(nets) {
    if (!status || !chart) return;
    clear();
    nets = nets || [];
    // One pass: category counts for both columns, plus the list's default-looking split and hidden count.
    var counts = {};
    var split = {};
    var hidden = 0;
    CATEGORIES.forEach(function (c) { counts[c.id] = 0; split[c.id] = 0; });
    nets.forEach(function (net) {
      var category = classify(net);
      counts[category] += 1;
      if (category === 'default') split[securityCategory(net)] += 1;
      if (isHidden(net)) hidden += 1;
    });
    var total = nets.length;
    if (total === 0) {
      setStatus('> no networks mapped yet');
      setListStatus('> no networks mapped yet');
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
    chart.hidden = false;
    renderList(counts, split, hidden, pct, total);
    // The status line is the live region: keep it for screen readers so they hear the chart arrive.
    setStatus('> security breakdown loaded: ' + formatCount(total) + ' networks classified', true);
  }

  function fail() {
    if (!status || !chart) return;
    clear();
    setStatus('> security breakdown unavailable');
    setListStatus('> category list unavailable');
  }

  window.RWPStats = {
    CATEGORIES: CATEGORIES,
    DEFAULT_SSID_PATTERNS: DEFAULT_SSID_PATTERNS,
    classify: classify,
    securityCategory: securityCategory,
    countCategories: countCategories,
    percentages: percentages,
    render: render,
    fail: fail
  };
})();
