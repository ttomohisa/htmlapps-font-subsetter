/* Browser Kitty Font Subsetter v0.2.0 worker core */
'use strict';

let hbExports=null;

async function initHarfBuzz(wasmBytes){
  if(hbExports)return hbExports;
  const bytes=wasmBytes instanceof Uint8Array?wasmBytes:new Uint8Array(wasmBytes);
  const {instance}=await WebAssembly.instantiate(bytes,{});
  hbExports=instance.exports;
  const required=['memory','malloc','free','hb_blob_create','hb_blob_destroy','hb_blob_get_length','hb_blob_get_data','hb_face_create','hb_face_destroy','hb_face_reference_blob','hb_subset_input_create_or_fail','hb_subset_input_destroy','hb_subset_input_unicode_set','hb_set_add','hb_subset_or_fail'];
  for(const name of required){if(typeof hbExports[name]==='undefined')throw new Error(`HarfBuzz runtime is missing ${name}`)}
  return hbExports;
}

function subsetSfnt(fontBytes,text){
  if(!hbExports)throw new Error('HarfBuzz runtime is not initialized');
  const e=hbExports,inputBytes=fontBytes instanceof Uint8Array?fontBytes:new Uint8Array(fontBytes);
  const codepoints=[...new Set(Array.from(text||'',ch=>ch.codePointAt(0)))];
  if(!codepoints.length)throw new Error('No characters were provided');
  let fontPtr=0,blob=0,face=0,input=0,subsetFace=0,resultBlob=0;
  try{
    fontPtr=e.malloc(inputBytes.byteLength);
    if(!fontPtr)throw new Error('Could not allocate font memory');
    new Uint8Array(e.memory.buffer,fontPtr,inputBytes.byteLength).set(inputBytes);
    blob=e.hb_blob_create(fontPtr,inputBytes.byteLength,2,0,0); // HB_MEMORY_MODE_WRITABLE
    if(!blob)throw new Error('Could not create HarfBuzz font blob');
    face=e.hb_face_create(blob,0);
    e.hb_blob_destroy(blob); blob=0;
    if(!face)throw new Error('Could not create HarfBuzz face');
    input=e.hb_subset_input_create_or_fail();
    if(!input)throw new Error('Could not create HarfBuzz subset input');
    const unicodeSet=e.hb_subset_input_unicode_set(input);
    if(!unicodeSet)throw new Error('Could not access HarfBuzz Unicode set');
    for(const cp of codepoints)e.hb_set_add(unicodeSet,cp);
    subsetFace=e.hb_subset_or_fail(face,input);
    if(!subsetFace)throw new Error('HarfBuzz could not subset this font');
    resultBlob=e.hb_face_reference_blob(subsetFace);
    if(!resultBlob)throw new Error('HarfBuzz returned no subset data');
    const length=e.hb_blob_get_length(resultBlob);
    const offset=e.hb_blob_get_data(resultBlob,0);
    if(!offset||!length)throw new Error('HarfBuzz returned an empty subset');
    return {bytes:new Uint8Array(e.memory.buffer,offset,length).slice(),codepoints};
  }finally{
    if(resultBlob)e.hb_blob_destroy(resultBlob);
    if(subsetFace)e.hb_face_destroy(subsetFace);
    if(input)e.hb_subset_input_destroy(input);
    if(face)e.hb_face_destroy(face);
    if(blob)e.hb_blob_destroy(blob);
    if(fontPtr)e.free(fontPtr);
  }
}

const WOFF2_TAGS=['cmap','head','hhea','hmtx','maxp','name','OS/2','post','cvt ','fpgm','glyf','loca','prep','CFF ','VORG','EBDT','EBLC','gasp','hdmx','kern','LTSH','PCLT','VDMX','vhea','vmtx','BASE','GDEF','GPOS','GSUB','EBSC','JSTF','MATH','CBDT','CBLC','COLR','CPAL','SVG ','sbix','acnt','avar','bdat','bloc','bsln','cvar','fdsc','feat','fmtx','fvar','gvar','hsty','just','lcar','mort','morx','opbd','prop','trak','Zapf','Silf','Glat','Gloc','Feat','Sill'];
const textDecoder=new TextDecoder('latin1');

