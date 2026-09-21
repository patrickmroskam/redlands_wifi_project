/* Redlands Wifi Project — Flock camera map configuration. Read by assets/map.js. */
window.RWPMapConfig = {
  dbUrl: 'data/flock.json',
  recordsKey: 'devices',
  noun: 'camera',
  colors: { camera: '#ff3355' },
  kindOf: function () { return 'camera'; },
  popupRows: function (camera) {
    // A camera keeps the shape of the row it was heard on (R9.3): a WiFi camera has an
    // ssid, a Bluetooth one has only an advertised name and no auth or channel.
    var ble = !('ssid' in camera) && typeof camera.name === 'string';
    var label = ble ? camera.name : camera.ssid;
    label = typeof label === 'string' && label.trim() !== '' ? label : (ble ? 'unnamed' : 'hidden');
    return [
      [ble ? 'Name' : 'SSID', label, 'ssid'],
      [ble ? 'Address' : 'BSSID', camera.bssid],
      // Which rule in data/flock-rules.json put this marker here, so the claim is auditable.
      ['Matched by', camera.matched_by],
      ['First seen', camera.first_seen]
    ];
  }
};
