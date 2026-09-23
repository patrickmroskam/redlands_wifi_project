# data/

Files the site and the ingest read. All are committed; none is ever placed in `ingest/`.

The pipeline writes three databases — `networks.json` (WiFi), `bluetooth.json` and
`flock.json` — and each is read by its own page. They share the same fence, the same
opt-out, the same removal denylist, and the same rule that a BSSID is never stored twice
in one database.

## `networks.json` — the WiFi database

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

## `bluetooth.json` — Bluetooth devices

Same writer, same shape, but the records live under `devices` and hold only
`bssid`, `name`, `first_seen`, `lat` and `lon`. A BLE row's `AuthMode` is the
constant `[BLE]` and its `Channel` is always `0`, so neither is published; `name`
is the advertised device name and is usually an empty string.

**Only stable addresses reach this file.** A Bluetooth device may advertise a random
private address that it rotates every few minutes, specifically so that it cannot be
followed from place to place — phones, watches and earbuds all do. Those addresses are
useless as a dedupe key and publishing them would map people rather than devices, so
they are dropped as `ble private`. The address type is not a column in a WiGLE CSV, so
the pipeline reads the top two bits of the first octet (Bluetooth Core spec, Vol 6
Part B, 1.3.2):

| Top two bits | Address type | Published |
|---|---|---|
| `0b11` | static random | yes |
| `0b10` | not a valid random type, so public | yes |
| `0b01` | resolvable private (rotates) | no |
| `0b00` | non-resolvable private (rotates) | no |

A public address whose first octet happens to begin `0b00` or `0b01` is dropped with
them. That is deliberate: the cost of being wrong that way is a missing marker, and the
cost of being wrong the other way is a published person.

## `flock.json` and `flock-rules.json` — Flock cameras

`flock-rules.json` says what marks an observation as a Flock Safety camera:

```json
{ "ssid_patterns": ["flock safety"], "oui_prefixes": ["a4:da:22"] }
```

`ssid_patterns` are case-insensitive substrings of the SSID or device name;
`oui_prefixes` are lower-case colon-separated MAC prefixes matched against the start of
the canonical BSSID. **Both ship empty**, so `flock.json` stays empty until a rule is
added — no rule has been confirmed against a real camera, and a guessed one would put a
surveillance marker on somebody's home network.

A matching row is written to `flock.json` *in addition to* the database its Type selects,
so adding a rule never removes anything from the WiFi map. Records carry the usual
network fields plus `matched_by` (for example `"oui:a4:da:22"`), which the map shows in
the popup so every marker can be traced back to the rule that placed it.

Deleting a rule stops new matches; records already in `flock.json` are removed by hand,
the same way as a removal request (`docs/removals.md`). A missing rules file means "no
rules" and is not an error; a malformed one stops the run.

## How the site groups networks (`assets/stats.js`)

Two independent axes describe the same network, and both are computed in the
browser from the published record — neither changes `networks.json` or the
ingest:

- **Security** — how it is encrypted. Drives the pie and the "By category"
  column.
- **Kind** — what the device is. Drives the "By kind" column and the per-kind
  map toggles (#65, PRD R10).

A network gets exactly one value on each axis, and they are deliberately not
merged: `DIRECT-7F-HP OfficeJet Pro` is **Default-looking** on the security axis
(its factory name is the interesting thing there) and **Wi-Fi Direct / printer**
on the kind axis.

### Security: the pie and the category list

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

The right-hand column lists the same categories as a table, with counts and the
same percentages as the pie legend. Categories with no networks still show `0`.
Under **Default-looking**, indented rows show how those networks are secured
(using the step 2 rules alone). A note below the table counts hidden (blank)
SSIDs; those networks are already counted under their security type. The total
equals the number of networks on the map.

### Kind: what the device is

Every plotted network also gets exactly one **kind**, guessed from its SSID. The
first group below whose pattern matches wins, so the order is the rule:

1. **Hidden** — a blank or whitespace-only SSID. Decided before any pattern,
   because there is no name to match.
2. **Wi-Fi Direct / printer** — `DIRECT-…`. This beats the maker's name, so
   `DIRECT-BMW 16740` is Wi-Fi Direct rather than a Vehicle: the prefix says
   what the radio *is* (a Wi-Fi Direct group owner), while the rest of the name
   only hints at what is behind it.
3. **Vehicle** — factory naming schemes for in-car head units and their
   hotspots: `myChevrolet 3B64`, `CHEVROLET1347`, `Chevy WiFi`,
   `TOYOTA Camry-2.4g_26e19f`, `Mazda_2017888db0d8`, `HONDA1359`, `Kia_2fTI`,
   `My VW 6616`, `Audi_MMI_8140`, `Porsche_WLAN_4345`, `BMW02628 CarPlay`,
   `MB Hotspot 03117` and `MB WLAN 37248` (Mercedes-Benz), `MY ROGUE0409`,
   `SYNC_XP9WT5H3` (Ford), `uconnectadpt`, `CarPlay_6cf8`,
   `Smartphone_connect_1a523b` and `Vehicle Hotspot`.
4. **Phone / hotspot** — phones, tablets and mobile-broadband pucks:
   anything containing `hotspot`, plus `iPhone`/`iPad`, `Galaxy S24 66BC`,
   `AndroidAP_…`, `Pixel 7`, `…MiFi…`, `CellSpot…`, `Franklin T10 0390`,
   `Moxee Tether…`, `Redmi …` and `NOKIA-C031`. Checked after Vehicle, so a
   car's hotspot stays a Vehicle.
5. **Default-looking** — the same `DEFAULT_SSID_PATTERNS` as the security axis.
6. **Named** — everything else.

Two judgement calls worth knowing, both visible in the current data:

- **An owner-renamed car is `Named`, not `Vehicle`.** `Christinas VW`,
  `DAVID CHEVY` and `CodyGMC` are almost certainly cars, but a made-up name is
  not evidence of a device class — and the same shape covers a home router named
  after a hobby. Only factory schemes count. This is why the maker patterns are
  anchored at the start: loose in the middle they also match `Audiology`,
  `DodgerFam`, `Oxford908`, `RUConnected` and `Leaky Sync`.
- **Tesla is absent.** `TeslaPW_…` is a Powerwall, `TeslaPV_…` a solar inverter
  and `TeslaWallConnector_…` a home charger — fixed equipment, not cars — and
  nothing in the data names a Tesla vehicle.

The patterns live only in `VEHICLE_SSID_PATTERNS`, `PHONE_SSID_PATTERNS` and
`WIFI_DIRECT_SSID_PATTERNS` in `assets/stats.js`, each with a comment naming a
real SSID it is there for; update this section when you change them.
`tests/e2e/kinds.spec.js` holds the hits and the look-alikes they must skip.

Under the map, one checkbox per kind hides or shows that kind's markers. All
start on. The breakdown keeps describing the whole database while markers are
hidden — the toggles filter the map, not the numbers.

## `removed.json` — networks removed on request

A list of BSSIDs that were taken off the map after a removal request. The ingest
never adds them again, under any name. Each entry has exactly `bssid` (canonical
lower-case form), `date` (`YYYY-MM-DD`), and `issue` (the request's issue number).
Nothing else is stored. Change it only with `scripts/remove_network.py`, in the same
commit that deletes the record from every database that held it (`networks.json`,
`bluetooth.json` and `flock.json` — one device can be in more than one). A missing or
malformed file stops the ingest, and so does a listed BSSID still present in any of
those three. The procedure is in [docs/removals.md](../docs/removals.md).

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
