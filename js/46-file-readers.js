/* EducMind · js/46-file-readers.js
   Bộ đọc tệp .xlsx / .docx / .csv chạy ngay trong trang (dùng khi không tải được thư viện). */
/* --- Bộ đọc tệp văn phòng tối giản, chạy ngay trên trang, không cần mạng ---
   Chỉ dùng khi chưa tải được XLSX/mammoth từ CDN: tự giải nén .xlsx/.docx và đọc bảng dữ liệu. */
const colIdx=ref=>{const m=/^([A-Z]+)/.exec(String(ref||''));if(!m)return 0;let n=0;for(const ch of m[1])n=n*26+(ch.charCodeAt(0)-64);return n-1};
const xdec=s=>String(s==null?'':s).replace(/<[^>]+>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(m,d)=>String.fromCharCode(+d)).replace(/&amp;/g,'&');
const xjoin=s=>{const src=String(s==null?'':s);return src.split(/<\/(?:w:)?p>|<w:br\s*\/?>|<w:tab\s*\/?>/).map(seg=>{let t='';seg.replace(/<(?:w:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:w:)?t>/g,(m,g)=>{t+=g;return m});return xdec(t).trim()}).filter(Boolean).join(' ').replace(/\s+/g,' ').trim()};
async function inflateRaw(u8){
  if(typeof DecompressionStream!=='undefined'&&typeof Response!=='undefined'&&typeof Blob==='function'&&Blob.prototype.stream){
    try{const ab=await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer();return new Uint8Array(ab)}catch(e){}
  }
  return inflateJs(u8);
}
/* giải nén DEFLATE thuần JS: dùng khi trình duyệt không có DecompressionStream */
function inflateJs(u8){
  const out=[];let p=0,bitPos=0,bitBuf=0;
  const need=n=>{while(bitPos<n){if(p>=u8.length)throw new Error('Tệp nén bị cắt ngắn.');bitBuf|=u8[p++]<<bitPos;bitPos+=8}};
  const bits=n=>{need(n);const v=bitBuf&((1<<n)-1);bitBuf>>>=n;bitPos-=n;return v};
  const build=len=>{
    const cnt=new Array(16).fill(0),nxt=new Array(16).fill(0),codes=new Map();
    for(let i=0;i<len.length;i++)if(len[i])cnt[len[i]]++;
    cnt[0]=0;let code=0;
    for(let b=1;b<16;b++){code=(code+cnt[b-1])<<1;nxt[b]=code}
    for(let n=0;n<len.length;n++){const l=len[n];if(l){codes.set((l<<16)|nxt[l],n);nxt[l]++}}
    return codes;
  };
  const decode=codes=>{let c=0;for(let l=1;l<16;l++){c=(c<<1)|bits(1);const v=codes.get((l<<16)|c);if(v!==undefined)return v}throw new Error('Tệp nén bị hỏng.')};
  const LB=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LE=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DB=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DE=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const CO=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  for(;;){
    const last=bits(1),type=bits(2);
    if(type===0){bitBuf=0;bitPos=0;const len=u8[p]|(u8[p+1]<<8);p+=4;for(let i=0;i<len;i++)out.push(u8[p++])}
    else if(type===1||type===2){
      let lit,dist;
      if(type===1){
        const l=new Array(288).fill(8);for(let i=144;i<256;i++)l[i]=9;for(let i=256;i<280;i++)l[i]=7;for(let i=280;i<288;i++)l[i]=8;
        lit=build(l);dist=build(new Array(30).fill(5));
      }else{
        const hlit=bits(5)+257,hdist=bits(5)+1,hclen=bits(4)+4,cl=new Array(19).fill(0);
        for(let i=0;i<hclen;i++)cl[CO[i]]=bits(3);
        const ch=build(cl),len=[];
        while(len.length<hlit+hdist){
          const s=decode(ch);
          if(s<16)len.push(s);
          else if(s===16){const r=bits(2)+3,v=len[len.length-1]||0;for(let i=0;i<r;i++)len.push(v)}
          else if(s===17){const r=bits(3)+3;for(let i=0;i<r;i++)len.push(0)}
          else{const r=bits(7)+11;for(let i=0;i<r;i++)len.push(0)}
        }
        lit=build(len.slice(0,hlit));dist=build(len.slice(hlit));
      }
      for(;;){
        const s=decode(lit);
        if(s<256)out.push(s);
        else if(s===256)break;
        else{
          const i=s-257;if(i>=LB.length)throw new Error('Tệp nén bị hỏng.');
          const n=LB[i]+bits(LE[i]),ds=decode(dist),d=DB[ds]+bits(DE[ds]);
          if(d>out.length)throw new Error('Tệp nén bị hỏng.');
          for(let k=0;k<n;k++)out.push(out[out.length-d]);
        }
      }
    }else throw new Error('Tệp nén dùng thuật toán không hỗ trợ.');
    if(last)break;
  }
  return new Uint8Array(out);
}
async function unzipBuf(buf){
  const b=buf instanceof Uint8Array?buf:new Uint8Array(buf),dv=new DataView(b.buffer,b.byteOffset,b.byteLength),out=new Map();
  let e=-1;for(let i=b.length-22;i>=Math.max(0,b.length-66000);i--){if(dv.getUint32(i,true)===0x06054b50){e=i;break}}
  if(e<0)throw new Error('Tệp không đúng định dạng Office: không đọc được cấu trúc nén.');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);
  for(let k=0;k<n;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const meth=dv.getUint16(p+10,true),csz=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
    const name=new TextDecoder().decode(b.subarray(p+46,p+46+nl));
    const lnl=dv.getUint16(lo+26,true),lel=dv.getUint16(lo+28,true),st=lo+30+lnl+lel;
    const raw=b.subarray(st,st+csz);
    out.set(name,meth===0?raw:await inflateRaw(raw));
    p+=46+nl+el+cl;
  }
  if(!out.size)throw new Error('Tệp Office không có phần dữ liệu nào đọc được.');
  return out;
}
function csvRows(text){
  const s=String(text).replace(/^\ufeff/,''),first=(s.split(/\r?\n/)[0]||'');
  const d=first.indexOf(',')>=0?',':(first.indexOf(';')>=0?';':(first.indexOf('\t')>=0?'\t':','));
  const rows=[];let r=[],cur='',q=false;
  for(let i=0;i<s.length;i++){const ch=s[i];
    if(q){if(ch==='"'){if(s[i+1]==='"'){cur+='"';i++}else q=false}else cur+=ch}
    else if(ch==='"')q=true;
    else if(ch===d){r.push(cur);cur=''}
    else if(ch==='\n'){r.push(cur);rows.push(r);r=[];cur=''}
    else if(ch!=='\r')cur+=ch}
  if(cur!==''||r.length){r.push(cur);rows.push(r)}
  return rows.filter(x=>x.some(v=>String(v).trim()!=='')).map(x=>x.map(v=>String(v).trim()));
}
function xlsxRows(z){
  const td=new TextDecoder(),sst=[];
  const ss=z.get('xl/sharedStrings.xml');
  if(ss)String(td.decode(ss)).replace(/<si>([\s\S]*?)<\/si>/g,(m,si)=>{sst.push(xjoin(si));return m});
  const keys=[...z.keys()];
  let nm='';
  try{
    const wb=z.get('xl/workbook.xml')?String(td.decode(z.get('xl/workbook.xml'))):'';
    const rel=z.get('xl/_rels/workbook.xml.rels')?String(td.decode(z.get('xl/_rels/workbook.xml.rels'))):'';
    const first=/<sheet\b[^>]*r:id="([^"]+)"/.exec(wb);
    if(first&&rel){
      const relRe=new RegExp('<Relationship\\b[^>]*Id="'+first[1]+'"[^>]*Target="([^"]+)"');
      const hit=relRe.exec(rel)||new RegExp('<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="'+first[1]+'"').exec(rel);
      if(hit){const t=hit[1].replace(/^\//,'');nm=z.has(t)?t:('xl/'+t.replace(/^\.\//,''))}
    }
  }catch(e){}
  if(!nm||!z.has(nm))nm=keys.find(k=>k==='xl/worksheets/sheet1.xml')||keys.find(k=>/^xl\/worksheets\/[^/]+\.xml$/.test(k));
  if(!nm)throw new Error('Không thấy trang tính nào trong tệp Excel.');
  const rows=[];
  String(td.decode(z.get(nm))).replace(/<row([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g,(m,at,body)=>{
    const cells=[];
    String(body==null?'':body).replace(/<c([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,(mm,cat,cb)=>{
      const ci=colIdx((/\sr="([A-Z]+)\d+"/.exec(cat||'')||['',''])[1]),t=(/\st="([^"]+)"/.exec(cat||'')||['',''])[1];
      let v='';
      if(t==='inlineStr')v=xjoin((/<is>([\s\S]*?)<\/is>/.exec(cb||'')||['',''])[1]);
      else{const raw=(/<v>([\s\S]*?)<\/v>/.exec(cb||'')||['',''])[1];v=t==='s'?(sst[+raw]==null?'':sst[+raw]):xdec(raw)}
      while(cells.length<ci)cells.push('');
      cells[ci]=v==null?'':String(v);
      return mm});
    rows.push(cells);return m});
  if(!rows.length)throw new Error('Trang tính không có dòng dữ liệu nào.');
  return rows;
}
function docxRows(z){
  const d=z.get('word/document.xml');if(!d)throw new Error('Tệp Word không đúng định dạng .docx.');
  let x=new TextDecoder().decode(d),rows=[];
  const tb=/<w:tbl(?:\s[^>]*)?>([\s\S]*?)<\/w:tbl>/.exec(x);   /* chỉ lấy bảng đầu tiên */
  if(tb)x=tb[1];
  x.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g,(m,tr)=>{
    const cells=[];
    tr.replace(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g,(mm,tc)=>{cells.push(xjoin(tc));return mm});
    rows.push(cells);return m});
  if(!rows.length)throw new Error('Tệp Word cần chứa một bảng theo đúng các cột mẫu.');
  return rows;
}
async function readRows(f){
  const ext=(f.name.split('.').pop()||'').toLowerCase(),buf=await f.arrayBuffer();
  if(ext==='xlsx'||ext==='xls'||ext==='csv'){
    if(typeof XLSX!=='undefined'){
      const wb=ext==='csv'?XLSX.read(new TextDecoder('utf-8').decode(buf),{type:'string'}):XLSX.read(buf,{type:'array'});
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:false});
    }
    if(ext==='csv')return csvRows(new TextDecoder('utf-8').decode(buf));
    if(ext==='xlsx')return xlsxRows(await unzipBuf(buf));
    throw new Error('Không đọc được tệp .xls khi trang chạy không có mạng. Hãy lưu lại thành .xlsx hoặc .csv rồi tải lên.');
  }
  if(ext==='docx'){
    if(typeof mammoth!=='undefined'){
      const r=await mammoth.convertToHtml({arrayBuffer:buf}),t=new DOMParser().parseFromString(r.value,'text/html').querySelector('table');
      if(!t)throw new Error('Tệp Word cần chứa một bảng theo đúng các cột mẫu.');
      const cellText=td=>{const parts=[...td.childNodes].map(n=>String(n.textContent||'').trim()).filter(Boolean);return (parts.length?parts.join(' '):String(td.textContent||'')).replace(/\s+/g,' ').trim()};
      return [...t.rows].map(tr=>[...tr.cells].map(cellText));
    }
    return docxRows(await unzipBuf(buf));
  }
  throw new Error('Chỉ nhận tệp .xlsx, .xls, .csv hoặc .docx.');
}
