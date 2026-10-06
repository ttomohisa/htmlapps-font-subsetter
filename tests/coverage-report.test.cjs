// Node-only regression tests against actual application functions. No browser claims.
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '..');
let source = fs.readFileSync(process.env.FONT_COVERAGE_HTML || path.join(root, 'src/index.template.html'), 'utf8');
if (source.includes('id="self-extract-payload"')) {
  source = zlib.gunzipSync(Buffer.from(source.match(/id="self-extract-payload"[^>]*>([\s\S]*?)<\/script>/)[1].replace(/\s/g,''), 'base64')).toString('utf8');
}
function actualFunction(name) {
  const lines = source.split('\n');
  const start = lines.findIndex(line => new RegExp(`^    (?:async )?function ${name}\\(`).test(line));
  assert.notEqual(start, -1, `Production function ${name} exists`);
  let end = start + 1;
  while (end < lines.length && !/^    (?:(?:async )?function |const |let |\$)/.test(lines[end]) && !/^  \}\)\(\);/.test(lines[end])) end++;
  return lines.slice(start,end).join('\n');
}
const coreNames = ['tagAt','sliceTable','sfntTableMap','cmapSubtables','cmapFormat4Has','cmapSubtableHas','cmapHasCodepoint','uniqueCodepoints','coverageForFont','codepointLabel','formatTemplate','uniqueCodepointString','selectedPresetText','combinedCharacterText','packageCodepoints','codepointHex','unicodeRange','fsTypeInfo','licenseGate','cssString','sanitizeBaseName','normalizedWeight','successfulResults','packageEntries','generatedCss','packageManifest'];
function harness(names = []) {
  const elements = new Map([['#subsetText',{value:''}],['#copyCoverageReportButton',{disabled:true}]]);
  const notices = [], copied = [], temporary = [];
  const focus = {isConnected:true, focus(options){ this.restored = options; }};
  const state = {fonts:[],sources:[],selectedPresets:new Set(),licenseAcknowledged:new Set(),results:[],generation:9,phase:'result',busy:false,result:{bytes:[1,2]},previewText:'unchanged',previewSize:36};
  const document = {activeElement:focus, body:{append(area){temporary.push(area);}},createElement(){return {style:{},value:'',select(){document.activeElement=this;},remove(){this.removed=true;if(document.activeElement===this)document.activeElement=document.body;}};},execCommand(){return true;}};
  const c = vm.createContext({state,document,navigator:{clipboard:{async writeText(text){copied.push(text);}}},Uint8Array,DataView,Date,console,
    $:s=>elements.get(s),PRESET_DEFINITIONS:[{id:'synthetic'}],PRESET_TEXT:{synthetic:'𠮟é'},APP_CONFIG:{name:'Font Subsetter',version:'1.0.0'},
    toast:(text,opts)=>notices.push({text,...opts}),renderSources(){},renderCharacterStats(){},renderCoverage(){},renderOutputControls(){},invalidateResult(){},
  });
  const translations = source.match(/^    const translations=.*$/m)[0];
  vm.runInContext(`${translations}\nlet language='en'; let coverageReportCopying=false;\nfunction t(key){return translations[language]?.[key]??translations.en[key]??key}\nfunction formatNumber(n){return String(n)}\n` + [...new Set([...coreNames,...names])].map(actualFunction).join('\n'), c);
  return {c,state,elements,notices,copied,temporary,document,focus,setLanguage:lang=>vm.runInContext(`language=${JSON.stringify(lang)}`,c)};
}
function font(c, suffix='zero',id=1) {
  const raw=fs.readFileSync(path.join(__dirname,'fixtures',`synthetic-cmap12-${suffix}.ttf`));
  const table=c.sfntTableMap(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength)).get('cmap');
  return {id,status:'ready',file:{name:`synthetic-${suffix}.ttf`},metadata:{format:'TTF',cmapTable:table,cmapSubtables:c.cmapSubtables(table)}};
}
function result(id=1){return {id,status:'success',bytes:new Uint8Array([1,2]),originalSize:952,sourceName:'fixture.ttf',meta:{filename:'edited-name',family:'Fixture',weight:400,style:'normal'}};}
const reportNames=['coverageReportAvailable','coverageReportCmapReadable','coverageReportText','renderCoverageReportControl','copyTextValue','copyCoverageReport'];

