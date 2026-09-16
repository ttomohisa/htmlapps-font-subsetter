from pathlib import Path
import json, time, zipfile, tempfile, re, sys
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

ROOT=Path(__file__).resolve().parents[1]
HTML=(ROOT/'dist/index.html').read_text(encoding='utf-8')
TD=ROOT/'test-data'
REG=str(TD/'fonts/BKTest-Regular.ttf')
BOLD=str(TD/'fonts/BKTest-Bold.ttf')
RESTRICTED=str(TD/'fonts/BKTest-Restricted.ttf')
NOSUB=str(TD/'fonts/BKTest-NoSubsetting.ttf')
BITMAP=str(TD/'fonts/BKTest-BitmapOnly.ttf')
BROKEN_XML=str(TD/'sources/broken.xml')


def wait_until(page, fn, timeout=30000, interval=0.05, desc='condition'):
    start=time.time(); last=None
    while (time.time()-start)*1000 < timeout:
        try:
            v=page.evaluate(fn)
            if v: return v
            last=v
        except Exception as e:
            last=e
        time.sleep(interval)
    raise AssertionError(f'timeout waiting for {desc}: {last}')


def js_bool(expr):
    return f'() => Boolean({expr})'


def load_page(browser, viewport=(1440,1000)):
    ctx=browser.new_context(viewport={'width':viewport[0],'height':viewport[1]}, accept_downloads=True, locale='ja-JP')
    page=ctx.new_page()
    errors=[]; bad_requests=[]; console_errors=[]
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('request', lambda req: bad_requests.append(req.url) if req.url.startswith(('http://','https://')) else None)
    page.on('console', lambda msg: console_errors.append(msg.text) if msg.type=='error' else None)
    page.set_content(HTML, wait_until='load')
    wait_until(page, "() => document.querySelector('#versionBadge')?.textContent === 'v1.0.0'", desc='v1.0.0 boot')
    return ctx,page,errors,bad_requests,console_errors


def generate_two(page, download_dir, label):
    page.set_input_files('#fontFileInput',[REG,BOLD])
    wait_until(page, "() => document.querySelectorAll('#fontList .font-card').length===2 && document.querySelector('#summaryReady')?.textContent.trim().startsWith('2 / 2')", timeout=30000, desc=f'{label} font inspection')
    # set deterministic text and output metadata
    page.fill('#subsetText','Browser Kitty 123 ABC xyz 日本語 髙﨑𠮷')
    page.dispatch_event('#subsetText','input')
    wait_until(page, "() => document.querySelector('#batchSelectedCount')?.textContent.trim()==='2' && !document.querySelector('#createFontButton')?.disabled", desc=f'{label} create enabled')
    rows=page.locator('#batchFontList .batch-font-row')
    assert rows.count()==2
    rows.nth(0).locator('[data-output-field="family"]').fill('BK Test Web')
    rows.nth(0).locator('[data-output-field="weight"]').fill('400')
    rows.nth(1).locator('[data-output-field="family"]').fill('BK Test Web')
    rows.nth(1).locator('[data-output-field="weight"]').fill('700')
    page.click('#createFontButton')
    wait_until(page, "() => !document.querySelector('#generationResult')?.hidden && document.querySelectorAll('#batchResultList .batch-result-row:not(.failed)').length===2", timeout=60000, desc=f'{label} generation result')
    wait_until(page, "() => !document.querySelector('#webfontPackage')?.hidden", desc=f'{label} package visible')
    css=page.input_value('#packageCss')
    assert 'font-weight: 400' in css and 'font-weight: 700' in css, css
    assert 'font-display: swap' in css and 'unicode-range:' in css
    with page.expect_download(timeout=30000) as di:
        page.click('#downloadPackageButton')
    d=di.value
    out=Path(download_dir)/f'{label}-font-subset.zip'
    d.save_as(str(out))
    with zipfile.ZipFile(out) as zf:
        names=sorted(zf.namelist())
        assert names==['demo.html','fonts.css','fonts/BKTest-Bold-subset.woff2','fonts/BKTest-Regular-subset.woff2','manifest.json'], names
        man=json.loads(zf.read('manifest.json'))
        assert man.get('app',{}).get('version')=='1.0.0', man
        assert len(man.get('fonts',[]))==2
        zcss=zf.read('fonts.css').decode('utf-8')
        assert 'font-weight: 400' in zcss and 'font-weight: 700' in zcss
    return out


def check_layout(page,width,height):
    page.set_viewport_size({'width':width,'height':height})
    time.sleep(.1)
    dims=page.evaluate("() => ({iw:innerWidth, sw:document.documentElement.scrollWidth, bw:document.body.scrollWidth, nav:getComputedStyle(document.querySelector('#mobileBottomBar')).display, title:getComputedStyle(document.querySelector('.brand-name')).fontSize, icon:getComputedStyle(document.querySelector('.brand-mark')).width})")
    assert dims['sw']<=dims['iw'] and dims['bw']<=dims['iw'], dims
    if width<=520:
        assert dims['nav']!='none' and dims['title']=='15px' and dims['icon']=='34px', dims
    return dims


