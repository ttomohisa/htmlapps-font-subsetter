# APP_SPEC.md — Font Subsetter / フォント軽量化

This file is the product contract for Browser Kitty's Font Subsetter.

## 1. Product identity

- **English name:** Font Subsetter
- **Japanese name:** フォント軽量化
- **Slug:** `font-subsetter`
- **Repository:** `ttomohisa/htmlapps-font-subsetter`
- **One-sentence purpose:** Collect the characters a web project needs, verify font coverage and stored embedding/subsetting flags, and create smaller WOFF2 webfonts entirely in the browser.
- **Primary users:** Web developers, designers, and static-site authors working with local font files.
- **Release artifacts:** `dist/index.html` and `dist/index.self-extract.html`

## 2. Product outcome

The finished app must let a user add local fonts, collect characters, inspect missing characters, create WOFF2 subsets, preview the result, and export web-ready assets without uploading the font or source text.

## 3. Current implementation scope — v1.0.0

v1.0.0 is the stable release of the complete workflow built through v0.9.0. It keeps the release-candidate behavior and freezes the public contract around character collection, coverage/licensing checks, multi-font WOFF2 generation, preview, Webfont Package export, responsive UX, and fully local standalone operation:

- TTF / OTF / WOFF / WOFF2 multi-file input, with generation from eligible TTF / OTF sources.
- Direct text plus `.txt`, `.md`, `.csv`, `.json`, `.yaml`, `.yml`, `.html`, `.htm`, `.css`, `.js`, `.mjs`, `.ts`, `.xml`, `.svg` local sources.
- UTF-8, UTF-8 BOM, UTF-16LE BOM, and UTF-16BE BOM decoding. Shift_JIS is not auto-detected.
- Inert `DOMParser` handling for HTML / XML / SVG. Source code is never executed.
- Unicode code-point deduplication across direct input, selected presets, and every successfully read source.
- Character presets: printable ASCII, common Japanese symbols, Hiragana, Katakana, 2,136 Joyo Kanji, and a combined Japanese starter set.
- `cmap` coverage inspection and actual missing-character display, including supplementary-plane code points.
- OS/2 `fsType` and stored license metadata inspection where the input format exposes those tables.
- No Subsetting and Bitmap Embedding Only hard-block the affected font independently.
- Restricted License acknowledgement is stored per font so one restricted font does not silently authorize another.
- Output rows for every eligible TTF / OTF source, with independent target checkbox, editable family, weight, style, and output filename.
- A common requested character set is applied to every selected output font.
- Batch processing runs sequentially, one font at a time, to reduce peak memory use.
- A runtime failure in one selected font is isolated so later selected fonts can still be processed.
- Each successful result is independently validated with browser `FontFace`, downloadable as WOFF2, and selectable for original/generated comparison.
- Aggregate result metrics show selected count, success count, total original bytes, total WOFF2 bytes, and overall reduction.
- The active successful result keeps the v0.6 before/after preview with editable text and 16–72 px size control.
- Temporary original/generated `FontFace` objects and Blob URLs are released when results become stale.
- Variable Fonts remain variable during subsetting; regression coverage includes CFF2 plus `fvar`/variation tables.
- Runtime CSP retains `connect-src 'none'`; no user font/text/source data is uploaded.

Generation intentionally supports **TTF / OTF source fonts only** in v1.0.0. WOFF can be inspected but is not a generation source. WOFF2 is accepted as an input file but its internal tables are not decoded yet, so coverage and `fsType` are unavailable for WOFF2 input.

## 4. Character preset behavior

Presets are additive inputs. Selecting a preset does not modify the direct-text field or imported source files. The final requested character set is the Unicode code-point union of direct text, every selected preset, and every successfully read source file.

Preset definitions in v1.0.0:

- **ASCII:** printable U+0020–U+007E.
- **Basic symbols:** an explicit practical set of Japanese punctuation, brackets, long-vowel marks, and common full-width symbols.
- **Hiragana:** assigned Hiragana characters plus voicing / iteration marks used in the U+3041–U+309F area; unassigned U+3097/U+3098 are excluded.
- **Katakana:** U+30A0–U+30FF.
- **Joyo Kanji:** 2,136 code points based on the 2010 Joyo Kanji Table, using `𠮟` for the Joyo entry.
- **Japanese starter set:** union of the five sets above, with duplicates removed.