test('format 12 glyph zero is missing while later sequential glyphs remain supported',()=>{
  const {c,state,elements}=harness();const item=font(c);state.fonts=[item];elements.get('#subsetText').value='A😀😁😂😃';
  const cov=c.coverageForFont(item);
  assert.equal(cov.supported,3);assert.deepEqual(Array.from(cov.missing),[0x1f600,0x1f603]);
  assert.equal(c.cmapHasCodepoint(item.metadata.cmapTable,0x1f601),true);
  assert.equal(c.cmapHasCodepoint(item.metadata.cmapTable,0x1f602),true);
  assert.equal(c.cmapHasCodepoint(font(c,'nonzero').metadata.cmapTable,0x1f600),true);
  assert.equal(c.cmapHasCodepoint(new Uint8Array([0,0,0]),0x1f600),false);
});
test('package CSS and manifest exclude glyph zero without losing valid group offsets',()=>{
  const {c,state,elements}=harness();state.fonts=[font(c)];state.results=[result()];elements.get('#subsetText').value='A😀😁😂😃';
  assert.deepEqual(Array.from(c.packageCodepoints(result())),[65,0x1f601,0x1f602]);
  assert.match(c.generatedCss(),/unicode-range: U\+0041, U\+1F601-1F602;/);
  const manifest=c.packageManifest();assert.equal(manifest.requestedCharacterCount,5);assert.equal(manifest.fonts[0].keptCharacters,3);
});
test('format 13 and per-font licensing gates remain unchanged',()=>{
  const {c,state}=harness();const table=font(c).metadata.cmapTable.slice(),v=new DataView(table.buffer);v.setUint16(v.getUint32(8,false),13,false);
  assert.equal(c.cmapHasCodepoint(table,0x1f600),false);assert.equal(c.cmapHasCodepoint(table,0x1f601),false);assert.equal(c.cmapHasCodepoint(table,65),true);
  for(const value of [0x0100,0x0200,0x0002])assert.equal(c.licenseGate({id:1,metadata:{fsType:{version:2,value}}}).allowed,false);
  state.licenseAcknowledged.add(1);assert.equal(c.licenseGate({id:1,metadata:{fsType:{version:2,value:2}}}).allowed,true);assert.equal(c.licenseGate({id:2,metadata:{fsType:{version:2,value:2}}}).allowed,false);
});