def chromium_extended(browser):
    ctx,page,errors,bad,console=load_page(browser,(1440,1000))
    try:
        # empty state and language switch
        assert page.locator('#fontList .empty-state').count()==1
        assert page.is_disabled('#createFontButton')
        page.click('#languageButton')
        wait_until(page, "() => document.documentElement.lang==='en'", desc='english switch')
        assert page.locator('#heroTitle').inner_text().startswith('Keep only')
        page.click('#languageButton')
        wait_until(page, "() => document.documentElement.lang==='ja'", desc='japanese switch')
        # source error state
        page.set_input_files('#sourceFileInput',BROKEN_XML)
        wait_until(page, "() => document.querySelector('#sourceList')?.textContent.includes('読み取れませんでした') || document.querySelector('#sourceList')?.textContent.includes('解析できませんでした')", desc='broken XML error')
        # license gates
        page.set_input_files('#fontFileInput',[RESTRICTED,NOSUB,BITMAP])
        wait_until(page, "() => document.querySelectorAll('#fontList .font-card').length===3 && document.querySelector('#summaryReady')?.textContent.trim().startsWith('3 / 3')", desc='license fonts inspected')
        wait_until(page, "() => document.querySelectorAll('#batchFontList .batch-font-row').length===3", desc='license rows')
        rows=page.locator('#batchFontList .batch-font-row')
        disabled=[]; restricted_ack=0
        for i in range(rows.count()):
            row=rows.nth(i)
            fname=row.locator('.batch-file strong').inner_text()
            select=row.locator('[data-batch-select-id]')
            if 'NoSubsetting' in fname or 'BitmapOnly' in fname:
                assert select.is_disabled(), fname
                disabled.append(fname)
            if 'Restricted' in fname:
                assert not select.is_disabled()
                restricted_ack=row.locator('[data-license-ack-id]').count()
        assert len(disabled)==2 and restricted_ack==1
        # after text, restricted selected but acknowledgement required
        page.fill('#subsetText','Browser Kitty 123')
        page.dispatch_event('#subsetText','input')
        assert page.is_disabled('#createFontButton')
        ack=page.locator('[data-license-ack-id]')
        ack.check()
        wait_until(page, "() => !document.querySelector('#createFontButton')?.disabled", desc='restricted acknowledged')
        # mobile layout in both languages
        ja=check_layout(page,390,844)
        page.click('#languageButton')
        wait_until(page, "() => document.documentElement.lang==='en'")
        en=check_layout(page,390,844)
        assert not errors, errors
        assert not bad, bad
        # console may contain browser font warnings; only fail on CSP/network/security JS errors
        serious=[x for x in console if 'Refused' in x or 'Uncaught' in x or 'TypeError' in x or 'ReferenceError' in x]
        assert not serious, serious
        return {'mobileJa':ja,'mobileEn':en,'pageErrors':errors,'httpRequests':bad,'consoleErrors':console}
    finally:
        ctx.close()


def main():
    out={'browsers':{},'extended':None}
    tmp=Path(tempfile.mkdtemp(prefix='font-subsetter-release-'))
    with sync_playwright() as p:
        engines=[
            ('chromium',p.chromium, {'executable_path':'/usr/bin/chromium'}, Path('/usr/bin/chromium')),
            ('firefox',p.firefox, {}, Path(p.firefox.executable_path)),
            ('webkit',p.webkit, {}, Path(p.webkit.executable_path)),
        ]
        for name,engine,kwargs,exe in engines:
            if not exe.exists():
                out['browsers'][name]={'status':'not-run','reason':f'browser executable unavailable: {exe}'}
                print('SKIP',name,exe,flush=True)
                continue
            print('RUN',name,flush=True)
            browser=engine.launch(headless=True, **kwargs)
            try:
                ctx,page,errors,bad,console=load_page(browser)
                try:
                    package=generate_two(page,tmp,name)
                    dims=check_layout(page,390,844)
                    if errors: raise AssertionError(f'{name} page errors: {errors}')
                    if bad: raise AssertionError(f'{name} HTTP requests: {bad}')
                    serious=[x for x in console if 'Refused' in x or 'Uncaught' in x or 'TypeError' in x or 'ReferenceError' in x]
                    if serious: raise AssertionError(f'{name} serious console errors: {serious}')
                    out['browsers'][name]={'status':'pass','package':Path(package).name,'packageBytes':Path(package).stat().st_size,'mobile':dims,'consoleErrors':console}
                    print('PASS',name,flush=True)
                finally:
                    ctx.close()
                if name=='chromium':
                    out['extended']=chromium_extended(browser)
                    print('PASS chromium extended',flush=True)
            finally:
                browser.close()
    report=ROOT/'tests/reports/release-browser-report.json'; report.parent.mkdir(parents=True,exist_ok=True)
    report.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print(report)

if __name__=='__main__':
    main()
