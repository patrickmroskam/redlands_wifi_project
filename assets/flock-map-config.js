/* Redlands Wifi Project — Flock camera map configuration. Read by assets/map.js. */
window.RWPMapConfig = {
  dbUrl: 'data/flock.json',
  recordsKey: 'devices',
  noun: 'camera',
  colors: { camera: '#ff3355' },
  kindOf: function () { return 'camera'; },
  popupRows: function (camera) {
    var ssid = typeof camera.ssid === 'string' && camera.ssid.trim() !== '' ? camera.ssid : 'hidden';
    return [
      ['SSID', ssid, 'ssid'],
      ['BSSID', camera.bssid],
      // Which rule in data/flock-rules.json put this marker here, so the claim is auditable.
      ['Matched by', camera.matched_by],
      ['First seen', camera.first_seen]
    ];
  }
};
