from pathlib import Path
import json,re,sys
ROOT=Path(__file__).resolve().parents[1]
config=json.loads((ROOT/'app.config.json').read_text(encoding='utf-8'))
src=(ROOT/'src/index.template.html').read_text(encoding='utf-8')
readme=(ROOT/'README.md').read_text(encoding='utf-8')
readme_ja=(ROOT/'README.ja.md').read_text(encoding='utf-8')
spec=(ROOT/'APP_SPEC.md').read_text(encoding='utf-8')
changelog=(ROOT/'CHANGELOG.md').read_text(encoding='utf-8')
version=config['version']
checks=[]
def check(name,cond): checks.append((name,bool(cond)))
check('config numeric semantic version',re.fullmatch(r'\d+\.\d+\.\d+',version))
check('header version matches config',f'id="versionBadge">v{version}<' in src)
check('README live demo','## 🚀 Live demo' in readme and 'https://ttomohisa.github.io/htmlapps-font-subsetter/' in readme)
check('README public sections',all(x in readme for x in ['## Features','## Quick start','## Usage','## Publish with GitHub Pages','## Development and build layout','## Privacy and runtime network protection','## Limitations','## Dependencies','## License']))
check('README JA public sections',all(x in readme_ja for x in ['## 主な機能','## すぐに使う','## 使い方','## GitHub Pagesで公開する','## 開発とビルド','## プライバシーと通信防止','## 制限事項','## 使用ライブラリ','## ライセンス']))
check('APP_SPEC current stable scope',f'Current implementation scope — v{version}' in spec)
check('CHANGELOG stable section',re.search(r'^## \[1\.0\.0\] - 2026-09-16$',changelog,re.M) is not None)
check('no current RC wording','**Current version: v0.9.0' not in readme and '**現在のバージョン: v0.9.0' not in readme_ja)
failed=[x for x in checks if not x[1]]
for name,ok in checks: print(('PASS' if ok else 'FAIL'),name)
print(f'{len(checks)-len(failed)}/{len(checks)} passed')
sys.exit(1 if failed else 0)
