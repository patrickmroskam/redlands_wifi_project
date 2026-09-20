/* Redlands Wifi Project — Bluetooth map configuration. Read by assets/map.js. */
window.RWPMapConfig = {
  dbUrl: 'data/bluetooth.json',
  recordsKey: 'devices',
  noun: 'device',
  // One colour: unlike WiFi there is no encryption state to split on.
  colors: { device: '#00d0ff' },
  kindOf: function () { return 'device'; },
  popupRows: function (device) {
    var name = typeof device.name === 'string' && device.name.trim() !== '' ? device.name : 'unnamed';
    return [
      ['Name', name, 'ssid'],
      ['Address', device.bssid],
      ['First seen', device.first_seen]
    ];
  }
};
