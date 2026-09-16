# Vendored runtime assets

These files are embedded by `build-standalone.ps1`; the released HTML does not fetch them at runtime.

| File | Source | SHA-256 |
|---|---|---|
| `harfbuzz-subset.wasm` | harfbuzz/harfbuzzjs commit `78b9927df9447e80b11bb523cdb8ed2dcd73b3d0`, successful GitHub Actions build artifact | `6be44956ad4bc7f83383a7ac3a75c7ea739504ee5ee3e9dfbd65a849e9320242` |
| `brotli-worker-bundle.js` | `brotli@1.3.3` plus `base64-js@1.5.1`, bundled for a Worker; Browser Kitty capacity/CSP fixes applied to the wrapper | `cfe3ce495f74389468eb2a2d68eda23def9b9806804e16a84266878ac418ab05` |
| `subset-worker-core.js` | Browser Kitty Font Subsetter application worker core (introduced in v0.2.0) | `b0d1812524e3dbfecf06ec859396fb2be091ca4ba237deec9ac9513f45e3e11e` |
| `joyo-kanji-2010.txt` | 2,136-code-point application data based on the 2010 Joyo Kanji Table; `𠮟` used for the Joyo entry | `1c236fce77ab1eeb0c950338d559d29cd2e4446f1627e340f60f02d79436f825` |

The HarfBuzz artifact was taken from the upstream successful build for the pinned commit rather than downloaded at app runtime.

The Brotli wrapper fixes pass the actual allocated `input length + 1024` output capacity to the encoder and remove two legacy `eval(...)` fallbacks that are unnecessary in the Worker bundle. This avoids false compression failures on short/incompressible inputs and keeps the vendored runtime compatible with the app's restrictive CSP.

`joyo-kanji-2010.txt` is application character-set data, not executable third-party runtime code. The v0.5.0 build embeds it directly so presets remain available offline. The Japanese starter preset is intentionally documented as incomplete for names, variants, and non-Joyo characters.
