# Third-Party Notices

Font Subsetter v1.0.0 embeds third-party runtime code into the generated standalone HTML. These components run locally in the browser and are not fetched at runtime.

## harfbuzzjs / HarfBuzz

- Upstream: `harfbuzz/harfbuzzjs`
- Vendored build commit: `78b9927df9447e80b11bb523cdb8ed2dcd73b3d0`
- File: `vendor/harfbuzz-subset.wasm`
- SHA-256: `6be44956ad4bc7f83383a7ac3a75c7ea739504ee5ee3e9dfbd65a849e9320242`
- harfbuzzjs license: MIT
- HarfBuzz itself includes its upstream permissive license terms.

The vendored WASM is used only for layout-aware font subsetting.

## brotli.js

- Package: `brotli@1.3.3`
- Upstream: `devongovett/brotli.js`
- File: `vendor/brotli-worker-bundle.js`
- SHA-256: `cfe3ce495f74389468eb2a2d68eda23def9b9806804e16a84266878ac418ab05`
- License: MIT

The local bundle includes the package's `base64-js` dependency (`base64-js@1.5.1`, MIT). Font Subsetter patches the wrapper so the encoder receives the full allocated output buffer size and removes two legacy `eval(...)` fallbacks that are not needed in the Worker runtime. The compression algorithm itself is otherwise vendored from the package.

## Browser Kitty subset worker core

- File: `vendor/subset-worker-core.js`
- SHA-256: `b0d1812524e3dbfecf06ec859396fb2be091ca4ba237deec9ac9513f45e3e11e`

This file is application code that connects HarfBuzz output to WOFF2 packaging and Brotli compression.

See `vendor/README.md` for reproducibility/provenance details.

## Joyo Kanji preset data

`vendor/joyo-kanji-2010.txt` is non-executable application data used to provide the v0.5.0 Joyo preset. It contains 2,136 unique code points based on the 2010 Joyo Kanji Table and is embedded locally at build time. It is not fetched at runtime.