test('report uses fresh combined inputs, preserves Unicode order and excludes source text and font bytes',()=>{
  const {c,state,elements}=harness(reportNames);const a=font(c);state.fonts=[a];
  elements.get('#subsetText').value='AA😀e\u0301\ufe0f';state.selectedPresets.add('synthetic');state.sources=[{status:'ready',text:'secret project text\r\n\t😀'}];
  const report=c.coverageReportText();const expected=c.uniqueCodepoints(c.combinedCharacterText());
  assert.match(report,new RegExp(`Requested code points: ${expected.length}`));
  assert.match(report,/cmap code-point coverage/);assert.match(report,/not a shaping or license guarantee/);
  assert.match(report,/Supported code points: 1/);assert.match(report,/U\+01F600 U\+0065 U\+0301 U\+FE0F U\+020B9F U\+00E9/);
  assert.match(report,/U\+000D U\+000A U\+0009/);assert.ok(!report.includes('secret project text'));assert.ok(!report.includes('😀'));
  assert.ok(!report.includes('AA'));assert.ok(!report.includes('AAEAAAA')); // no text/font dumps
});
test('mixed fonts preserve unavailable and failed coverage as unknown',()=>{
  const {c,state,elements}=harness(reportNames);elements.get('#subsetText').value='A😀';
  state.fonts=[font(c,'nonzero'),{id:2,status:'ready',file:{name:'opaque.woff2'},metadata:{format:'WOFF2'}},{id:3,status:'error',file:{name:'bad.ttf'},error:'private detail'},{id:4,status:'ready',file:{name:'unsupported.ttf'},metadata:{cmapTable:new Uint8Array([0,0,0,0])}}];
  const sections=c.coverageReportText().split('\n\n');assert.equal(sections.length,5);
  assert.match(sections[1],/Status: Available/);assert.match(sections[1],/Supported code points: 2/);assert.match(sections[1],/Missing code points: 0/);
  for(const section of sections.slice(2)){assert.match(section,/Supported code points: Unknown/);assert.match(section,/Missing code points: Unknown/);assert.ok(!section.includes('U+'));}
  assert.match(sections[2],/Status: Unavailable/);assert.match(sections[3],/Status: Failed/);assert.match(sections[4],/Status: Unavailable/);assert.ok(!sections[3].includes('private detail'));
});
test('report caps each missing list at 500 and keeps complete counts with explicit truncation',()=>{
  const {c,state,elements}=harness(reportNames);state.fonts=[font(c),font(c,'nonzero',2)];
  elements.get('#subsetText').value=Array.from({length:501},(_,i)=>String.fromCodePoint(0x4000+i)).join('');
  const sections=c.coverageReportText().split('\n\n').slice(1);
  for(const section of sections){assert.match(section,/Missing code points: 501/);assert.equal((section.match(/U\+/g)||[]).length,500);assert.match(section,/Showing first 500 of 501 missing code points \(truncated\)/);assert.ok(!section.includes('U+41F4'));}
  elements.get('#subsetText').value=elements.get('#subsetText').value.slice(0,-1);assert.ok(!c.coverageReportText().includes('truncated'));
});
test('filenames are single-line reversible plain-text strings, including control and bidi characters',()=>{
  const {c,state,elements}=harness(reportNames);elements.get('#subsetText').value='A';const item=font(c);item.file.name='a"&<b>日本\t\nStatus: forged\r\u0085\u2028\u202e.ttf';state.fonts=[item];
  const report=c.coverageReportText(),line=report.split('\n').find(line=>line.startsWith('Font: '));
  assert.equal(JSON.parse(line.slice(6)),item.file.name);assert.ok(!report.includes('\nStatus: forged'));assert.ok(!/[\u0085\u2028\u202e]/.test(line));
});
test('report guard and button disable empty or inspecting state without gating on generation or license',()=>{
  const {c,state,elements}=harness(reportNames);const button=elements.get('#copyCoverageReportButton');
  c.renderCoverageReportControl();assert.equal(button.disabled,true);assert.equal(c.coverageReportText(),'');
  state.fonts=[font(c)];c.renderCoverageReportControl();assert.equal(button.disabled,true);
  elements.get('#subsetText').value='A';c.renderCoverageReportControl();assert.equal(button.disabled,false);
  state.fonts.push({status:'checking'});c.renderCoverageReportControl();assert.equal(button.disabled,true);assert.equal(c.coverageReportText(),'');state.fonts.pop();
  state.sources=[{status:'checking',text:''}];c.renderCoverageReportControl();assert.equal(button.disabled,true);state.sources[0].status='error';c.renderCoverageReportControl();assert.equal(button.disabled,false);
  state.busy=true;state.fonts[0].metadata.fsType={version:2,value:0x0100};c.renderCoverageReportControl();assert.equal(button.disabled,false);
});
test('copy snapshots each click, updates after edits/presets/source completion/remove/Undo and leaves results intact',async()=>{
  const h=harness([...reportNames,'removeSource']);const {c,state,elements,copied,notices}=h;state.fonts=[font(c)];elements.get('#subsetText').value='A';
  const original={result:state.result,results:state.results,generation:state.generation,previewText:state.previewText,phase:state.phase};
  await c.copyCoverageReport();assert.match(copied[0],/Requested code points: 1/);
  elements.get('#subsetText').value='A😀';state.selectedPresets.add('synthetic');state.sources=[{id:1,status:'ready',text:'B'}];await c.copyCoverageReport();assert.match(copied[1],/Requested code points: 5/);
  c.removeSource(1);await c.copyCoverageReport();assert.match(copied[2],/Requested code points: 4/);
  notices.find(n=>n.onAction).onAction();await c.copyCoverageReport();assert.equal(copied[3],copied[1]);
  h.setLanguage('ja');await c.copyCoverageReport();assert.match(copied[4],/文字対応レポート/);assert.match(copied[4],/必要なコードポイント: 5/);
  for(const [key,value] of Object.entries(original))assert.equal(state[key],value,key);
});
test('copy is disabled during its pending write, then a later click reads current inputs',async()=>{
  const {c,state,elements,copied}=harness(reportNames);state.fonts=[font(c)];elements.get('#subsetText').value='A';let resolve;
  c.navigator.clipboard.writeText=text=>{copied.push(text);return new Promise(r=>resolve=r);};
  const pending=c.copyCoverageReport();assert.equal(elements.get('#copyCoverageReportButton').disabled,true);elements.get('#subsetText').value='A😀';
  await c.copyCoverageReport();assert.equal(copied.length,1);resolve();await pending;assert.equal(elements.get('#copyCoverageReportButton').disabled,false);assert.match(copied[0],/Requested code points: 1/);
  c.navigator.clipboard.writeText=async text=>copied.push(text);await c.copyCoverageReport();assert.match(copied[1],/Requested code points: 2/);
});
test('clipboard fallback succeeds only on a true result and restores focus without changing input',async()=>{
  const {c,state,elements,temporary,focus,document,notices}=harness(reportNames);state.fonts=[font(c)];elements.get('#subsetText').value='A';delete c.navigator.clipboard;
  await c.copyCoverageReport();assert.equal(notices.at(-1).tone,'success');assert.equal(temporary[0].removed,true);assert.equal(focus.restored.preventScroll,true);assert.equal(elements.get('#subsetText').value,'A');
  document.execCommand=()=>false;await c.copyCoverageReport();assert.equal(notices.at(-1).tone,'warning');assert.match(notices.at(-1).text,/Could not copy/);assert.equal(temporary.at(-1).removed,true);
  document.execCommand=()=>{throw new Error('Denied')};await c.copyCoverageReport();assert.equal(notices.at(-1).tone,'warning');assert.equal(elements.get('#copyCoverageReportButton').disabled,false);
});
test('denied async clipboard plus failed fallback never reports success and releases copy guard',async()=>{
  const {c,state,elements,document,notices}=harness(reportNames);state.fonts=[font(c)];elements.get('#subsetText').value='A';
  c.navigator.clipboard.writeText=async()=>{throw new Error('NotAllowedError')};document.execCommand=()=>false;
  await c.copyCoverageReport();assert.equal(notices.length,1);assert.equal(notices[0].tone,'warning');assert.equal(elements.get('#copyCoverageReportButton').disabled,false);
});
test('report UI has an explicit localized button, wrapping layout, help and render wiring',()=>{
  assert.match(source,/<button[^>]*id="copyCoverageReportButton"[^>]*type="button"[^>]*disabled/);
  assert.match(source,/data-i18n="coverageReportCopy"/);assert.match(source,/\.coverage-heading\{[^}]*flex-wrap:wrap/);
  assert.match(actualFunction('renderCoverage'),/renderCoverageReportControl\(\)/);
  assert.match(source,/\$\('#copyCoverageReportButton'\)\.addEventListener\('click',copyCoverageReport\)/);
  const help=source.split('APP:HELP:BEGIN')[1].split('APP:HELP:END')[0];assert.match(help,/coverage report|文字対応レポート/);
  assert.match(source,/helpCoverageReport/);
});

