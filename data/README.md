# data/

Files the site reads. Both are committed; neither is ever placed in `ingest/`.

## `networks.json` — the database

Written only by the ingest pipeline (`scripts/ingest.py`, run by the daily job).
It is valid JSON with one network per line, so diffs stay readable. Shape:

```json
{
  "updated_at": "2026-09-16T00:00:00Z",
  "count": 0,
  "networks": [
    {
      "bssid": "aa:bb:cc:dd:ee:ff",
      "ssid": "Example",
      "auth": "[WPA2_PSK]",
      "channel": 6,
      "first_seen": "2026-09-16 12:34:56",
      "lat": 34.0556,
      "lon": -117.1825
    }
  ]
}
```

- `updated_at` is UTC in ISO-8601 with a trailing `Z`.
- `lat` / `lon` are decimal degrees (WGS 84). Records with missing or 0,0
  coordinates are skipped by the map.
- `bssid` is the dedupe key, stored in lowercase. An existing record is never
  overwritten; new networks are only appended.
- `first_seen` is the logger's local time, normalized to `YYYY-MM-DD HH:MM:SS`
  (kept as logged if it can't be parsed). `channel` is an integer or `null`.
- `updated_at` changes only when a run adds at least one network.
- `ssid` may be an empty string (hidden network); the map shows it as "hidden".
- `auth` is the WiGLE `AuthMode` string. The map treats anything containing
  `WEP`, `WPA`, or `RSN` as encrypted and everything else as open.
- No RSSI, altitude, accuracy, or raw log content is ever stored here.

## `redlands-boundary.geojson` — the fence

ZIP Code Tabulation Area polygons for **92373** and **92374** (Redlands, CA),
from the US Census Bureau's 2020 TIGER/Line data via the TIGERweb REST service
(layer 84, "Zip Code Tabulation Areas", of `tigerWMS_Census2020`), fetched
2026-09-16 in WGS 84 with 5-decimal coordinates (~1 m):

```
https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_Census2020/MapServer/84/query?where=ZCTA5%20IN%20('92373','92374')&outFields=ZCTA5&returnGeometry=true&outSR=4326&geometryPrecision=5&f=geojson
```

US Census data is in the public domain. The site uses this file to draw the
outline and fence the map. The ingest pipeline uses it to drop out-of-area rows.
