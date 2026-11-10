// Data-only parsers: no uploaded code, XML entities, macros or remote resources.
import {fromBuffer} from 'yauzl';
import {SaxesParser} from 'saxes';
import sharp from 'sharp';
export const LIMITS={fileBytes:10_000_000,expandedBytes:32_000_000,entryBytes:12_000_000,entries:400,pages:100,cells:50000,rows:10000,text:1_000_000,chunks:12000,pixels:16_000_000};
const utf8=new TextDecoder('utf-8',{fatal:true});
const fail=(message)=>{throw new Error(message);};
// eslint-disable-next-line no-control-regex -- Reject binary/control content in text documents.
function text(bytes){const value=utf8.decode(bytes);if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))fail('This file contains unsupported binary or control characters.');return value.replace(/^\uFEFF/,'');}
function collector(){const chunks=[];let length=0;return {chunks,add(location,value){value=value.trim();if(!value)return;length+=value.length;if(length>LIMITS.text)fail('The document exceeds the one-million-character extraction limit. Split it into smaller files.');for(let offset=0;offset<value.length;offset+=6000){if(chunks.length>=LIMITS.chunks)fail('The document has too many sections.');chunks.push({key:'c'+(chunks.length+1),location:location+(value.length>6000?` (part ${Math.floor(offset/6000)+1})`:''),text:value.slice(offset,offset+6000)});}}};}
export function xml(value,handlers={}){
 if(value.length>LIMITS.entryBytes||/<!DOCTYPE|<!ENTITY/i.test(value))fail('XML declarations and custom entities are not supported.');
 const parser=new SaxesParser({xmlns:true});let depth=0,nodes=0;
 parser.on('doctype',()=>fail('XML declarations are not supported.'));parser.on('error',()=>fail('The document contains malformed XML.'));
 parser.on('opentag',tag=>{if(++depth>50||++nodes>250000)fail('The document structure is too complex.');handlers.open?.(tag);});
 parser.on('closetag',tag=>{handlers.close?.(tag);depth--;});parser.on('text',v=>handlers.text?.(v));parser.on('cdata',v=>handlers.text?.(v));parser.write(value).close();
}
const attr=(tag,name)=>Object.values(tag.attributes).find(a=>a.local===name)?.value;
export async function archive(bytes){
 return new Promise((resolve,reject)=>fromBuffer(Buffer.from(bytes),{lazyEntries:true,validateEntrySizes:true,strictFileNames:true},(error,zip)=>{
  if(error){reject(Error('This Office file is damaged or password-protected.'));return;}
  const entries=new Map();let count=0,total=0,ended=false;
  const stop=error=>{if(ended)return;ended=true;zip.close();reject(error);};zip.on('error',()=>stop(Error('The Office archive is invalid.')));zip.on('end',()=>{if(!ended){ended=true;resolve(entries);}});
  zip.on('entry',entry=>{
   if(ended)return;
   if(++count>LIMITS.entries||entry.uncompressedSize>LIMITS.entryBytes||(total+=entry.uncompressedSize)>LIMITS.expandedBytes||entry.uncompressedSize>Math.max(1000000,entry.compressedSize*200)||entry.isEncrypted()||entry.fileName.length>300||entries.has(entry.fileName)||/vbaProject|activeX|embeddings\//i.test(entry.fileName)){stop(Error('This Office archive exceeds the limits or contains unsupported active content.'));return;}
   if(entry.fileName.endsWith('/')){zip.readEntry();return;}
   zip.openReadStream(entry,(error,stream)=>{
    if(error){stop(Error('The Office archive could not be read.'));return;}
    const buffers=[];let size=0;stream.on('error',()=>stop(Error('The Office archive is corrupt.')));stream.on('data',chunk=>{size+=chunk.length;if(size>LIMITS.entryBytes||size>entry.uncompressedSize){stream.destroy();stop(Error('The Office archive expands beyond its declared size.'));return;}buffers.push(chunk);});stream.on('end',()=>{if(ended)return;entries.set(entry.fileName,Buffer.concat(buffers));zip.readEntry();});
   });
  });zip.readEntry();
 }));
}
function officeXML(entries,path){const bytes=entries.get(path);if(!bytes)fail('A required Office document part is missing.');return text(bytes);}
export function parseCsv(value){
 const rows=[];let row=[],cell='',quoted=false,closed=false,cells=0;
 function field(){if(cell.length>20000||++cells>LIMITS.cells)fail('The spreadsheet exceeds the cell limit.');row.push(cell);cell='';closed=false;}
 function record(){field();if(rows.length>=LIMITS.rows)fail('The spreadsheet exceeds 10,000 rows.');rows.push(row);row=[];}
 for(let i=0;i<value.length;i++){
  const c=value[i];if(quoted){if(c==='"'){if(value[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=c;}
  else if(c==='"'&&!cell&&!closed)quoted=true;
  else if(c===',')field();else if(c==='\n'||c==='\r'){if(c==='\r'&&value[i+1]==='\n')i++;record();}
  else {if(closed||c==='"')fail('The CSV quoting is malformed.');cell+=c;}
  if(cell.length>20000)fail('A spreadsheet cell exceeds 20,000 characters.');
 }
 if(quoted)fail('The CSV has an unclosed quoted field.');if(cell||row.length||closed)record();return rows;
}
function column(index){let out='';for(let n=index+1;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;}
async function spreadsheet(entries,out,warnings){
 const strings=[];let current='',inItem=false,inText=false;
 if(entries.has('xl/sharedStrings.xml'))xml(officeXML(entries,'xl/sharedStrings.xml'),{open:t=>{if(t.local==='si'){inItem=true;current='';}if(t.local==='t')inText=true;},text:v=>{if(inItem&&inText)current+=v;},close:t=>{if(t.local==='t')inText=false;if(t.local==='si'){if(strings.length>LIMITS.cells||current.length>20000)fail('The spreadsheet string table exceeds the limits.');strings.push(current);inItem=false;}}});
 const relations=new Map();xml(officeXML(entries,'xl/_rels/workbook.xml.rels'),{open:t=>{if(t.local==='Relationship'&&attr(t,'TargetMode')!=='External')relations.set(attr(t,'Id'),attr(t,'Target'));}});
 const sheets=[];let date1904=false;xml(officeXML(entries,'xl/workbook.xml'),{open:t=>{if(t.local==='workbookPr')date1904=['1','true'].includes(attr(t,'date1904'));if(t.local==='sheet')sheets.push({name:attr(t,'name'),id:attr(t,'id'),hidden:attr(t,'state')==='hidden'||attr(t,'state')==='veryHidden'});}});
 if(!sheets.length||sheets.length>20)fail('Use an XLSX workbook with 1–20 worksheets.');
 const formats=new Map([[14,'date'],[15,'date'],[16,'date'],[17,'date'],[18,'time'],[19,'time'],[20,'time'],[21,'time'],[22,'date-time'],[45,'time'],[46,'duration'],[47,'time']]),styles=[];let inStyles=false;
 if(entries.has('xl/styles.xml'))xml(officeXML(entries,'xl/styles.xml'),{open:t=>{if(t.local==='numFmt')formats.set(Number(attr(t,'numFmtId')),attr(t,'formatCode'));if(t.local==='cellXfs')inStyles=true;else if(t.local==='xf'&&inStyles)styles.push(Number(attr(t,'numFmtId')));},close:t=>{if(t.local==='cellXfs')inStyles=false;}});
 let cells=0,rows=0,formulas=0;
 for(const sheet of sheets){
  let path=relations.get(sheet.id);if(!path||/[:\\]|\.\./.test(path))fail('External or invalid worksheet targets are not supported.');path=path.startsWith('/')?path.slice(1):'xl/'+path.replace(/^\.\//,'');
  if(!/^xl\/worksheets\/[a-zA-Z0-9_.-]+\.xml$/.test(path))fail('This worksheet target is unsupported.');
  let cell=null,inside='',line=[],rowIndex=0;
  xml(officeXML(entries,path),{open:t=>{
   if(t.local==='row'){if(++rows>LIMITS.rows)fail('The workbook exceeds 10,000 rows.');rowIndex=Number(attr(t,'r'));line=[];}
   if(t.local==='c'){if(++cells>LIMITS.cells)fail('The workbook exceeds 50,000 cells.');const reference=attr(t,'r');if(!/^[A-Z]{1,3}[1-9]\d{0,6}$/.test(reference??''))fail('A worksheet cell reference is invalid.');cell={ref:reference,type:attr(t,'t'),style:Number(attr(t,'s')??0),value:'',formula:false};}
   if(cell&&['v','t','f'].includes(t.local)){inside=t.local;if(t.local==='f'){cell.formula=true;formulas++;}}
  },text:v=>{if(cell&&['v','t'].includes(inside)){cell.value+=v;if(cell.value.length>20000)fail('A cell exceeds 20,000 characters.');}},close:t=>{
   if(['v','t','f'].includes(t.local))inside='';
   if(t.local==='c'&&cell){let value=cell.value;
    if(cell.type==='s'){if(!/^\d+$/.test(value)||strings[Number(value)]===undefined)fail('A shared string reference is invalid.');value=strings[Number(value)];}
    if(cell.type==='b')value=value==='1'?'TRUE':value==='0'?'FALSE':value;
    const format=formats.get(styles[cell.style]);
    if((!cell.type||cell.type==='n')&&format&&value){
     if(['date','date-time'].includes(format)&&Number.isFinite(Number(value))){const serial=Number(value);if(serial===60&&!date1904)value='1900-02-29 (Excel serial 60)';else{const date=new Date(Date.UTC(date1904?1904:1899,date1904?0:11,date1904?1:30)+serial*86400000+(serial<60&&!date1904?86400000:0));if(Number.isFinite(date.valueOf()))value=format==='date'?date.toISOString().slice(0,10):date.toISOString();}}
     else value+=` [number format: ${format}]`;
    }
    if(cell.formula)value=(value||'[no cached result]')+' [cached formula value]';line.push(cell.ref+'='+value);cell=null;
   }
   if(t.local==='row'&&line.length)out.add(`${sheet.name}${sheet.hidden?' (hidden sheet)':''} · row ${rowIndex}`,line.join(' | '));
  }});
 }
 warnings.push('Values are extracted from every supported worksheet, including hidden sheets. Formatting, charts, drawings and merged-cell layout are not reproduced.');
 if(formulas)warnings.push(`${formulas} formula cells use saved results; formulas and external links were not recalculated.`);
}
async function pdf(bytes){
 const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const loading=getDocument({data:new Uint8Array(bytes),useWorkerFetch:false,useWasm:false,disableFontFace:true,stopAtErrors:true,verbosity:0,maxImageSize:LIMITS.pixels});
 loading.onPassword=()=>{void loading.destroy();};
 try{const doc=await loading.promise;if(doc.numPages>LIMITS.pages){await doc.loadingTask.destroy();fail('The PDF exceeds 100 pages. Split it into smaller files.');}return doc;}catch{fail('This PDF is damaged, password-protected, or exceeds the supported limits.');}
}
export async function documentImage(bytes,extension,page=1){
 if(['png','jpg','jpeg'].includes(extension))return sharp(Buffer.from(bytes),{limitInputPixels:LIMITS.pixels,failOn:'error',pages:1}).rotate().resize({width:768,height:768,fit:'inside',withoutEnlargement:true}).png().toBuffer();
 if(extension!=='pdf'||!Number.isSafeInteger(page)||page<1||page>LIMITS.pages)fail('Choose an image or a valid PDF page.');
 const doc=await pdf(bytes);try{
  if(page>doc.numPages)fail('That PDF page does not exist.');const item=await doc.getPage(page),base=item.getViewport({scale:1});if(!Number.isFinite(base.width+base.height)||base.width<=0||base.height<=0)fail('This PDF page has invalid dimensions.');
  const viewport=item.getViewport({scale:Math.min(768/base.width,768/base.height)}),{createCanvas}=await import('@napi-rs/canvas'),canvas=createCanvas(Math.max(1,Math.ceil(viewport.width)),Math.max(1,Math.ceil(viewport.height)));
  await item.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;return canvas.toBuffer('image/png');
 }finally{await doc.loadingTask.destroy();}
}
export async function parseDocument(bytes,extension){
 if(!bytes.length||bytes.length>LIMITS.fileBytes)fail('Use a nonempty file up to 10 MB.');const out=collector(),warnings=[];let mime='',kind=extension;
 if(['txt','md','csv'].includes(extension)){
  const value=text(bytes);if(/<(?:!doctype\s+html|html|script)\b/i.test(value))fail('HTML and executable content are not supported. Upload plain text instead.');
  if(extension==='csv'){const rows=parseCsv(value);rows.forEach((row,i)=>out.add('Row '+(i+1),row.map((v,j)=>column(j)+(i+1)+'='+v).join(' | ')));mime='text/csv';warnings.push('CSV values are read as text. No formulas are executed.');}
  else {value.split(/\r?\n/).forEach((line,i)=>out.add('Line '+(i+1),line));mime='text/plain';kind='text';}
 }else if(['docx','xlsx'].includes(extension)){
  if(Buffer.from(bytes).subarray(0,4).toString('hex')!=='504b0304')fail('The filename does not match an Office document.');const entries=await archive(bytes);if(/macroEnabled|vbaProject/i.test(officeXML(entries,'[Content_Types].xml')))fail('Macro-enabled Office files are not supported.');
  if(extension==='docx'){
   let paragraph='',inText=false,number=0;xml(officeXML(entries,'word/document.xml'),{open:t=>{if(t.local==='t')inText=true;if(t.local==='tab')paragraph+='\t';if(t.local==='br')paragraph+='\n';},text:v=>{if(inText){paragraph+=v;if(paragraph.length>LIMITS.text)fail('A paragraph is too large.');}},close:t=>{if(t.local==='t')inText=false;if(t.local==='p'){out.add('Paragraph '+(++number),paragraph);paragraph='';}}});
   mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document';warnings.push('Extracted main-body paragraphs and table text. Headers, footnotes, comments, images and layout are not included.');
  }else{await spreadsheet(entries,out,warnings);mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';}
 }else if(extension==='pdf'){
  if(Buffer.from(bytes).subarray(0,5).toString()!=='%PDF-')fail('The filename does not match a PDF.');const doc=await pdf(bytes);let empty=0;
  try{for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent();const value=content.items.filter(x=>'str' in x).map(x=>x.str+(x.hasEOL?'\n':' ')).join('');if(!value.trim())empty++;out.add('Page '+i,value.trim()?value:'No extractable text. Ask for visual reading of this page.');page.cleanup();}}finally{await doc.loadingTask.destroy();}
  mime='application/pdf';warnings.push('PDF reading order can differ from the visual layout. Tables and columns may need visual checking.');if(empty)warnings.push(`${empty} pages have no extractable text. Ask the assistant to inspect a specific page; visual reading uses the shared AI allowance.`);
 }else if(['png','jpg','jpeg'].includes(extension)){
  const raw=Buffer.from(bytes),png=raw.subarray(0,8).toString('hex')==='89504e470d0a1a0a',jpg=raw[0]===255&&raw[1]===216&&raw[2]===255;if(extension==='png'?!png:!jpg)fail('The filename does not match an image.');
  const info=await sharp(raw,{limitInputPixels:LIMITS.pixels,failOn:'error'}).metadata();if(!['png','jpeg'].includes(info.format)||(info.pages??1)>1)fail('Use a still PNG or JPEG image.');await documentImage(bytes,extension);mime=png?'image/png':'image/jpeg';kind='image';warnings.push('Image validated. Ask the assistant to read it; visual reading uses the shared AI allowance.');out.add('Image',`${info.width} × ${info.height} pixels. Text has not been read yet.`);
 }else fail('Supported formats: PDF, DOCX, TXT, Markdown, CSV, XLSX, PNG and JPEG.');
 return {kind,mime,chunks:out.chunks,warnings};
}
