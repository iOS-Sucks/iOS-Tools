# iOS-Tools

Minimal black-and-white utilities for iOS. Static site, no build step, no backend.

Live: enable **Settings → Pages → Deploy from branch → `main` / root** and open the Pages URL.

## Guides — `unblocked.html` (separate page, ← back button to index)

- **games you can host yourself** — fork an open-source HTML5 game, enable Pages, done
- **school-managed device** — inspect profiles, used-device checks, own-admin removal, offline use; no MDM-removal or filter-evasion steps on purpose
- **school-day setup** — offline prep, personal hotspot basics, battery + Focus; your hardware only
- **evade school mode** - you can evade school mode by those two methods... wifi off can result in school mode not toggling and giving you no restrictions. for that just turn off the automatic connecting to the network. hotspot method if you are in school mode and wanna access restricted websites (connect to your hotspot and restart your device.)

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
| 10 | Wi-Fi profile generator | SSID + WPA2/WPA/WEP/open → downloads `.mobileconfig` |
| 11 | passcode policy generator | length, complexity, history, max attempts → `.mobileconfig` |
| 12 | bundle ID validator | reverse-DNS checks for app identifiers |
| 13 | App Store link builder | numeric app ID → shareable store links |
| 14 | URL codec | percent-encode / strict decode |
| 15 | JWT decoder | header + payload + exp/iat dates (signature NOT verified) |
| 16 | hasher | SHA-256/384/512 via WebCrypto |
| 17 | color converter | HEX ⇄ RGB ⇄ HSL with preview |
| 18 | plist → JSON | dict/array plist → JSON (dates→ISO, data→base64) |

## Run locally

No dependencies. Either open `index.html` directly, or serve it:

```sh
python3 -m http.server 8000
# → http://localhost:8000
```

## Notes

- Files are parsed with `DOMParser` in your browser. Nothing is uploaded anywhere.
- Only install configuration profiles from sources you trust.
