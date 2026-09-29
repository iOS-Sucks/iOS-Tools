# iOS-Tools

Minimal black-and-white utilities for iOS. Static site, no build step, no backend.

Live: enable **Settings → Pages → Deploy from branch → `main` / root** and open the Pages URL.

## Tools (all client-side)

| # | Tool | What it does |
|---|------|--------------|
| 01 | mobileconfig viewer | paste/drop `.mobileconfig`, summary table + formatted source + re-download |
| 02 | DNS profile generator | custom/preset servers, plain or encrypted (DoH) → downloads `.mobileconfig` |
| 03 | web clip generator | label + URL → home-screen icon `.mobileconfig` |
| 04 | UDID / ECID helpers | validate UDIDs, ECID hex ⇄ dec via `BigInt` |
| 05 | IPSW / signing lookup | identifier → `ipsw.me` deep links |
| 06 | base64 | UTF-8 safe encode/decode, strict validation |
| 07 | JSON formatter | validate, pretty-print, minify |
| 08 | UUID / time | `crypto.randomUUID()` v4, unix ⇄ ISO-8601 |
| 09 | plist pretty-printer | indent raw plist XML |

## Run locally

No dependencies. Either open `index.html` directly, or serve it:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Notes

- Files are parsed with `DOMParser` in your browser. Nothing is uploaded anywhere.
- Only install configuration profiles from sources you trust.
