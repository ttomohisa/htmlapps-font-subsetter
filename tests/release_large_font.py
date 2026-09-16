from pathlib import Path
import json,time,sys
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent))
import release_browser_smoke as t
FONT=Path('/usr/share/fonts/truetype/arphic-bkai00mp/bkai00mp.ttf')
if not FONT.exists():
    print('SKIP large-font fixture unavailable:',FONT)
    raise SystemExit(0)
with sync_playwright() as p:
    b=p.chromium.launch(headless=True, executable_path='/usr/bin/chromium')
    ctx,page,errors,bad,console=t.load_page(b)
    try:
        start=time.time(); page.set_input_files('#fontFileInput',str(FONT))
        t.wait_until(page,"() => document.querySelector('#summaryReady')?.textContent.trim().startsWith('1 / 1')",timeout=60000,desc='large font inspect')
        inspect_ms=round((time.time()-start)*1000)
        page.fill('#subsetText','Browser Kitty 123 中文測試字型'); page.dispatch_event('#subsetText','input')
        t.wait_until(page,"() => !document.querySelector('#createFontButton')?.disabled",desc='large create enabled')
        start=time.time(); page.click('#createFontButton')
        t.wait_until(page,"() => !document.querySelector('#generationResult')?.hidden && document.querySelectorAll('#batchResultList .batch-result-row:not(.failed)').length===1",timeout=90000,desc='large generation')
        wall_ms=round((time.time()-start)*1000)
        metrics=page.evaluate("() => ({original:document.querySelector('#metricOriginal').textContent,woff2:document.querySelector('#metricWoff2').textContent,reduction:document.querySelector('#metricReduction').textContent,time:document.querySelector('#metricTotalTime').textContent})")
        assert not errors and not bad and not [x for x in console if 'Uncaught' in x or 'TypeError' in x or 'ReferenceError' in x]
        # Cancel/stale-result regression on another run.
        page.fill('#subsetText','日本語フォント'*5000); page.dispatch_event('#subsetText','input')
        t.wait_until(page,"() => !document.querySelector('#createFontButton')?.disabled")
        page.click('#createFontButton'); time.sleep(.03)
        page.fill('#subsetText','cancelled input changed'); page.dispatch_event('#subsetText','input')
        t.wait_until(page,"() => document.querySelector('#generationProgress')?.hidden===true",timeout=30000,desc='cancelled progress hidden')
        state=page.evaluate("() => ({resultHidden:document.querySelector('#generationResult').hidden,progressHidden:document.querySelector('#generationProgress').hidden,createDisabled:document.querySelector('#createFontButton').disabled})")
        assert state['resultHidden'] and state['progressHidden'] and not state['createDisabled'],state
        (Path(__file__).resolve().parent/'reports').mkdir(parents=True,exist_ok=True)
        report={'font':str(FONT),'fontBytes':FONT.stat().st_size,'inspectMs':inspect_ms,'generationWallMs':wall_ms,'metrics':metrics,'cancelState':state}
        (Path(__file__).resolve().parent/'reports/release-large-font-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(report,ensure_ascii=False,indent=2))
    finally:
        ctx.close(); b.close()
