from pathlib import Path
import json,time,sys
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
html=(ROOT/'dist/index.self-extract.html').read_text('ascii')
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
    ctx=b.new_context(viewport={'width':390,'height':844},locale='ja-JP')
    page=ctx.new_page(); errors=[]; bad=[]; console=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:bad.append(r.url) if r.url.startswith(('http://','https://')) else None)
    page.on('console',lambda m:console.append(m.text) if m.type=='error' else None)
    try:
        page.set_content(html,wait_until='load')
        start=time.time(); restored=False
        while time.time()-start<20:
            if page.locator('#versionBadge').count() and page.locator('#versionBadge').inner_text()=='v1.0.0': restored=True; break
            time.sleep(.05)
        dims=page.evaluate("() => ({iw:innerWidth,sw:document.documentElement.scrollWidth,title:document.title,lang:document.documentElement.lang})")
        assert restored and not errors and not bad and dims['sw']<=dims['iw'],(restored,errors,bad,dims)
        (ROOT/'tests/reports').mkdir(parents=True,exist_ok=True)
        report={'restored':restored,'dims':dims,'pageErrors':errors,'httpRequests':bad,'consoleErrors':console}
        (ROOT/'tests/reports/release-self-extract-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False,indent=2))
    finally:
        ctx.close();b.close()