function readTag(bytes,offset){return String.fromCharCode(bytes[offset],bytes[offset+1],bytes[offset+2],bytes[offset+3])}
function writeTag(bytes,offset,tag){for(let i=0;i<4;i++)bytes[offset+i]=tag.charCodeAt(i)}
function u32be(bytes,offset,value){new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setUint32(offset,value>>>0,false)}
function u16be(bytes,offset,value){new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setUint16(offset,value,false)}
function readU32(bytes,offset){return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,false)}
function readU16(bytes,offset){return new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint16(offset,false)}
function align4(n){return (n+3)&~3}
function concatBytes(parts,total){const out=new Uint8Array(total??parts.reduce((s,p)=>s+p.length,0));let o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
function packBase128(n){if(!Number.isInteger(n)||n<0||n>0xffffffff)throw new Error('Invalid UIntBase128 value');let size=1;while(n >= 2**(7*size)&&size<5)size++;const out=new Uint8Array(size);for(let i=0;i<size;i++){let b=Math.floor(n/2**(7*(size-i-1)))&0x7f;if(i<size-1)b|=0x80;out[i]=b}return out}
function checksum(bytes){let sum=0;for(let i=0;i<align4(bytes.length);i+=4){const a=i<bytes.length?bytes[i]:0,b=i+1<bytes.length?bytes[i+1]:0,c=i+2<bytes.length?bytes[i+2]:0,d=i+3<bytes.length?bytes[i+3]:0;sum=(sum+(((a<<24)>>>0)|(b<<16)|(c<<8)|d))>>>0}return sum>>>0}
function tableChecksum(tag,data){if(tag!=='head')return checksum(data);const copy=data.slice();if(copy.length>=12)copy.fill(0,8,12);return checksum(copy)}
function calcSearchParams(numTables){const entrySelector=Math.floor(Math.log2(Math.max(1,numTables)));const searchRange=(2**entrySelector)*16;return{searchRange,entrySelector,rangeShift:numTables*16-searchRange}}

function parseSfnt(bytes){
  if(bytes.length<12)throw new Error('Subset font is too small');
  const flavor=bytes.slice(0,4),numTables=readU16(bytes,4);
  if(!numTables||12+numTables*16>bytes.length)throw new Error('Invalid subset table directory');
  const tables=[];
  for(let i=0;i<numTables;i++){
    const p=12+i*16,tag=readTag(bytes,p),offset=readU32(bytes,p+8),length=readU32(bytes,p+12);
    if(offset+length>bytes.length)throw new Error(`Invalid ${tag} table range`);
    if(tag==='DSIG')continue;
    tables.push({tag,data:bytes.slice(offset,offset+length)});
  }
  if(!tables.some(t=>t.tag==='head'))throw new Error('Subset font is missing head table');
  return{flavor,tables};
}

function prepareTablesForWoff2(sfntBytes){
  const {flavor,tables}=parseSfnt(sfntBytes);
  tables.sort((a,b)=>a.tag.localeCompare(b.tag,'en',{sensitivity:'variant'}));
  const head=tables.find(t=>t.tag==='head');
  if(head.data.length<20)throw new Error('Invalid head table');
  head.data=head.data.slice();
  const headView=new DataView(head.data.buffer,head.data.byteOffset,head.data.byteLength);
  headView.setUint16(16,headView.getUint16(16,false)|(1<<11),false); // lossless transform flag
  head.data.fill(0,8,12);
  const numTables=tables.length,{searchRange,entrySelector,rangeShift}=calcSearchParams(numTables);
  let sfntOffset=12+16*numTables;
  for(const table of tables){table.origOffset=sfntOffset;table.origLength=table.data.length;table.checkSum=tableChecksum(table.tag,table.data);sfntOffset+=align4(table.origLength)}
  const totalSfntSize=sfntOffset;
  const directory=new Uint8Array(12+16*numTables);
  directory.set(flavor,0);u16be(directory,4,numTables);u16be(directory,6,searchRange);u16be(directory,8,entrySelector);u16be(directory,10,rangeShift);
  tables.forEach((table,i)=>{const p=12+i*16;writeTag(directory,p,table.tag);u32be(directory,p+4,table.checkSum);u32be(directory,p+8,table.origOffset);u32be(directory,p+12,table.origLength)});
  let master=checksum(directory);for(const table of tables)master=(master+table.checkSum)>>>0;
  const adjustment=(0xB1B0AFBA-master)>>>0;u32be(head.data,8,adjustment);
  const revision=head.data.slice(4,8);
  return{flavor,tables,totalSfntSize,revision};
}

function encodeWoff2(sfntBytes,quality=9){
  if(typeof BK_BROTLI_COMPRESS!=='function')throw new Error('Brotli runtime is unavailable');
  const {flavor,tables,totalSfntSize,revision}=prepareTablesForWoff2(sfntBytes);
  const dirParts=[];const rawParts=[];
  for(const table of tables){
    const known=WOFF2_TAGS.indexOf(table.tag),idx=known>=0?known:63;
    const flag=idx|((table.tag==='glyf'||table.tag==='loca')?0xC0:0);
    dirParts.push(Uint8Array.of(flag));
    if(idx===63){const tagBytes=new Uint8Array(4);writeTag(tagBytes,0,table.tag);dirParts.push(tagBytes)}
    dirParts.push(packBase128(table.origLength));rawParts.push(table.data);
  }
  const raw=concatBytes(rawParts);const compressed=BK_BROTLI_COMPRESS(raw,{mode:2,quality,lgwin:22});
  if(!compressed||!compressed.length)throw new Error('Brotli compression failed');
  const directory=concatBytes(dirParts),unpaddedLength=48+directory.length+compressed.length,totalLength=align4(unpaddedLength);
  const out=new Uint8Array(totalLength),view=new DataView(out.buffer);
  writeTag(out,0,'wOF2');out.set(flavor,4);view.setUint32(8,totalLength,false);view.setUint16(12,tables.length,false);view.setUint16(14,0,false);view.setUint32(16,totalSfntSize,false);view.setUint32(20,compressed.length,false);view.setUint16(24,(revision[0]<<8)|revision[1],false);view.setUint16(26,(revision[2]<<8)|revision[3],false); // metadata/private fields remain zero
  out.set(directory,48);out.set(compressed,48+directory.length);
  return out;
}

let brotliReady=false;
async function waitForBrotli(){
  if(brotliReady)return;
  if(typeof BK_BROTLI_COMPRESS!=='function')throw new Error('Brotli runtime is unavailable');
  let lastError=null;
  for(let i=0;i<32;i++){
    try{
      const probe=BK_BROTLI_COMPRESS(new TextEncoder().encode('Browser Kitty Brotli runtime probe'),{mode:2,quality:1,lgwin:10});
      if(probe&&probe.length){brotliReady=true;return;}
    }catch(error){lastError=error;}
    await new Promise(resolve=>setTimeout(resolve,0));
  }
  throw lastError||new Error('Brotli runtime did not initialize');
}

async function processSubset(fontBuffer,text,hbWasmBuffer){
  const started=performance.now();
  await initHarfBuzz(hbWasmBuffer);
  await waitForBrotli();
  const subset=subsetSfnt(new Uint8Array(fontBuffer),text);
  const subsetMs=performance.now()-started;
  const woffStart=performance.now();
  const woff2=encodeWoff2(subset.bytes,9);
  return{woff2,subsetSize:subset.bytes.length,codepointCount:subset.codepoints.length,subsetMs,woff2Ms:performance.now()-woffStart,totalMs:performance.now()-started};
}

if(typeof self!=='undefined'&&typeof self.postMessage==='function'){
  self.onmessage=async event=>{
    const msg=event.data||{};if(msg.type!=='subset')return;
    try{
      self.postMessage({type:'progress',stage:'subset',value:.18});
      const result=await processSubset(msg.fontBuffer,msg.text,msg.hbWasmBuffer);
      self.postMessage({type:'progress',stage:'verify',value:.92});
      self.postMessage({type:'result',requestId:msg.requestId,buffer:result.woff2.buffer,stats:{subsetSize:result.subsetSize,codepointCount:result.codepointCount,subsetMs:result.subsetMs,woff2Ms:result.woff2Ms,totalMs:result.totalMs}},[result.woff2.buffer]);
    }catch(error){self.postMessage({type:'error',requestId:msg.requestId,message:error instanceof Error?error.message:String(error)})}
  };
}
