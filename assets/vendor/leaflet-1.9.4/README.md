# Leaflet 1.9.4 (vendored)

Byte-for-byte copies of `leaflet.js` and `leaflet.css` from
`https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/`, verified against the
SRI hashes in `index.html`. Vendored so the Content-Security-Policy can allow
scripts and styles from `'self'` only. See `docs/security.md` for the upgrade steps.

`leaflet.css` refers to `images/*.png`. Those images are used only by
the default marker icon and the layers control, and this site uses neither.
They are not vendored, so the browser never requests them.

License: BSD 2-Clause (`LICENSE`).
