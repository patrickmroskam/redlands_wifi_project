/* Redlands Wifi Project — network breakdown under the map: security pie (#12), category list (#13)
   and the kind split (#65, PRD R10). Plain script, no build step. map.js calls RWPStats.render()
   with the networks it plotted, or RWPStats.fail() when it can't; all three columns always show the
   same data and the same state.

   Two independent axes describe the same network:
     - security — how it is encrypted (CATEGORIES / classify), with `Default-looking` overriding.
     - kind     — what the device is (KINDS / kindOf), added by R10 for the map's per-kind filter.
   They are deliberately not merged: DIRECT-7F-HP is `Default-looking` on the security axis (its
   factory name is what makes it interesting there) and `Wi-Fi Direct / printer` on the kind axis. */
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

  // ---- Kind axis (#65, PRD R10) ----------------------------------------------------------------
  // What the device is, as opposed to how it is secured. Toggle order on the map, and row order in
  // the breakdown. Colours are in site.css (.kind-<id>).
  var KINDS = [
    { id: 'vehicle', label: 'Vehicle' },
    { id: 'phone', label: 'Phone / hotspot' },
    { id: 'direct', label: 'Wi-Fi Direct / printer' },
    { id: 'default', label: 'Default-looking' },
    { id: 'hidden', label: 'Hidden' },
    { id: 'named', label: 'Named' }
  ];

  // Factory naming schemes for in-car head units and their hotspots. Patterns are anchored at the
  // start unless the comment says otherwise: a maker's name is a prefix, and loose in the middle it
  // matches ordinary words (Audiology, DodgerFam, Oxford908, RUConnected, Leaky Sync, ScreenAudio…).
  // An owner-renamed car ("Christinas VW", "DAVID CHEVY", "CodyGMC") is deliberately NOT a match:
  // a made-up name is not evidence of a device class, and the make is just as likely to be a hobby.
  // Tesla is absent on purpose — TeslaPW_/TeslaPV_/TeslaWallConnector_ are the Powerwall, the solar
  // inverter and the home charger, i.e. fixed equipment, and nothing here names a Tesla car.
  var VEHICLE_SSID_PATTERNS = [
    /^my ?(chevrolet|gmc|buick|cadillac)/i,         // GM OnStar: myChevrolet 3B64, myGMC1057, MyChevrolet
    /^(chevrolet|gmc|buick|cadillac)[-_ ]?\d{4}/i,  // same, upper-case: CHEVROLET1347, GMC_4005, BUICK2169
    /^(chevy|buick|gmc|cadillac) wi-?fi$/i,         // older GM scheme: Chevy WiFi, Buick WiFi
    /^toyota [a-z0-9]/i,                            // TOYOTA Camry_850CC6612CD1, TOYOTA RAV4-2.4g_703adb
    /^toyotasecure$/i,                              // Toyota's factory guest SSID
    /^lexus [a-z]{2}_[0-9a-f]{12}$/i,               // LEXUS ES_BBDEC3CC1098
    /^mazda[-_]/i,                                  // Mazda_2017888db0d8, Mazda-c02972
    /^honda\d{4}/i,                                 // HONDA1359, HONDA5460ll
    /^hyundai_[0-9a-z]{4}$/i,                       // Hyundai_Ic1q
    /^kia_[0-9a-z]{4}$/i,                           // Kia_2fTI — "KiaraCam" is not a Kia
    /^my vw \d{4}$/i,                               // VW Car-Net: My VW 6616
    /^audi_mmi/i,                                   // Audi_MMI_8140 — bare "Audi" is Audiology/AudioVisual
    /^porsche_wlan_\d/i,                            // Porsche_WLAN_4345
    /^(my )?bmw ?\d{4,5}( carplay)?$/i,             // BMW 49508, BMW02628 CarPlay
    /^my bmw hotspot \d/i,                          // My BMW Hotspot 4613
    /^mini\d{4,5} carplay$/i,                       // MINI07333 CarPlay (BMW Group)
    /^mb (hotspot|wlan) \d/i,                       // Mercedes-Benz: MB Hotspot 7636284, MB WLAN 37248
    /^my ?rogue\d/i,                                // Nissan: MY ROGUE0409
    /^nissan rse$/i,                                // Nissan rear-seat entertainment
    /^infiniti-/i,                                  // INFINITI-RSI
    /^sync_[0-9a-z]{8}$/i,                          // Ford SYNC: SYNC_XP9WT5H3 — "Leaky Sync" is not
    /^uconnect/i,                                   // Stellantis: uconnectadpt — "RUConnected" is not
    /^carplay[-_ ]?(wifi[-_])?[0-9a-f]{4}/i,        // CarPlay_6cf8, carplay_wifi_2E57 (aftermarket units)
    /^carplaybox_/i,                                // CarPlayBox_0584
    // The next two read like phones, but their BSSIDs sit on the same telematics OUIs as the
    // TOYOTA head units above (fc:98:16, c0:40:8d, ec:d9:09, c4:b7:57, e0:2d:f0, 2c:d1:c6, d4:4d:a4),
    // so they are in-car radios: "smartphone projection" is the industry term for CarPlay/Android Auto.
    /^smartphone_(connect|projection)_[0-9a-f]{4,6}$/i, // Smartphone_connect_1a523b
    /^vehicle hotspot$/i                            // factory name, seen on six telematics OUIs here
  ];

  // Phones, tablets and mobile-broadband pucks. Checked after VEHICLE_SSID_PATTERNS, so a car's
  // hotspot ("My BMW Hotspot 4613", "MB Hotspot 03117") is a Vehicle rather than a phone.
  var PHONE_SSID_PATTERNS = [
    /hotspot/i,                                     // anywhere: Hotspot85FA, Cannon Hotspot, MCIHotspot
    /\bip(hone|ad)/i,                               // Ethans Iphone, Z iPhone, DPW-iPad-JNH4Q6VL7T
    /\bgalaxy (s|a|z|j|m|note|tab|flip|fold)[ _]?[a-z]?\d/i, // Galaxy S24 66BC, Galaxy Tab A7 Lite5479
    /^androidap/i,                                  // AndroidAP_9257, AndroidAp_RD
    /^pixel[ _-]?\d/i,                              // Google Pixel — "Spectrum pixel" is not
    /\bmifi/i,                                      // Wy Mifi, Verizon-MiFi8800L-1E50
    /cellspot/i,                                    // T-Mobile CellSpot_2.4GHz_8C48, tgmCellspot
    /\bfranklin t\d+ \d/i,                          // Franklin T10 0390 — bare "Franklin WiFi" is a place
    /^moxee tether/i,                               // Moxee Tether29_2.4G
    /^redmi /i,                                     // Redmi Note 14 Pro 5G
    /^nokia-[a-z]\d{3}$/i                           // NOKIA-C031
  ];

  // Wi-Fi Direct peer-to-peer groups: printers, TVs, and the odd car head unit (DIRECT-BMW 16740).
  // This wins over Vehicle and Default-looking because the prefix says what the radio IS — a
  // Wi-Fi Direct group owner — while the rest of the name only hints at what is behind it.
  // `/^direct-/i` is also in DEFAULT_SSID_PATTERNS; the security axis keeps it, this axis takes it first.
  var WIFI_DIRECT_SSID_PATTERNS = [
    /^direct-/i                                     // DIRECT-7F-HP OfficeJet Pro, DIRECT-9e-AndroidAP
  ];

  // Kind precedence: first group whose pattern matches wins, so every network gets exactly one kind
  // (R10.1). Hidden is decided before any of them, Named is the fallback after all of them.
  var KIND_PATTERNS = [
    { id: 'direct', patterns: WIFI_DIRECT_SSID_PATTERNS },
    { id: 'vehicle', patterns: VEHICLE_SSID_PATTERNS },
    { id: 'phone', patterns: PHONE_SSID_PATTERNS },
    { id: 'default', patterns: DEFAULT_SSID_PATTERNS }
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

  // The one kind a network belongs to (R10.1). Hidden first: a blank name cannot match a pattern,
  // and a network with no name is worth its own row. Named is the fallback.
  function kindOf(net) {
    if (isHidden(net)) return 'hidden';
    var ssid = String((net || {}).ssid);
    for (var i = 0; i < KIND_PATTERNS.length; i++) {
      var group = KIND_PATTERNS[i];
      for (var j = 0; j < group.patterns.length; j++) {
        if (group.patterns[j].test(ssid)) return group.id;
      }
    }
    return 'named';
  }

  function countKinds(nets) {
    var counts = {};
    KINDS.forEach(function (k) { counts[k.id] = 0; });
    (nets || []).forEach(function (net) { counts[kindOf(net)] += 1; });
    return counts;
  }

  var CATEGORY_IDS = CATEGORIES.map(function (c) { return c.id; });
  var KIND_IDS = KINDS.map(function (k) { return k.id; });

  // Percentages to one decimal that add up to exactly 100 (largest remainder), keyed by id.
  // `ids` is the axis to total over, in display order; it defaults to the security categories.
  function percentages(counts, ids) {
    ids = ids || CATEGORY_IDS;
    var total = 0;
    ids.forEach(function (id) { total += counts[id] || 0; });
    var result = {};
    if (total === 0) return result;
    var rows = ids.map(function (id, i) {
      var exact = (counts[id] || 0) * 1000 / total; // in tenths of a percent
      return { id: id, order: i, tenths: Math.floor(exact), rest: exact - Math.floor(exact) };
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
  var kindStatus = document.getElementById('kind-status');
  var kindList = document.getElementById('kind-list');

  function empty(el) {
    if (!el) return;
    while (el.firstChild) el.removeChild(el.firstChild);
    el.hidden = true;
  }

  function clear() {
    empty(chart);
    empty(list);
    empty(kindList);
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

  function setKindStatus(text) {
    if (!kindStatus) return;
    kindStatus.textContent = text || '';
    kindStatus.hidden = !text;
  }

  function cell(tag, text, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null) el.textContent = text;
    return el;
  }

  // One table row. opts.swatch draws the slice colour; opts.context is read by screen readers only.
  // opts.attr / opts.swatchPrefix let the kind table key itself on data-kind and .kind-<id> instead,
  // so the two axes never collide on a selector even where they share an id (see 'default' below).
  function row(className, category, label, count, share, opts) {
    opts = opts || {};
    var tr = document.createElement('tr');
    tr.className = className;
    tr.setAttribute(opts.attr || 'data-category', category);
    var th = cell('th', null, 'cat-name');
    th.setAttribute('scope', 'row');
    if (opts.swatch) {
      var sw = cell('span', null, 'pie-swatch ' + (opts.swatchPrefix || 'cat-') + category);
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

  // Third column (#65, R10.2): what the devices are, as counts and shares of the same plotted total.
  // This describes the whole database even when the map's per-kind toggles are hiding markers (R10.3).
  function renderKinds(counts, pct, total) {
    if (!kindList) return;

    var table = cell('table', null, 'cat-table');
    table.id = 'kind-table';
    table.appendChild(cell('caption', 'Networks by kind', 'visually-hidden'));
    var head = document.createElement('thead');
    var headRow = document.createElement('tr');
    ['Kind', 'Networks', 'Share'].forEach(function (text) {
      var th = cell('th', text);
      th.setAttribute('scope', 'col');
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);

    var body = document.createElement('tbody');
    KINDS.forEach(function (k) {
      body.appendChild(row('kind-row', k.id, k.label, formatCount(counts[k.id]),
        pct[k.id].toFixed(1) + '%', { swatch: true, attr: 'data-kind', swatchPrefix: 'kind-' }));
    });
    table.appendChild(body);

    var foot = document.createElement('tfoot');
    foot.appendChild(row('total-row', 'total', 'Total', formatCount(total), '100.0%',
      { attr: 'data-kind' }));
    table.appendChild(foot);

    kindList.appendChild(table);
    kindList.appendChild(cell('p', '> a network has exactly one kind, guessed from its name', 'col-note'));
    kindList.hidden = false;
    setKindStatus('');
  }

  function render(nets) {
    if (!status || !chart) return;
    clear();
    nets = nets || [];
    // One pass: category counts for both columns, plus the list's default-looking split and hidden count.
    var counts = {};
    var split = {};
    var kinds = {};
    var hidden = 0;
    CATEGORIES.forEach(function (c) { counts[c.id] = 0; split[c.id] = 0; });
    KINDS.forEach(function (k) { kinds[k.id] = 0; });
    nets.forEach(function (net) {
      var category = classify(net);
      counts[category] += 1;
      if (category === 'default') split[securityCategory(net)] += 1;
      kinds[kindOf(net)] += 1;
      if (isHidden(net)) hidden += 1;
    });
    var total = nets.length;
    if (total === 0) {
      setStatus('> no networks mapped yet');
      setListStatus('> no networks mapped yet');
      setKindStatus('> no networks mapped yet');
      return;
    }
    var pct = percentages(counts);
    var kindPct = percentages(kinds, KIND_IDS);
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
    renderKinds(kinds, kindPct, total);
    // The status line is the live region: keep it for screen readers so they hear the chart arrive.
    setStatus('> security breakdown loaded: ' + formatCount(total) + ' networks classified', true);
  }

  function fail() {
    if (!status || !chart) return;
    clear();
    setStatus('> security breakdown unavailable');
    setListStatus('> category list unavailable');
    setKindStatus('> kind list unavailable');
  }

  window.RWPStats = {
    CATEGORIES: CATEGORIES,
    KINDS: KINDS,
    DEFAULT_SSID_PATTERNS: DEFAULT_SSID_PATTERNS,
    KIND_PATTERNS: KIND_PATTERNS,
    classify: classify,
    kindOf: kindOf,
    securityCategory: securityCategory,
    countCategories: countCategories,
    countKinds: countKinds,
    percentages: percentages,
    render: render,
    fail: fail
  };
})();
