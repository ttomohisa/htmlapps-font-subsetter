from pathlib import Path
import json, re, sys
ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'app.config.json').read_text(encoding='utf-8'))
src=(ROOT/'src/index.template.html').read_text(encoding='utf-8')
readme=(ROOT/'README.md').read_text(encoding='utf-8')
readme_ja=(ROOT/'README.ja.md').read_text(encoding='utf-8')
spec=(ROOT/'APP_SPEC.md').read_text(encoding='utf-8')
changelog=(ROOT/'CHANGELOG.md').read_text(encoding='utf-8')
checks=[]
def check(name, cond): checks.append((name,bool(cond)))
check('config version 1.0.0', config.get('version')=='1.0.0')
check('header version 1.0.0', 'id="versionBadge">v1.0.0<' in src)
check('README stable title and live demo', '# Font Subsetter' in readme and '## 🚀 Live demo' in readme and 'https://ttomohisa.github.io/htmlapps-font-subsetter/' in readme)
check('README follows public release sections', all(x in readme for x in ['## Features','## Quick start','## Usage','## Publish with GitHub Pages','## Development and build layout','## Privacy and runtime network protection','## Limitations','## Dependencies','## License']))
check('README JA follows public release sections', all(x in readme_ja for x in ['## 主な機能','## すぐに使う','## 使い方','## GitHub Pagesで公開する','## 開発とビルド','## プライバシーと通信防止','## 制限事項','## 使用ライブラリ','## ライセンス']))
check('README no RC current-version wording', 'Release Candidate' not in readme and 'リリース候補' not in readme_ja)
check('APP_SPEC stable scope', 'Current implementation scope — v1.0.0' in spec)
check('CHANGELOG 1.0.0 section', re.search(r'^## \[1\.0\.0\] - 2026-09-16$',changelog,re.M) is not None)
check('help copy stable', 'helpNoteMetadata":"v1.0.0' in src or 'v1.0.0では' in src)
failed=[x for x in checks if not x[1]]
for name,ok in checks: print(('PASS' if ok else 'FAIL'),name)
print(f'{len(checks)-len(failed)}/{len(checks)} passed')
sys.exit(1 if failed else 0)
