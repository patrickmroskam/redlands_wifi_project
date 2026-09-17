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

## How the site groups networks (`assets/stats.js`)

The "Network breakdown" section under the map puts every network the map plots
into exactly one category, so the pie adds up to 100%:

1. **Default-looking** comes first. The SSID still carries an ISP or router
   factory name. Matching is case-insensitive and anchored at the start of the
   SSID. The factory id part is required, so a renamed network such as
   "Frontier Speedy" does not count. For ORBI and ASUS only the factory
   suffixes (`-Guest`, `-IoT`, `_EXT`, `-2G`, `-5G`, `-2.4G`) may follow, so
   `ORBI88smith` or `Asus Wifi` do not count. Hidden (blank) SSIDs never match.

   | Family | Matches (examples) |
   |---|---|
   | Spectrum | `SpectrumSetup-XX`, `MySpectrumWiFiXX-2G`, `Spectrum1234` |
   | Frontier | `Frontier1234` (3+ digits) |
   | AT&T | `ATT-WIFI-1234`, `ATTa1b2c3d` (ATT + 7 letters/digits, at least one digit; and `_EXT`) |
   | CenturyLink | `CenturyLink1234` |
   | T-Mobile | `TMOBILE-1A2B` (and `_EXT`) |
   | Verizon | `Verizon-1E06`, `Verizon_AB12CD`, `Verizon-MiFi…`, `Verizon-M2100-…`, `Verizon-SM-…` |
   | NETGEAR / Orbi | `NETGEAR`, `NETGEAR42` (and `-5G`, `-Guest`, `_EXT`), `NETGEAR-Guest`, `ORBI`, `ORBI12` (and `-Guest`, `-IoT`) |
   | TP-Link | `TP-Link_1A2B`, `TP-Link_1A2B3C` (and `_5G`) |
   | Linksys | `Linksys01234` (and `-guest`) |
   | Wi-Fi Direct | `DIRECT-…` (printers, TVs, cars) |
   | D-Link | `dlink`, `dlink-1A2B` |
   | ASUS | `ASUS`, `ASUS_5G`, `ASUS_9C28`, `ASUS22`, `ASUS_C0_2G_Guest` |
   | Tenda | `Tenda_22F7F0` |
   | Xfinity | `xfinitywifi`, `XFSETUP-1A2B` |

2. Otherwise the `auth` string decides. Anything the map colours as open (no
   `WEP`, `WPA`, or `RSN` in it, e.g. `[OPEN]`, `[ESS]`, or empty) is **Open**.
   Encrypted strings map exactly: `[WEP]` → WEP, `[WPA_PSK]` → WPA,
   `[WPA_WPA2_PSK]` → WPA/WPA2, `[WPA2_PSK]` → WPA2, `[WPA2]` or anything with
   `EAP` / `ENTERPRISE` → WPA2 Enterprise, `[WPA2_WPA3_PSK]` → WPA2/WPA3,
   `[WPA3_PSK]` / `[WPA3]` → WPA3. Any other encrypted string is **Other**.

The patterns live only in `DEFAULT_SSID_PATTERNS` in `assets/stats.js`; update
this table when you change them.

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