The UI must not imply that these presets cover every possible Japanese string. Real project text remains the preferred source of truth.

## 5. Coverage behavior

Coverage is based on font `cmap` data, not rendered fallback text. The implementation supports the common Unicode cmap formats needed by current webfonts, including formats 4, 6, 10, 12, and 13.

For each readable font:

- required code points = deduplicated combined character input;
- supported = code points that map to a non-zero glyph in the selected cmap subtable(s);
- missing = required code points with no mapping in that font.

Missing characters warn but do not block generation. HarfBuzz receives the requested code points and naturally omits characters that do not exist in the source font.

The UI may cap the number of rendered missing-character chips for performance, but the full missing set remains available for copy.

## 6. `fsType` / license behavior

`fsType` is a technical field in the OS/2 table. It is **not** treated as an automatic legal decision about webfont use.

- `0x0000`: no embedding restriction flag in `fsType`; still ask the user to check the license/EULA.
- `0x0002`: Restricted License embedding; output requires explicit rights/permission acknowledgement.
- `0x0004`: Preview & Print embedding; show the flag and license/EULA reminder.
- `0x0008`: Editable embedding; show the flag and license/EULA reminder.
- `0x0100`: No Subsetting; block subset generation when defined by the OS/2 version.
- `0x0200`: Bitmap Embedding Only; block outline webfont generation when defined by the OS/2 version.

For OS/2 versions 0 and 1, bits 4–15 are ignored as required by the OpenType specification.

Do not use phrases such as “legally safe”, “licensed”, or “commercial use allowed” based only on `fsType`.

## 7. Technical architecture

```text
src/index.template.html
        |
        +-- local font/source parsing
        +-- cmap coverage + OS/2 fsType inspection
        +-- embedded HarfBuzz subset WASM
        +-- embedded Brotli worker bundle
        +-- embedded subset worker core
        |
        v
Blob Worker
        |
        +-- HarfBuzz: TTF/OTF -> subset SFNT
        +-- WOFF2 packaging + Brotli compression
        |
        v
WOFF2 bytes
        |
        +-- FontFace load validation
        +-- editable original/generated preview
        +-- individual WOFF2 download
        +-- generated @font-face CSS / unicode-range
        +-- fonts.css + demo.html + manifest.json + WOFF2 ZIP package
```

The font-subset operation itself must stay HarfBuzz-based. Coverage parsing must not replace shaping/subsetting logic.

## 8. Input limits

### Fonts

- Accepted input list: TTF, OTF, WOFF, WOFF2.
- v1.0 generation source: TTF / OTF only.
- Maximum 100 MB per font.
- Maximum 12 fonts.
- Maximum 300 MB total.
- TTC / OTC remain out of scope for v1.0.

### Character sources

- Direct text plus supported local source files.
- Maximum 10 MB per source file.
- Maximum 200 source files.
- Maximum 50 MB total source data.
- Empty combined input cannot start generation.

## 9. Privacy and offline behavior

- Font files and source text stay in browser memory.
- No upload, cloud storage, analytics, telemetry, remote font, CDN, or API request.
- Runtime CSP keeps `connect-src 'none'`.
- WASM and Worker code are embedded in the standalone HTML.
- Both standalone outputs must work without runtime network access.
- The UI may state `完全ローカル処理 / Fully local processing` only while these conditions remain true.

## 10. Async / stale-result rules

- Generation uses an explicit request generation id.
- Changing font selection, direct input, presets, or source files invalidates the previous result.
- In-flight Worker processing is cancelled when its input becomes stale.
- Old asynchronous results must never replace a newer state.
- Download remains unavailable unless the generated WOFF2 passed `FontFace` validation.
- Editing preview text or preview font size does **not** invalidate or regenerate the WOFF2.

## 11. UX and accessibility

