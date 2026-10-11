const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { gunzipSync } = require('node:zlib');

const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(process.env.APP_HTML || path.join(root, 'src/index.template.html'), 'utf8');
if (html.includes('id="self-extract-payload"')) {
  const payload = html.match(/id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(payload, 'self-extract wrapper contains a readable payload');
  html = gunzipSync(Buffer.from(payload[1].replace(/\s/g, ''), 'base64')).toString('utf8');
}
const css = html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css, 'inspect the application stylesheet, including inside the release wrapper');
const rules = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map(([, selectors, body]) => ({ selectors: selectors.trim().split(/,\s*/), body }));
const rule = selector => rules.find(item => item.selectors.includes(selector))?.body || '';
const declaration = (body, name, value) => assert.match(body, new RegExp(`(?:^|;)\\s*${name}\\s*:\\s*${value}\\s*(?:;|$)`));

// CSS contracts and actual event handlers at a DOM boundary, not browser layout tests.
// Native wheel/touch behavior, focus, and reachability still need browser checks.
test('only a native modal locks both document scrolling roots', () => {
  for (const selector of ['html:has(dialog:modal)', 'body:has(dialog:modal)']) {
    declaration(rule(selector), 'overflow', 'hidden');
    declaration(rule(selector), 'overscroll-behavior', 'none');
  }
  assert.doesNotMatch(css, /(?:html|body):has\(dialog\[open\]\)/);
  assert.doesNotMatch(rule('html') + ';' + rule('body'), /overflow\s*:\s*hidden/);
});

