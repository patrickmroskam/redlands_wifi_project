# Security

The security model and the audit record for the Redlands Wifi Project (issue #14,
audited 2026-09-17). The site is static HTML, CSS, and JS served by GitHub Pages.
It has no server, accounts, cookies, or forms. The only untrusted input is the
text inside `data/networks.json`, which comes from whatever WiFi networks broadcast.

## Rules for code that touches the page

- **Render data as text.** Set `textContent`, and never use `innerHTML` or
  `insertAdjacentHTML`. Never pass a data string to Leaflet's `bindPopup`,
  `bindTooltip`, or `attribution`, because Leaflet treats strings as HTML. Build
  a DOM node and pass that instead (see `popupFor` in `assets/map.js`).
- **Every new text surface gets an injection test.** Put an HTML payload in
  `tests/fixtures/networks-xss.json` and assert it shows as literal text
  (`tests/e2e/site.spec.js`, "render HTML payloads as text"). The stats and list
  columns planned in #12 and #13 need this.
- **No new origins.** Scripts and styles come only from this site. The one
  allowed external host is the OpenStreetMap tile server, for images.
- **External links** carry `rel="noopener noreferrer"`. A test enforces this.

## Content-Security-Policy

Both pages set a `<meta http-equiv="Content-Security-Policy">`.

| Directive | `index.html` | Why |
|---|---|---|
| `default-src` | `'none'` | Deny by default. This also covers `object-src`, `frame-src`, `font-src`, `worker-src`, and `manifest-src`. |
| `script-src` | `'self'` | Only this site's files. No inline scripts and no `eval`. |
| `style-src` | `'self'` | Only this site's stylesheets. Leaflet positions elements through `element.style`, which CSP does not block. |
| `img-src` | `'self' data: https://tile.openstreetmap.org` | See the `data:` note below. |
| `connect-src` | `'self'` | `fetch` of `data/*.json`. |
| `base-uri`, `form-action` | `'none'` | No `<base>` hijack and no form posts. |

`privacy.html` uses the same shape, with only `style-src 'self'` and `img-src 'self'`.

**Why Leaflet is vendored.** The policy used to allow all of
`https://cdnjs.cloudflare.com`. That host serves thousands of libraries, some with
known script gadgets (old AngularJS, for example). Allowing it would turn any
future HTML-injection bug into script execution despite the CSP. SRI protected only
the two Leaflet tags, not the policy. Leaflet 1.9.4 now lives in
`assets/vendor/leaflet-1.9.4/`, byte-identical to the cdnjs copy, so the policy is `'self'`.

**Why `img-src` keeps `data:`.** When Leaflet cancels a tile that is still
loading, it sets the tile's `src` to a 1×1 `data:image/gif` (`Util.emptyImageUrl`).
Without `data:`, panning quickly logs CSP violations.

**Known limits, accepted.**
- A meta CSP cannot set `frame-ancestors`, and GitHub Pages cannot send response
  headers. So the site **can be framed** by other sites. There is nothing to
  click-jack (no logins, forms, or state changes), so this is accepted.
- The same header limit rules out `X-Content-Type-Options`, HSTS preload, and
  `Permissions-Policy`. Pages serves over HTTPS with correct content types.

## Third-party requests

- **Map tiles** come from `tile.openstreetmap.org`. The page sets
  `referrer=strict-origin-when-cross-origin`, so OSM sees only the site's origin,
  never the full URL. OSM's tile policy requires a valid Referer. Viewers' IP
  addresses reach OSM, which the privacy policy should mention (#6).
- Nothing else leaves the page: no fonts, analytics, or CDN. A Playwright test
  fails if any script, stylesheet, or fetch goes to another origin, or if an image
  goes anywhere other than this site, `data:`, or the tile host.

## Upgrading Leaflet

1. Download the new `leaflet.js` and `leaflet.css` into
   `assets/vendor/leaflet-<version>/`, along with its `LICENSE`.
2. Compute each hash with `openssl dgst -sha256 -binary <file> | base64`, and
   compare it with the `integrity` value that cdnjs publishes for the same version.
3. Update the two tags in `index.html` (path and `integrity="sha256-…"`).
   Delete the old folder.
4. Run the full test suite. The `integrity` attribute is a tripwire: if a vendored
   file changes without a hash update, the browser refuses to load it and the tests fail.

## Repository and workflow hygiene

- **Secrets:** none in the tree or in the history. A scan on 2026-09-17 covered
  all 14 commits and every ref. The old `.env` was removed with the history reset on
  2026-09-16. `.gitignore` blocks `.env` and `.env.*`.
- **GitHub settings (2026-09-17):** secret scanning is on, and push protection is on.
  Dependabot alerts, Dependabot security updates, private vulnerability reporting,
  and "require SHA pinning" are off. Turning them on is an owner task (#21).
- **Dependabot version updates** (`.github/dependabot.yml`) run monthly and
  grouped, for the Actions SHAs and `@playwright/test`. Their PRs are ordinary PRs
  gated by CI.
- **Workflows**
  - `ci.yml`: `permissions: contents: read`. It runs on `pull_request`, never
    `pull_request_target`, so fork PRs get no secrets and no write token. Checkout
    uses `persist-credentials: false`.
  - `ingest.yml`: top-level `permissions: {}`. The one job gets `contents: write`
    (commit the database) and `pages: write` (request a Pages build if the push
    didn't start one). PRD R5.5 lists only `contents: write`; the extra scope is
    accepted and should be added to the PRD wording. The push token is added only
    inside the publish step, and only for a real run. File names from `ingest/` are
    echoed between `::stop-commands::` markers, so a crafted file name cannot
    inject workflow commands. `workflow_dispatch` inputs reach the shell only
    through `env:`.
  - Every third-party action is pinned to a full commit SHA.

## Data exposure

- `data/networks.json` holds only `bssid`, `ssid`, `auth`, `channel`,
  `first_seen`, `lat`, and `lon` for networks inside ZIP 92373/92374. It never
  holds RSSI, altitude, accuracy, or raw log lines (PRD R4.12).
- **Raw logs are public.** Files in `ingest/` are served by Pages until the daily
  job deletes them, and they stay in the public git history after that. They
  include out-of-area rows, RSSI, and the timestamped drive path. This is an open
  owner decision (#22).

## Audit record (2026-09-17, #14)

| # | Finding | Outcome |
|---|---|---|
| F1 | CSP allowed all of cdnjs for scripts and styles | Fixed: Leaflet vendored, policy `'self'` |
| F2 | `img-src data:`; no `frame-ancestors` | Accepted (see above) |
| F3 | Referrer sent to the tile server | Accepted: origin only, required by OSM |
| F4 | "Source" link had no `rel` | Fixed |
| F5 | Injection test covered only the SSID | Fixed: all popup fields, the stats line, the error banner, and a no-foreign-origin test |
| F6 | No dependency update automation | Fixed: `.github/dependabot.yml` |
| F7 | Some security settings off | Owner task, #21 |
| F8 | Workflow permissions and pinning | OK; PRD R5.5 wording lags `pages: write` |
| F9 | Raw logs public (Pages and history) | Owner decision, #22 |
| F10 | Secret scan | Clean |