test('other supported cmap formats retain zero-glyph and bounds behavior',()=>{
  const {c}=harness();
  for(const format of [0,6,10]){
    const size=format===0?262:format===6?14:24,bytes=new Uint8Array(size),v=new DataView(bytes.buffer);v.setUint16(0,format,false);
    if(format===0){bytes[6+65]=1;}else if(format===6){v.setUint16(6,65,false);v.setUint16(8,2,false);v.setUint16(10,1,false);}else{v.setUint32(12,65,false);v.setUint32(16,2,false);v.setUint16(20,1,false);}
    assert.equal(c.cmapSubtableHas(bytes,{offset:0,format},65),true);assert.equal(c.cmapSubtableHas(bytes,{offset:0,format},66),false);assert.equal(c.cmapSubtableHas(bytes,{offset:0,format},67),false);
    assert.equal(c.cmapSubtableHas(bytes.slice(0,5),{offset:0,format},65),false);
  }
  // Two format-4 segments: A->1, then the required 0xFFFF sentinel->0.
  const bytes=new Uint8Array(32),v=new DataView(bytes.buffer);v.setUint16(0,4,false);v.setUint16(2,32,false);v.setUint16(6,4,false);
  for(const [offset,value] of [[14,65],[16,65535],[20,65],[22,65535],[24,65536-64],[26,1]])v.setUint16(offset,value,false);
  assert.equal(c.cmapSubtableHas(bytes,{offset:0,format:4},65),true);assert.equal(c.cmapSubtableHas(bytes,{offset:0,format:4},66),false);assert.equal(c.cmapSubtableHas(bytes,{offset:0,format:4},65535),false);
});
test('existing missing-character copy remains full-length and truthfully reports clipboard failure',async()=>{
  const h=harness(reportNames),{c,state,elements,copied,notices,document}=h;state.fonts=[font(c)];
  const missing=Array.from({length:501},(_,i)=>String.fromCodePoint(0x4000+i)).join('');elements.get('#subsetText').value=missing;
  let handler;elements.set('#coverageList',{addEventListener(event,callback){handler=callback;}});
  vm.runInContext(source.split('\n').find(line=>line.startsWith("    $('#coverageList').addEventListener")),c);
  const event={target:{closest(){return {dataset:{copyMissingId:'1'}};}}};await handler(event);assert.equal(copied[0],missing);assert.equal(notices.at(-1).tone,'success');
  c.navigator.clipboard.writeText=async()=>{throw new Error('Denied')};document.execCommand=()=>false;await handler(event);assert.equal(notices.at(-1).tone,'warning');
});
test('source completion and font removal re-evaluate availability and snapshot without caching',()=>{
  const {c,state,elements}=harness(reportNames);state.fonts=[font(c)];state.sources=[{status:'checking',text:''}];assert.equal(c.coverageReportText(),'');
  state.sources[0].text='A😀';state.sources[0].status='ready';assert.match(c.coverageReportText(),/Requested code points: 2/);
  const removed=state.fonts.pop();c.renderCoverageReportControl();assert.equal(elements.get('#copyCoverageReportButton').disabled,true);assert.equal(c.coverageReportText(),'');
  state.fonts.push(removed);c.renderCoverageReportControl();assert.equal(elements.get('#copyCoverageReportButton').disabled,false);assert.match(c.coverageReportText(),/Missing Unicode labels: U\+01F600/);
});
test('report-only action never copies from an empty or inspecting state',async()=>{
  const {c,state,elements,copied,notices}=harness(reportNames);await c.copyCoverageReport();state.fonts=[font(c)];await c.copyCoverageReport();elements.get('#subsetText').value='A';state.sources=[{status:'checking'}];await c.copyCoverageReport();assert.equal(copied.length,0);assert.equal(notices.length,0);
});