test('Help retains its fixed header, scrollable body, and safe-area allocation', () => {
  declaration(rule('dialog'), 'overflow', 'hidden');
  declaration(rule('#helpDialog[open]'), 'display', 'flex');
  declaration(rule('#helpDialog[open]'), 'flex-direction', 'column');
  assert.match(rule('#helpDialog[open]'), /max-height:calc\(100dvh - 28px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)/);
  declaration(rule('.dialog-header'), 'flex', '0 0 auto');
  declaration(rule('.dialog-body'), 'min-height', '0');
  declaration(rule('.dialog-body'), 'flex', '1 1 auto');
  declaration(rule('.dialog-body'), 'overflow', 'auto');
  declaration(rule('.dialog-body'), 'overscroll-behavior', 'contain');
  assert.match(rule('.dialog-body'), /padding:20px 20px calc\(28px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(rule('#helpDialog'), /max-height:calc\(100dvh - 20px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)/);
  assert.match(html, /<div class="dialog-header">[\s\S]*?id="closeHelpButton"[\s\S]*?<div class="dialog-body">/);
});

test('confirmation width, mobile bottom-sheet placement, and local-processing shield are preserved', () => {
  declaration(rule('.app-confirm-dialog'), 'width', 'min\\(420px,calc\\(100% - 24px\\)\\)');
  assert.doesNotMatch(rule('.app-confirm-dialog'), /display\s*:\s*flex/);
  assert.ok(rules.some(item => item.selectors.includes('.app-confirm-dialog') && /margin:auto 0 0/.test(item.body) && /border-radius:22px 22px 0 0/.test(item.body)));
  assert.match(html, /<div class="app-confirm-body">\s*<p[^>]*id="appConfirmMessage"[^>]*><\/p>\s*<div class="app-confirm-actions">/);
  const badge = html.match(/<div class="local-badge">\s*(<svg[\s\S]*?<\/svg>)/)?.[1];
  assert.ok(badge, 'retain the existing local-processing shield');
  assert.match(badge, /aria-hidden="true"/);
  assert.match(badge, /d="M12 3 5 6v5c0 4\.6 2\.8 8 7 10 4\.2-2 7-5\.4 7-10V6z"/);
  assert.match(badge, /d="m9 12 2 2 4-5"/);
});

test('only an open confirmation becomes a viewport-bounded flex column', () => {
  const open = rule('.app-confirm-dialog[open]');
  declaration(open, 'display', 'flex');
  declaration(open, 'flex-direction', 'column');
  assert.match(open, /max-height:min\(760px,calc\(100dvh - 28px - env\(safe-area-inset-top\) - env\(safe-area-inset-bottom\)\)\)/);
  assert.doesNotMatch(rule('.app-confirm-dialog'), /display\s*:\s*flex/);
});

test('confirmation keeps its header while its message and both actions scroll inside', () => {
  declaration(rule('.app-confirm-header'), 'flex', '0 0 auto');
  const body = rule('.app-confirm-body');
  declaration(body, 'min-height', '0');
  declaration(body, 'flex', '1 1 auto');
  declaration(body, 'overflow', 'auto');
  declaration(body, 'overscroll-behavior', 'contain');
  assert.match(body, /padding:18px 18px calc\(18px \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(html, /<div class="app-confirm-body">\s*<p[^>]*id="appConfirmMessage"[^>]*><\/p>\s*<div class="app-confirm-actions">\s*<button[^>]*id="appConfirmCancel"[^>]*>[\s\S]*?<\/button>\s*<button[^>]*id="appConfirmOk"[^>]*>[\s\S]*?<\/button>\s*<\/div>\s*<\/div>/);
});

test('Japanese and English Help explain inner scrolling and background locking', () => {
  const dictionaries = html.match(/^    const translations=(.*);$/m)?.[1];
  assert.ok(dictionaries);
  const translations = vm.runInNewContext(`(${dictionaries})`);
  const help = html.match(/<!-- APP:HELP:BEGIN -->([\s\S]*?)<!-- APP:HELP:END -->/)?.[1];
  assert.match(help, /data-i18n="helpDialogScroll"/);
  assert.match(translations.ja.helpDialogScroll || '', /スクロール/);
  assert.match(translations.ja.helpDialogScroll || '', /背景/);
  assert.match(translations.en.helpDialogScroll || '', /scroll/i);
  assert.match(translations.en.helpDialogScroll || '', /background/i);
});

function harness() {
  const nodes = new Map(), frames = [], document = { activeElement: null };
  class Element {
    constructor() { this.listeners = new Map(); this.isConnected = true; this.open = false; this.classList = { toggle() {} }; }
    addEventListener(type, callback) { const callbacks = this.listeners.get(type) || []; callbacks.push(callback); this.listeners.set(type, callbacks); }
    emit(type, fields = {}) { const event = { clientX: 50, clientY: 50, prevented: false, preventDefault() { this.prevented = true; }, ...fields }; for (const callback of this.listeners.get(type) || []) callback(event); return event; }
    showModal() { this.open = true; }
    close() { this.open = false; this.emit('close'); }
    focus(options) { this.focusOptions = options; document.activeElement = this; }
    getBoundingClientRect() { return { left: 10, top: 10, right: 100, bottom: 100 }; }
  }
  const $ = selector => { if (!nodes.has(selector)) nodes.set(selector, new Element()); return nodes.get(selector); };
  const origin = $('#origin'); origin.focus();
  const context = vm.createContext({ $, document, HTMLElement: Element, t: key => key, requestAnimationFrame: callback => frames.push(callback) });
  const confirm = html.split('\n').find(line => line.startsWith('    const AppConfirm='));
  const help = html.split('\n').find(line => line.startsWith("    const helpDialog=$('#helpDialog');"));
  assert.ok(confirm && help, 'exercise the actual production handlers');
  vm.runInContext(`${confirm}\n${help}\nglobalThis.ask=AppConfirm.ask;`, context);
  return { $, origin, document, ask: context.ask, flush() { while (frames.length) frames.shift()(); } };
}

for (const action of ['close', 'cancel', 'escape', 'backdrop', 'ok']) {
  test(`confirmation ${action} settles once, restores focus, and reopens`, async () => {
    const h = harness();
    for (let cycle = 0; cycle < 2; cycle++) {
      let settlements = 0;
      const result = h.ask({ title: 'Remove sources?', message: 'Synthetic text', tone: 'danger' }).then(value => { settlements++; return value; });
      h.flush();
      assert.equal(h.$('#appConfirmDialog').open, true);
      assert.equal(h.document.activeElement, h.$('#appConfirmCancel'));
      h.$('#appConfirmDialog').emit('click');
      assert.equal(h.$('#appConfirmDialog').open, true, 'inside click must not dismiss');
      if (action === 'escape') assert.equal(h.$('#appConfirmDialog').emit('cancel').prevented, true);
      else if (action === 'backdrop') h.$('#appConfirmDialog').emit('click', { clientX: 0, clientY: 0 });
      else h.$({ close: '#appConfirmClose', cancel: '#appConfirmCancel', ok: '#appConfirmOk' }[action]).emit('click');
      assert.equal(await result, action === 'ok');
      h.$('#appConfirmCancel').emit('click');
      assert.equal(settlements, 1);
      assert.equal(h.$('#appConfirmDialog').open, false);
      assert.equal(h.document.activeElement, h.origin);
      assert.equal(h.origin.focusOptions.preventScroll, true);
    }
  });
}

test('Help keeps native Escape cancellation, Close, backdrop dismissal, and reopening', () => {
  const h = harness();
  for (const close of ['button', 'escape', 'backdrop']) {
    h.$('#helpButton').emit('click');
    assert.equal(h.$('#helpDialog').open, true);
    h.$('#helpDialog').emit('click');
    assert.equal(h.$('#helpDialog').open, true);
    if (close === 'button') h.$('#closeHelpButton').emit('click');
    else if (close === 'escape') {
      assert.equal(h.$('#helpDialog').emit('cancel').prevented, false, 'leave native Escape dismissal intact');
      h.$('#helpDialog').close(); // Native default action, outside this DOM-boundary test.
    } else h.$('#helpDialog').emit('click', { clientX: 0, clientY: 0 });
    assert.equal(h.$('#helpDialog').open, false);
  }
});

test('canonical check gates source and both artifacts without dropping header or coverage tests', () => {
  const gate = fs.readFileSync(path.join(root, 'scripts/check-repository.ps1'), 'utf8');
  for (const file of ['tests/dialog-layout.test.cjs', 'tests/coverage-report.test.cjs', 'scripts/check-header-regression.mjs', 'tests/icon-brand.test.mjs']) {
    assert.ok(gate.includes(file) || gate.includes(file.replaceAll('/', '\\')), `gate runs ${file}`);
  }
  for (const artifact of ['src/index.template.html', 'dist/index.html', 'dist/index.self-extract.html']) {
    assert.ok(gate.includes(artifact) || gate.includes(artifact.replaceAll('/', '\\')), `gate includes ${artifact}`);
  }
  assert.match(gate, /Modal layout regression tests failed/);
  assert.match(gate, /finally\s*\{[\s\S]*?\$env:APP_HTML\s*=\s*\$previousAppHtml/);
  assert.match(gate, /\$env:FONT_COVERAGE_HTML\s*=\s*\$previousCoverageHtml/);
  for (const file of ['build-standalone.yml', 'deploy-pages.yml']) {
    assert.match(fs.readFileSync(path.join(root, '.github/workflows', file), 'utf8'), /\.\/scripts\/check-repository\.ps1/);
  }
});
