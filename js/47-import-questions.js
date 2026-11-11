/* EducMind · js/47-import-questions.js
   Phân tích câu hỏi từ tệp, xem trước và ghi vào ngân hàng câu hỏi / danh sách học sinh. */
function parseQuestions(c,rows,reuse){
  const hi=rows.findIndex(r=>r.some(x=>nz(x)==='cau hoi'));
  if(hi<0)throw new Error('Không thấy dòng tiêu đề có cột “Câu hỏi”. Hãy dùng đúng tệp mẫu.');
  const H=rows[hi].map(nz),col=k=>H.findIndex(h=>h===k||h.startsWith(k));
  const ci=col('cau hoi'),oi=['a','b','c','d'].map(l=>col('dap an '+l)),ai=col('dap an dung'),gi=col('muc tieu'),di=col('do kho'),bi=H.findIndex(h=>h.includes('bloom'));
  if(ci<0||oi.some(i=>i<0)||ai<0)throw new Error('Thiếu cột bắt buộc: Câu hỏi, Đáp án A–D hoặc Đáp án đúng.');
  const cmAll={};c.lessonsData.forEach(l=>(l.objs||[]).forEach(o=>{const k=String(o.code||'').toUpperCase();(cmAll[k]=cmAll[k]||[]).push(o.idx)}));
  const cm=codeMap(c),DK={'de':'EASY','trung binh':'MEDIUM','kho':'HARD'},seen=new Set(c.bank.filter(q=>!q.del).map(q=>nz(q.content))),items=[],err=[],warn=[],bm=new Map(c.bank.filter(q=>!q.del).map(q=>[nz(q.content),q])),ff=new Set(),wi=H.findIndex(h=>h==='diem'||h.indexOf('diem ')===0);
  rows.slice(hi+1).forEach((r,k)=>{
    const ln=hi+k+2,cell=i=>i<0?'':String(r[i]==null?'':r[i]).trim(),content=cell(ci),L='Dòng '+ln+': ';
    if(r.every(x=>String(x).trim()===''))return;
    if(!content){err.push(L+'thiếu nội dung câu hỏi.');return}
    let pw=null;if(wi>=0&&cell(wi)){pw=parseFloat(cell(wi).replace(',','.'));if(!(pw>0)){err.push(L+'điểm phải là số lớn hơn 0.');return}}
    if(seen.has(nz(content))){const bq=bm.get(nz(content));if(reuse&&bq&&!ff.has(nz(content))){ff.add(nz(content));items.push({content:bq.content,type:bq.type,opts:bq.opts.slice(),ans:bq.ans,objs:(bq.objs||[]).slice(),diff:bq.diff,bloom:bq.bloom,reuse:bq.id,w:pw});return}err.push(L+'câu hỏi đã có trong ngân hàng hoặc bị trùng trong tệp.');return}
    const opts=oi.map(cell),given=opts.map((o,i)=>o?i:-1).filter(i=>i>=0),raw=cell(ai).toUpperCase();
    let type,ans=null,op=[];
    if(!given.length)type=raw?'SHORT_ANSWER':'ESSAY';
    else{
      if(given.some((v,i)=>v!==i)){err.push(L+'các đáp án phải điền liên tiếp từ A.');return}
      if(given.length<2){err.push(L+'câu trắc nghiệm cần ít nhất 2 phương án.');return}
      const tk=raw.split(/[,;\s\/+&]+/).filter(Boolean);
      if(!tk.length||tk.some(t=>!/^[A-D]$/.test(t))){err.push(L+'“Đáp án đúng” phải là A, B, C hoặc D (nhiều đáp án cách nhau dấu phẩy).');return}
      const ix=[...new Set(tk.map(t=>t.charCodeAt(0)-65))];
      if(ix.some(i=>i>=given.length)){err.push(L+'đáp án đúng nằm ngoài các phương án đã nhập.');return}
      type=ix.length>1?'MULTIPLE_CHOICE':'SINGLE_CHOICE';ans=ix.length>1?ix:ix[0];op=opts.slice(0,given.length);
    }
    const objs=[],qw=[];
    cell(gi).split(/[,;]+/).map(x=>x.trim().toUpperCase()).filter(Boolean).forEach(t=>{const hits=cmAll[t]||[];if(!hits.length)qw.push('mục tiêu '+t+' không có trong lớp này nên được bỏ qua');else if(hits.length>1)qw.push('mã '+t+' có ở nhiều bài học nên không gắn được mục tiêu; hãy đổi mã cho duy nhất trong bài');else if(objs.includes(hits[0]))qw.push('mục tiêu '+t+' bị lặp, chỉ gắn một lần');else objs.push(hits[0])});
    if(qw.length)warn.push(L+qw.join('; ')+'.');
    const dk=cell(di)?DK[nz(cell(di))]:'MEDIUM';if(!dk){err.push(L+'độ khó phải là Dễ, Trung bình hoặc Khó.');return}
    const bl=cell(bi)?BL.find(b=>nz(b)===nz(cell(bi))):'Vận dụng';if(!bl){err.push(L+'mức Bloom phải là '+BL.join(', ')+'.');return}
    seen.add(nz(content));items.push({content,type,opts:op,ans,objs,diff:dk,bloom:bl,w:pw});
  });
  return {items,err,warn};
}
async function impPick(kind,f){
  const out=document.getElementById('impOut');if(!f||!out)return;
  out.innerHTML=`<p class='muted'>Đang đọc “${esc(f.name)}”…</p>`;
  try{
    const rows=await readRows(f),c=selected();
    if(kind==='students'){
      const lines=[],hi=rows.findIndex(r=>r.some(x=>nz(x)==='email'));
      if(hi>=0){
        const H=rows[hi].map(nz),ei=H.indexOf('email'),ni=H.findIndex(h=>h.startsWith('ho ten')),pi=H.findIndex(h=>h.startsWith('mat khau'));
        rows.slice(hi+1).forEach(r=>{const g=i=>i<0?'':String(r[i]==null?'':r[i]).trim(),em=g(ei),nm=g(ni),pw=g(pi);if(!em&&!nm)return;lines.push(em+', '+nm+(pw?', '+pw:''))});
      }else{
        const i0=rows.findIndex(r=>r.some(x=>String(x).includes('@')));
        if(i0<0)throw new Error('Không thấy cột Email trong tệp.');
        rows.slice(i0).forEach(r=>{const cells=r.map(x=>String(x==null?'':x).trim()).filter(Boolean);if(!cells.length)return;
          const em=cells.find(x=>x.includes('@'))||'',nm=cells.find(x=>x!==em&&!/^\d+$/.test(x))||'';lines.push(em+', '+nm)});
      }
      if(!lines.length)throw new Error('Không có dòng dữ liệu nào trong tệp.');
      impClose();addStudents();
      if(dlg&&dlg.fields&&dlg.fields[0]){dlg.fields[0].val=lines.join(NL);render()}
      toast('Đã đọc '+lines.length+' dòng từ tệp. Hãy kiểm tra rồi chọn “Thêm học sinh”.');return;
    }
    const R=parseQuestions(c,rows,kind==='asg');IMPSTATE={kind,items:R.items};
    const W=R.warn||[];
    out.innerHTML=`<p><b>${R.items.length}</b> câu hợp lệ · <b>${R.err.length}</b> dòng lỗi (bị bỏ qua)${W.length?' · <b>'+W.length+'</b> cảnh báo (câu vẫn được nhập)':''}.</p>${R.items.length?`<div class='tablewrap' style='max-height:200px;overflow:auto'><table><thead><tr><th scope='col'>Câu hỏi</th><th scope='col'>Loại</th><th scope='col'>Đáp án đúng</th></tr></thead><tbody>${R.items.slice(0,8).map(o=>`<tr><td>${esc(o.content)}</td><td>${QT[o.type]}${o.reuse?' · đã có trong ngân hàng':''}</td><td>${o.ans==null?'—':[].concat(o.ans).map(i=>String.fromCharCode(65+i)).join(', ')}</td></tr>`).join('')}</tbody></table></div>${R.items.length>8?`<p class='muted' style='margin:4px 0'>…và ${R.items.length-8} câu khác.</p>`:''}`:''}${W.length?`<div style='margin-top:8px'><div class='muted' style='font-size:12.5px'><b>Cảnh báo:</b> ${esc(W[0])}</div>${W.slice(1,3).map(w=>`<div class='muted' style='font-size:12.5px'>${esc(w)}</div>`).join('')}${W.length>3?`<div class='muted' style='font-size:12.5px'>…và ${W.length-3} cảnh báo khác.</div>`:''}</div>`:''}${R.err.length?`<div style='margin-top:8px'>${R.err.slice(0,10).map(e=>`<div class='muted' style='font-size:12.5px'>${esc(e)}</div>`).join('')}${R.err.length>10?`<div class='muted'>…và ${R.err.length-10} lỗi khác.</div>`:''}</div>`:''}<div class='row' style='margin-top:12px'><button class='btn' ${R.items.length?'':'disabled'} onclick='${kind==="asg"?"impCommitA()":"impCommitQ()"}'>${kind==='asg'?'Thêm '+R.items.length+' câu vào bài tập':'Nhập '+R.items.length+' câu vào ngân hàng'}</button></div>`;
  }catch(e){out.innerHTML=`<div class='notice'><div>${esc(e.message||'Không đọc được tệp.')}</div></div>`}
}
function impCommitQ(){
  const c=selected(),L=IMPSTATE&&IMPSTATE.items;if(!L||!L.length)return;
  if(role==='T'&&!owns(c)){toast('Bị từ chối: lớp này không do bạn phụ trách.');return}
  L.forEach(o=>{const nq=Object.assign({id:'C'+(QID++),src:'MANUAL',upd:stamp()},o);normQ(c,nq);c.bank.push(nq)});
  impClose();render();toast('Đã nhập '+L.length+' câu hỏi vào ngân hàng (nguồn: tự soạn).');
}
const _qp0=questionsPage,_st0=students;
window.questionsPage=function(){return aiInline(selected(),'bank')+_qp0()};
window.students=function(){return _st0().replace("<button class='btn' onclick='addStudents()'>","<span class='row'><button class='btn light' onclick=\"importFile('students')\">Nhập từ Excel/Word</button><button class='btn' onclick='addStudents()'>").replace('Thêm học sinh</button></div>','Thêm học sinh</button></span></div>')};
