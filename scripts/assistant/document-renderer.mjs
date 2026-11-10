import {readFile} from 'node:fs/promises';
import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {zipSync,strToU8} from 'fflate';
const ns='http://schemas.openxmlformats.org';
// eslint-disable-next-line no-control-regex -- XML 1.0 excludes these control characters.
const xmlText=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const declaration='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const zip=entries=>Buffer.from(zipSync(Object.fromEntries(Object.entries(entries).map(([name,value])=>[name,strToU8(declaration+value)])),{level:6,mtime:new Date('2000-01-01T00:00:00Z')}));
const cell=value=>value===null?'':String(value);
const safeCsv=value=>{const valueText=cell(value);return '"'+(typeof value==='string'&&/^[\s\uFEFF]*[=+\-@\t\r]/u.test(valueText)?"'"+valueText:valueText).replaceAll('"','""')+'"';};
function column(index){let out='';for(let n=index+1;n;n=Math.floor((n-1)/26))out=String.fromCharCode(65+(n-1)%26)+out;return out;}
function validate(input){
 if(!['pdf','docx','csv','xlsx'].includes(input.format)||typeof input.title!=='string'||!input.title.trim()||input.title.length>160||typeof input.body!=='string'||input.body.length>30000||!Array.isArray(input.columns)||input.columns.length>12||input.columns.some(x=>typeof x!=='string'||x.length>150)||!Array.isArray(input.rows)||input.rows.length>500||input.rows.some(r=>!Array.isArray(r)||r.length!==input.columns.length||r.some(v=>!['string','number'].includes(typeof v)&&v!==null||typeof v==='number'&&!Number.isFinite(v)||String(v).length>2000))||!Array.isArray(input.sources)||input.sources.some(s=>typeof s!=='string'||s.length>500)||input.sources.length>20)throw Error('The document content exceeds the supported output limits.');
 if(['csv','xlsx'].includes(input.format)&&!input.columns.length)throw Error('Provide column headings for the exported table.');
 if(JSON.stringify(input).length>150000)throw Error('The generated document is too large.');
}
async function pdf(input){
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);doc.setTitle(input.title);doc.setAuthor('Tailored Agents');doc.setSubject('Employee assistant work');const created=new Date(input.createdAt??'2000-01-01T00:00:00Z');if(!Number.isFinite(created.valueOf()))throw Error('Invalid document creation date.');doc.setCreationDate(created);doc.setModificationDate(created);
 const font=await doc.embedFont(await readFile(new URL('../../assets/assistant/NotoSans-Regular.ttf',import.meta.url)),{subset:true}),glyphs=new Set(font.getCharacterSet());
 const all=[input.title,input.body,...input.columns,...input.rows.flat().map(cell),...input.sources].join('\n');
 if([...all].some(c=>!['\r','\n','\t'].includes(c)&&!glyphs.has(c.codePointAt(0))))throw Error('This PDF font cannot display some characters. Export DOCX to preserve them.');
 let page,y=0;const width=612,height=792,margin=48,usable=width-margin*2;
 function next(){if(doc.getPageCount()>=100)throw Error('The generated PDF exceeds 100 pages.');page=doc.addPage([width,height]);y=height-margin;page.drawText('TAILORED AGENTS',{x:margin,y,font,size:9,color:rgb(.25,.32,.43)});y-=32;}
 function lines(value,size,maxWidth){
  const result=[];for(const paragraph of String(value).replaceAll('\t','    ').split(/\r?\n/)){let line='';for(const token of paragraph.split(/(\s+)/)){if(font.widthOfTextAtSize(line+token,size)<=maxWidth){line+=token;continue;}if(line.trim())result.push(line.trimEnd());line='';for(const c of token){if(font.widthOfTextAtSize(line+c,size)>maxWidth&&line){result.push(line);line='';}line+=c;}}result.push(line.trimEnd());}return result;
 }
 function paragraph(value,size=11,color=rgb(.10,.14,.21)){for(const line of lines(value,size,usable)){if(y<margin+35)next();page.drawText(line,{x:margin,y,font,size,color});y-=size*1.5;}y-=8;}
 next();paragraph(input.title,22);if(input.body)paragraph(input.body);
 if(input.columns.length){
  const cellWidth=usable/input.columns.length,size=input.columns.length>6?7:9;
  const row=(values,header=false)=>{
   const wrapped=values.map(v=>lines(cell(v),size,cellWidth-12)),lineCount=Math.max(...wrapped.map(v=>v.length)),rowHeight=lineCount*(size+4)+12;
   if(rowHeight>height-180)throw Error('A table row is too tall for the PDF. Shorten its text or export DOCX.');
   if(y-rowHeight<margin+25){next();if(!header)row(input.columns,true);if(y-rowHeight<margin+25)throw Error('This table row is too tall. Shorten it or export DOCX.');}
   for(let j=0;j<values.length;j++){const x=margin+j*cellWidth;page.drawRectangle({x,y:y-rowHeight,width:cellWidth,height:rowHeight,color:header?rgb(.90,.94,.98):rgb(1,1,1),borderColor:rgb(.80,.84,.89),borderWidth:.5});wrapped[j].forEach((line,i)=>page.drawText(line,{x:x+6,y:y-12-i*(size+4),font,size,color:rgb(.10,.14,.21)}));}y-=rowHeight;
  };
  row(input.columns,true);for(const values of input.rows)row(values);y-=20;
 }
 if(input.sources.length){paragraph('Sources',13);input.sources.forEach(source=>paragraph(source,9));}
 const count=doc.getPageCount();doc.getPages().forEach((p,i)=>p.drawText(`${i+1} / ${count}`,{x:width-margin-35,y:25,font,size:8,color:rgb(.4,.45,.5)}));return Buffer.from(await doc.save());
}
function docx(input){
 const run=(value,bold=false)=>`<w:r>${bold?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${xmlText(value)}</w:t></w:r>`;
 const p=(value,style='Normal')=>`<w:p><w:pPr><w:pStyle w:val="${style}"/></w:pPr>${run(value)}</w:p>`;
 const table=input.columns.length?`<w:tbl><w:tblPr><w:tblW w:w="9360" w:type="dxa"/><w:tblBorders>${['top','left','bottom','right','insideH','insideV'].map(k=>`<w:${k} w:val="single" w:sz="4" w:color="CBD5E1"/>`).join('')}</w:tblBorders></w:tblPr><w:tblGrid>${input.columns.map(()=>`<w:gridCol w:w="${Math.floor(9360/input.columns.length)}"/>`).join('')}</w:tblGrid>${[input.columns,...input.rows].map((r,i)=>`<w:tr>${i===0?'<w:trPr><w:tblHeader/></w:trPr>':''}${r.map(v=>`<w:tc><w:tcPr><w:tcW w:w="${Math.floor(9360/input.columns.length)}" w:type="dxa"/>${i===0?'<w:shd w:fill="E6EFF9"/>':''}</w:tcPr><w:p>${run(cell(v),i===0)}</w:p></w:tc>`).join('')}</w:tr>`).join('')}</w:tbl>`:'';
 return zip({
  '[Content_Types].xml':`<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
  '_rels/.rels':`<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
  'word/_rels/document.xml.rels':`<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  'word/styles.xml':`<w:styles xmlns:w="${ns}/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style></w:styles>`,
  'word/document.xml':`<w:document xmlns:w="${ns}/wordprocessingml/2006/main"><w:body>${p(input.title,'Title')}${input.body.split(/\r?\n/).map(v=>p(v)).join('')}${table}${input.sources.length?p('Sources','Heading1')+input.sources.map(v=>p(v)).join(''):''}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1080" w:right="1440" w:bottom="1080" w:left="1440"/></w:sectPr></w:body></w:document>`,
 });
}
function xlsx(input){
 const sheet=(rows)=>`<worksheet xmlns="${ns}/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="12" width="24" customWidth="1"/></cols><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>`<c r="${column(j)}${i+1}"${typeof v==='number'?'':' t="inlineStr"'}>${typeof v==='number'?`<v>${v}</v>`:`<is><t xml:space="preserve">${xmlText(cell(v))}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
 const sheets=[{name:'Results',rows:[input.columns,...input.rows]},{name:'Notes and sources',rows:[['Title',input.title],...Array.from({length:Math.ceil(input.body.length/6000)},(_,i)=>['Notes',input.body.slice(i*6000,(i+1)*6000)]),...input.sources.map(s=>['Source',s])]}];
 return zip({
  '[Content_Types].xml':`<Types xmlns="${ns}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
  '_rels/.rels':`<Relationships xmlns="${ns}/package/2006/relationships"><Relationship Id="rId1" Type="${ns}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':`<workbook xmlns="${ns}/spreadsheetml/2006/main" xmlns:r="${ns}/officeDocument/2006/relationships"><sheets>${sheets.map((s,i)=>`<sheet name="${s.name}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${ns}/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="${ns}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}</Relationships>`,
  ...Object.fromEntries(sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,sheet(s.rows)])),
 });
}
export async function renderDocument(input){
 validate(input);const bytes=input.format==='pdf'?await pdf(input):input.format==='docx'?docx(input):input.format==='xlsx'?xlsx(input):Buffer.from('\uFEFF'+[input.columns,...input.rows].map(row=>row.map(safeCsv).join(',')).join('\r\n')+'\r\n');
 if(bytes.length>10_000_000)throw Error('The generated file exceeds 10 MB.');return bytes;
}