test('truncated recognized cmap is unknown rather than a verified missing set',()=>{
  const {c,state,elements}=harness(reportNames),item=font(c);item.metadata.cmapTable=item.metadata.cmapTable.slice(0,14);item.metadata.cmapSubtables=c.cmapSubtables(item.metadata.cmapTable);state.fonts=[item];elements.get('#subsetText').value='A😀';
  const report=c.coverageReportText();assert.match(report,/Status: Unavailable/);assert.match(report,/Supported code points: Unknown/);assert.match(report,/Missing code points: Unknown/);assert.ok(!report.includes('Missing Unicode labels:'));
});
test('all Unicode bidi control characters in filenames are escaped as plain-text Unicode escapes',()=>{
  const {c,state,elements}=harness(reportNames),item=font(c);item.file.name='a\u061c\u200e\u200f.ttf';state.fonts=[item];elements.get('#subsetText').value='A';const line=c.coverageReportText().split('\n').find(line=>line.startsWith('Font: '));
  assert.ok(!/[\u061c\u200e\u200f]/.test(line));assert.equal(JSON.parse(line.slice(6)),item.file.name);
});
test('report restores its own keyboard focus after disabling the trigger on all copy paths',async()=>{
  for(const mode of ['modern','fallback','failed']){
    const {c,state,elements,document}=harness(reportNames),button=elements.get('#copyCoverageReportButton');state.fonts=[font(c)];elements.get('#subsetText').value='A';
    Object.defineProperty(button,'disabled',{set(value){this.disabledValue=value;if(value&&document.activeElement===this)document.activeElement=document.body;},get(){return this.disabledValue;}});
    button.focus=()=>{document.activeElement=button;};button.isConnected=true;document.activeElement=button;
    if(mode!=='modern')delete c.navigator.clipboard;if(mode==='failed')document.execCommand=()=>false;
    await c.copyCoverageReport();assert.equal(button.disabled,false);assert.equal(document.activeElement,button,mode);
  }
});
test('report copy does not steal focus moved to another control during a pending clipboard write',async()=>{
  const {c,state,elements,document}=harness(reportNames),button=elements.get('#copyCoverageReportButton');state.fonts=[font(c)];elements.get('#subsetText').value='A';
  Object.defineProperty(button,'disabled',{set(value){this.disabledValue=value;if(value&&document.activeElement===this)document.activeElement=document.body;},get(){return this.disabledValue;}});
  button.focus=()=>{document.activeElement=button;};button.isConnected=true;document.activeElement=button;let resolve;c.navigator.clipboard.writeText=()=>new Promise(r=>resolve=r);
  const pending=c.copyCoverageReport(),other={isConnected:true};document.activeElement=other;resolve();await pending;assert.equal(document.activeElement,other);
});

test('report readability requires complete declared mapping arrays for every supported format',()=>{
  const {c}=harness(reportNames);
  for(const format of [0,4,6,10,12,13]){
    const size={0:262,4:32,6:14,10:24,12:28,13:28}[format],table=new Uint8Array(size),v=new DataView(table.buffer);v.setUint16(0,format,false);
    if(format>=10)v.setUint32(4,size,false);else v.setUint16(2,size,false);
    if(format===4)v.setUint16(6,4,false);
    if(format===6)v.setUint16(8,2,false);
    if(format===10)v.setUint32(16,2,false);
    if(format===12||format===13)v.setUint32(12,1,false);
    const item={metadata:{cmapTable:table,cmapSubtables:[{offset:0,format}]}};
    assert.equal(c.coverageReportCmapReadable(item),true,`complete format ${format}`);
    item.metadata.cmapTable=table.slice(0,-1);assert.equal(c.coverageReportCmapReadable(item),false,`truncated format ${format}`);
    item.metadata.cmapTable=table;if(format>=10)v.setUint32(4,size-1,false);else v.setUint16(2,size-1,false);
    assert.equal(c.coverageReportCmapReadable(item),false,`short declared length format ${format}`);
  }
});
