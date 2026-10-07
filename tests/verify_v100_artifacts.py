from pathlib import Path
import re, gzip, base64, hashlib, json, sys
ROOT=Path(__file__).resolve().parents[1]
idx=ROOT/'dist/index.html'; se=ROOT/'dist/index.self-extract.html'
html=idx.read_text(encoding='utf-8'); seb=se.read_bytes(); setext=seb.decode('ascii')
checks=[]
def check(name, cond, detail=''): checks.append((name,bool(cond),detail))
# Size/standalone contract
check('readable HTML under 1.1 MB', idx.stat().st_size < 1_100_000, str(idx.stat().st_size))
check('self-extract under 1.0 MB', se.stat().st_size < 1_000_000, str(se.stat().st_size))
for token in ['__APP_CONFIG_JSON__','__BUILD_MANIFEST_JSON__','__EMBEDDED_ASSET_BUNDLE_JSON__','__APP_ICON_DATA_URI__','__BK_SUBSET_WORKER_CORE_BASE64__','__BK_JOYO_KANJI_BASE64__']:
    check(f'no placeholder {token}', token not in html)
# CSP/network
m=re.search(r'<meta http-equiv="Content-Security-Policy" content="([^"]+)">',html,re.I)
csp=m.group(1) if m else ''
check('CSP connect-src none', "connect-src 'none'" in csp, csp)
check('CSP wasm allowed without general unsafe-eval', "'wasm-unsafe-eval'" in csp and " 'unsafe-eval'" not in csp, csp)
external=[]
for tag in re.findall(r'<(?:script|link|img)\b[^>]*>',html,re.I):
    for attr in ('src','href'):
        a=re.search(rf'\b{attr}\s*=\s*(["\'])(.*?)\1',tag,re.I)
        if a and a.group(2).lower().startswith(('http://','https://','//')): external.append(a.group(2))
check('no external src/href', not external, repr(external))
# icon exact data URL same in both places
fav=re.search(r'<link rel="icon" href="([^"]+)">',html,re.I)
brand=re.search(r'<img id="appBrandIcon" src="([^"]+)"',html,re.I)
check('favicon/header icon identical', fav and brand and fav.group(1)==brand.group(1))
# runtime bundle compression
asset_match=re.search(r'const assetBundle = (\{.*?\});\n',html,re.S)
asset=None
if asset_match:
    try: asset=json.loads(asset_match.group(1))
    except: pass
runtimes=(asset or {}).get('dependencies',{}).get('font-subsetter-runtime',{}).get('assets',{})
check('HarfBuzz gzip embedded', runtimes.get('harfbuzz-subset.wasm',{}).get('compression')=='gzip')
check('Brotli gzip embedded', runtimes.get('brotli-worker-bundle.js',{}).get('compression')=='gzip')
# self-extract round trip
pm=re.search(r'<script id="self-extract-payload" type="application/octet-stream">([A-Za-z0-9+/=\s]+)</script>',setext)
restored=b''
if pm:
    restored=gzip.decompress(base64.b64decode(re.sub(r'\s+','',pm.group(1))))
check('self-extract restores index byte-for-byte', restored==idx.read_bytes(), f'{len(restored)} vs {idx.stat().st_size}')
sha=hashlib.sha256(idx.read_bytes()).hexdigest()
meta=re.search(r'<meta name="self-extract-source-sha256" content="([a-f0-9]{64})">',setext)
check('self-extract source SHA matches', meta and meta.group(1)==sha, sha)
# Version manifest
config=json.loads((ROOT/'app.config.json').read_text(encoding='utf-8'))
version=config['version']
check('dist version badge matches config', f'id="versionBadge">v{version}<' in html)
report=json.loads((ROOT/'dist/build-size-report.json').read_text(encoding='utf-8')) if (ROOT/'dist/build-size-report.json').exists() else {}
check('build-size report readable bytes current', report.get('readableHtmlBytes')==idx.stat().st_size, str(report.get('readableHtmlBytes')))
check('build-size report self-extract bytes current', report.get('selfExtractHtmlBytes')==se.stat().st_size, str(report.get('selfExtractHtmlBytes')))
failed=[c for c in checks if not c[1]]
for name,ok,detail in checks:
    print(('PASS' if ok else 'FAIL'),name,detail)
print(f'{len(checks)-len(failed)}/{len(checks)} passed')
sys.exit(1 if failed else 0)
