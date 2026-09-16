# Changelog

All notable changes to Font Subsetter / フォント軽量化 are documented here.

## [1.0.0] - 2026-09-16

### Stable release
- Promoted the complete Font Subsetter workflow to v1.0.0 without changing the v0.9.0 processing model.
- Rewrote English and Japanese READMEs to the Browser Kitty public-repository format used by `html-pdf-organizer`, including live demo, quick start, usage, GitHub Pages, build, privacy, limitations, dependencies, test data, contributing, and license sections.
- Updated app/help/spec/build metadata and release checks to v1.0.0.
- Refreshed release screenshots and standalone artifacts from the final stable source.

### Verified for stable packaging
- Chromium end-to-end flow: Regular + Bold input, coverage/output metadata, sequential WOFF2 generation, `FontFace` reload, generated CSS, and Webfont Package ZIP.
- Empty/error states, license restrictions, source parsing, large-font processing, stale-result cancellation, 390 px mobile layout, Japanese/English switching, CSP/network blocking, and self-extract byte-for-byte restoration.
- Firefox / WebKit / Safari and direct `file://` execution are documented as manual environment checks when unavailable in the build environment; this release does not claim automated verification for them.

## [0.9.0] - 2026-09-16

### Changed
- Promoted the v0.8.0 feature set to a release-candidate build without adding new product scope.
- Release documentation now describes browser, responsive, empty-state, error-state, CSP/offline, and package regression coverage.

### Verified
- Chromium primary flow: Regular + Bold inspection, batch WOFF2 generation, `FontFace` reload, CSS generation, and Webfont Package ZIP export.
- 390 px Japanese / English mobile layouts with no horizontal scrolling; long filenames use ellipsis; the help dialog stays inside the viewport and scrolls internally.
- Empty state, malformed font, malformed XML, WOFF / WOFF2 inspection-only behavior, Restricted License acknowledgement, No Subsetting blocking, and Bitmap Embedding Only blocking.
- 10.1 MB TTF generation, plus cancellation by editing character input while processing without leaving a stale result or busy state.
- Generated package contains two valid WOFF2 files, `fonts.css`, `demo.html`, and `manifest.json`; WOFF2 outputs reopen with fontTools.
- Readable standalone remains under 1.1 MB with gzip-compressed embedded HarfBuzz / Brotli runtimes; self-extract restores it byte-for-byte.
- Runtime HTTP/HTTPS requests and browser page errors are zero in the Chromium regression run; CSP retains `connect-src 'none'`.