- Japanese / English in one HTML file.
- Desktop: workflow sections visible on one page.
- Smartphone: Fonts / Characters / Output bottom navigation.
- Coverage does not rely on color alone; counts and concrete code points are present.
- Long missing-character lists are scrollable and copyable.
- Source filenames remain literal text in visible labels, tooltips, and accessible names, including quotes, ampersands, angle brackets, and Unicode.
- Long license text is collapsed by default.
- Result preview stacks vertically on small screens and never forces horizontal scrolling.
- Preview controls state clearly that browser fallback may appear for characters not included in the generated WOFF2.
- Drag & Drop always has a file-picker equivalent.
- Removal is reversible with Undo.
- Visible focus, keyboard access, adequate tap targets, `aria-live`, and reduced-motion handling are required.
- No horizontal scrolling at 360 px.

## 12. Non-goals for v1.0

- Font outline editing.
- TTC / OTC face selection.
- Cloud storage or collaboration.
- URL crawling or remote website fetching.
- Automatic legal/license approval.
- Variable Font axis pinning.
- Automatic project ZIP analysis.
- Automatic splitting into multiple Unicode-range subset files.

## 13. Version plan

- **v0.1.0 — Foundation / Font Input:** repository setup, bilingual responsive UI, multi-font input, basic metadata, Undo removal.
- **v0.2.0 — HarfBuzz / WOFF2 Core:** embedded local runtime, Worker processing, valid WOFF2 generation and browser reload validation.
- **v0.3.0 — Character Sources:** pasted text plus multiple source files, code-point dedupe and source management.
- **v0.4.0 — Coverage / Licensing:** cmap coverage, missing characters, OS/2 `fsType`, license metadata.
- **v0.5.0 — Japanese Presets:** ASCII/basic punctuation, Hiragana, Katakana, Joyo Kanji, combined Japanese preset.
- **v0.6.0 — Result / Preview:** richer result comparison and editable before/after preview.
- **v0.7.0 — Multi Font:** batch subset, style/weight metadata review, Variable Font regression coverage.
- **v0.8.0 — Webfont Package:** CSS, unicode-range, WOFF2 export, ZIP, demo HTML, manifest.
- **v0.9.0 — Release Candidate:** mobile/desktop UX, browsers, errors, memory, CSP/offline checks, README/screenshots.
- **v1.0.0 — Stable Release:** final regression, public README, release metadata, screenshots, and publication-ready standalone artifacts. **Current.**

## 14. v1.0.0 acceptance criteria

- App/config/help/build-manifest version metadata is `1.0.0` consistently.
- The primary TTF/OTF workflow passes automated Chromium smoke coverage from input through WOFF2 generation, browser `FontFace` reload, CSS generation, and Webfont Package ZIP export.
- Empty/error states, source-decoding failures, Restricted / No Subsetting / Bitmap Only paths, stale-result cancellation, and large-font handling retain the v0.9.0 behavior.
- Desktop and 360–390 px mobile layouts have no horizontal scrolling or overlapping fixed UI.
- Japanese / English switching works before and after generation.
- Every successful generated font produces one `@font-face` rule using its edited family, weight, style, and sanitized output filename.
- `src` uses a relative `./fonts/<name>.woff2` URL and `format('woff2')`; every rule includes `font-display: swap`.
- Requested supported code points are sorted and coalesced into valid `unicode-range` entries; missing code points are not advertised by that font's rule.
- `font-subset.zip` contains only generated WOFF2 files under `fonts/`, `fonts.css`, `demo.html`, and `manifest.json`; original fonts and source text are excluded.
- A Regular + Bold pair produces two valid WOFF2 files and independent 400 / 700 metadata.
- Runtime HTTP/HTTPS requests remain zero and CSP keeps `connect-src 'none'`.
- The supplied Font Subsetter SVG remains the exact canonical source for both favicon and header icon.
- `dist/index.self-extract.html` restores the readable HTML byte-for-byte.
- README / README.ja follow the Browser Kitty public repository format used by `html-pdf-organizer`, with live demo, quick start, usage, Pages, build, privacy, limitations, dependencies, contributing, and license sections.
- README, changelog, screenshots, help copy, app config, test fixtures, and generated manifests describe v1.0.0 accurately.
- Firefox / WebKit / Safari and direct `file://` execution remain manual environment checks when the current CI/runtime does not provide those browser binaries or permits local-file navigation; do not claim them as automated verification.
