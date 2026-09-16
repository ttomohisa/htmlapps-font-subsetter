from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
src=(ROOT/'src/index.template.html').read_text(encoding='utf-8')
build=(ROOT/'build-standalone.ps1').read_text(encoding='utf-8')
checks=[]
def check(name, cond, detail=''):
    checks.append((name, bool(cond), detail))

check('header width 1180', 'width:min(1180px,100%)' in src or 'width: min(1180px, 100%)' in src)
check('header blur+saturate', 'blur(16px) saturate(1.2)' in src)
check('header icon 38px', re.search(r'\.brand-mark\{[^}]*width:38px[^}]*height:38px', src) is not None)
check('header help template class', 'class="icon-button header-icon-button" id="helpButton"' in src)
check('vendor gzip bundle path', 'compression = "gzip"' in build and 'assetBundle.dependencies' in build)
check('hb special base64 placeholder removed', '__BK_HB_WASM_BASE64__' not in build and '__BK_HB_WASM_BASE64__' not in src)
check('brotli special base64 placeholder removed', '__BK_BROTLI_WORKER_BASE64__' not in build and '__BK_BROTLI_WORKER_BASE64__' not in src)
failed=[c for c in checks if not c[1]]
for name,ok,detail in checks:
    print(('PASS' if ok else 'FAIL'), name, detail)
print(f'{len(checks)-len(failed)}/{len(checks)} passed')
sys.exit(1 if failed else 0)