### Pending before v1.0.0
- Firefox / WebKit automated execution could not run in this environment because their browser binaries are absent and browser downloads are blocked by DNS/network policy.
- Safari desktop / iOS and Windows local `file://` remain real-environment checks. This Chromium environment blocks `file://` navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`.

## [0.8.0] - 2026-09-16

### Added
- Ready-to-use `@font-face` CSS generated from every successful WOFF2 output.
- Per-font `unicode-range` declarations coalesced from requested code points that the source font actually covers.
- `font-subset.zip` export containing `fonts/*.woff2`, `fonts.css`, `demo.html`, and `manifest.json`.
- Package manifest with app version, source filename, input/output byte counts, kept character count, family, weight, style, and unicode range.
- Supplied Font Subsetter SVG adopted as both `assets/favicon.svg` and the header app icon.

### Changed
- Header structure and responsive metrics now match the current `htmlapps-template` header, including the 1180 px desktop container and 38 / 34 px app icon sizes.
- HarfBuzz WASM and the Brotli worker bundle are gzip-compressed inside the readable single HTML and expanded lazily through the template embedded-asset loader, cutting the readable HTML from 2,059,153 bytes to 981,793 bytes without adding runtime network access.
- The result flow now continues from per-font validation into copyable CSS and a deployable Webfont Package.
- ZIP export intentionally excludes original font files, entered text, and imported source files.
- Duplicate package filenames are disambiguated with numeric suffixes so CSS, ZIP entries, and manifest paths remain consistent.

### Verified
- Final compressed build generated Regular + Bold successfully, reloaded both WOFF2 outputs through `FontFace`, and exported a valid Webfont Package.
- Desktop header metrics match the template at 1180 px container / 38 px icon / 14 px gap; 390 px mobile uses 34 px icon / 15 px title / 11 px action gap with no horizontal scrolling.
- Regular + Bold package export produces two valid WOFF2 files, CSS with 400 / 700 weights, `font-display: swap`, and `unicode-range`.
- Generated ZIP opens with standard ZIP tooling; generated WOFF2 files open with fontTools.
- Runtime CSP remains `connect-src 'none'` with no external HTTP/HTTPS resources.

## [0.7.0] - 2026-09-16

### Added
- Multi-font output list for generating several eligible TTF / OTF fonts from one shared character set.
- Per-font target selection plus editable family, weight, style, and output filename metadata.
- Per-font result cards with independent WOFF2 download and comparison selection.
- Aggregate batch metrics for successful count, original bytes, WOFF2 bytes, and overall reduction.
- Variable Font regression coverage for CFF2 / `fvar` outputs.

### Changed
- Heavy subsetting jobs now run sequentially to reduce peak memory use when multiple fonts are selected.
- Runtime failures are isolated per font so later selected fonts are still attempted.
- No Subsetting / Bitmap Embedding Only blocking and Restricted License acknowledgement are applied independently per font.
- Removing and undoing a font preserves its Multi Font selection and editable output metadata when restored.

### Verified
- Noto Sans Regular + Bold generated successfully in one batch with a shared family, weights 400 / 700, and independently edited style metadata.
- Both batch outputs passed browser `FontFace` reload and fontTools WOFF2 validation.
- Restricted License acknowledgement was verified per font, while No Subsetting and Bitmap Embedding Only fonts remained unselectable even through Select all.
- Cantarell Variable Font retained its `wght` axis plus CFF2 / `fvar` / HVAR / MVAR data after subsetting.
- 390 px mobile output view has no horizontal scrolling and no runtime HTTP/HTTPS requests are required.

## [0.6.0] - 2026-09-16

### Added
- Side-by-side preview of the original source font and generated WOFF2 using separate browser `FontFace` families.
- Editable preview text that updates both panes without changing the generated WOFF2.
- Shared 16–72 px preview-size control.
- Result metadata for retained characters, missing characters, output format, and total processing time.
- Collapsed processing details for the intermediate subset size, HarfBuzz subsetting time, and WOFF2 compression time.

### Changed
- Result summary now prioritizes original size, final WOFF2 size, reduction percentage, and retained character count instead of exposing the intermediate subset size as a primary metric.
- The initial preview sample uses direct input when available, otherwise it is derived from characters requested for the generated font.
- Generated result cleanup now removes both preview `FontFace` objects and the original-font Blob URL when inputs change.
- Help/README copy explains that preview-only characters missing from the subset may render through browser fallback fonts.

### Verified
- Latin TTF and Japanese CJK OTF generation both pass browser `FontFace` reload and before/after preview checks.
- 390 px mobile layout stacks the preview panes without horizontal scrolling.
- No runtime HTTP/HTTPS requests are required; CSP remains `connect-src 'none'`.

## [0.5.0] - 2026-09-16

### Added
- Selectable ASCII, basic Japanese symbols, Hiragana, Katakana, 2,136-character Joyo Kanji, and combined Japanese starter presets.
- Vendored `joyo-kanji-2010.txt` source data embedded into the standalone HTML at build time.
- Dedicated preset character counts and clear-selection control.

### Changed
- Effective character input is now the Unicode code-point union of direct text, selected presets, and successfully read local source files.
- Selecting or clearing presets immediately refreshes coverage/output state and invalidates stale generated results.
- Japanese/English help and README copy now explicitly state that presets do not cover all Japanese names, place names, variants, or non-Joyo kanji.

### Preset details
- Printable ASCII is U+0020–U+007E (95 code points).
- Hiragana excludes unassigned U+3097/U+3098 while retaining voicing and iteration marks.
- The Joyo list contains exactly 2,136 unique code points and uses `𠮟`.

## [0.4.0] - 2026-09-16

### Added
- Character coverage analysis from each font's `cmap`, including concrete missing characters and Unicode code points.
- Overall coverage summary across loaded fonts.
- OS/2 `fsType` inspection with clear handling for Restricted License, No Subsetting, and Bitmap Embedding Only flags.
- Name-table license description and license URL display when present.
- Explicit rights/permission acknowledgement before processing fonts marked Restricted License.

### Changed
- Output generation is blocked for fonts marked No Subsetting or Bitmap Embedding Only.
- Missing glyphs are warned about but do not block output.
- Font cards now surface embedding/subsetting flags.
- OS/2 version 0 / 1 fonts ignore undefined high `fsType` bits instead of treating them as later-version No Subsetting / Bitmap Embedding Only flags.


## [0.3.0] - 2026-09-16

### Added

- Character collection from direct input plus TXT, MD, CSV, JSON, YAML, HTML, CSS, JavaScript, TypeScript, XML, and SVG files.
- UTF-8, UTF-8 BOM, UTF-16LE BOM, and UTF-16BE BOM decoding.
- Inert DOM parsing for HTML / XML / SVG so source code is not executed.
- Per-source status, extracted character count, removal, Undo, and remove-all confirmation + Undo.
- 10 MB per source file, 200 files, and 50 MB total source limits.
- Unicode code-point deduplication across all character sources before HarfBuzz generation.

### Changed

- Output generation now uses the combined character set from direct text and every successfully read source file.
- In-flight generation is cancelled when character inputs change, preventing stale work from leaving the UI busy or replacing newer state.
- Privacy/help copy now covers source files as well as fonts and direct text.

### Known limitations

- Shift_JIS is not auto-detected.
- v0.3 generation still supports TTF / OTF source fonts only.
- Coverage analysis, licensing checks, presets, batch generation, preview comparison, CSS, and Web ZIP output are not implemented yet.

## [0.2.0] - 2026-09-16

### Added

- Embedded HarfBuzz subset WASM runtime.
- Worker-based TTF / OTF subsetting from directly entered text.
- Local WOFF2 packaging and Brotli compression.
- Browser `FontFace` validation for generated WOFF2 output.
- Output filename editing and WOFF2 download.
- Original/output size, reduction percentage, retained code-point count, and processing time.
- Vendored runtime provenance and SHA-256 records.

### Changed

- Repository is based on the full Browser Kitty `htmlapps-template` v1.3.0 structure.
- CSP explicitly permits local WebAssembly evaluation while retaining `connect-src 'none'`.
- The Brotli compressor wrapper now passes the actual allocated output capacity to the encoder, fixing false failures on short or poorly compressible input.

### Known limitations

- v0.2 generation supports TTF / OTF source fonts only.
- Character-source files, coverage analysis, licensing checks, presets, batch generation, preview comparison, CSS, and Web ZIP output are not implemented yet.

## [0.1.0] - 2026-09-15

### Added

- Browser Kitty `htmlapps-template` foundation.
- Japanese / English responsive UI.
- Desktop workflow layout and smartphone Fonts / Characters / Output bottom tabs.
- TTF / OTF / WOFF / WOFF2 multi-file picker and Drag & Drop.
- Font signature validation and browser `FontFace` validation where supported.
- Basic TTF / OTF / WOFF metadata extraction.
- File format, family, style, weight, glyph count, size, and Variable Font indication when available.
- Maximum 12 files, 100 MB per file, and 300 MB total validation.
- Duplicate detection.
- Individual removal and remove-all with Undo.
- Local-only privacy copy and `connect-src 'none'` architecture.
- Shared favicon/header icon.
