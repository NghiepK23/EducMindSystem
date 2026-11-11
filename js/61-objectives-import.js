/* EducMind · js/61-objectives-import.js
   Hộp thoại “Tải mục tiêu lên”: dán văn bản, tệp, giáo án; xem trước và ghi nhận. */
/* ---------- Hộp thoại “Tải mục tiêu lên” ---------- */
/* Khung hộp thoại chỉ dựng MỘT lần cho mỗi lần mở. Khi đổi tab hoặc thêm/bớt dòng xem trước,
   chỉ phần thân (#objImpBody) và nhãn nút được cập nhật — tiêu đề, thanh tab, hàng nút giữ nguyên
   nên hộp thoại không nhảy kích thước, không chạy lại hiệu ứng mở. */
function objImpModal(title,inner,mode,count){
  const tabs=[['text','Dán văn bản'],['file','Tệp Excel/Word'],['plan','Giáo án (tự trích xuất)']];
  const m=document.getElementById('objOv');
  if(!m){
    const ov=document.createElement('div');ov.id='objOv';ov.className='ov enter obj-ov';document.body.appendChild(ov);
    ov.innerHTML=`<div class='dlg' role='dialog' aria-modal='true' aria-label='Tải mục tiêu lên'>`+
      `<div class='row between' style='align-items:flex-start'><h2 style='font-size:18px;margin:0'>${title}</h2><button class='btn light icon-only' data-iconified='1' aria-label='Đóng' onclick='objImpClose()'>${ic('close',16)}</button></div>`+
      `<div class='seg seg-wide' role='tablist' aria-label='Cách tải mục tiêu lên' style='margin-top:10px'>${tabs.map(([k,label])=>`<button type='button' role='tab' data-m='${k}' aria-selected='${mode===k}' onclick="objImpSetMode('${k}')">${label}</button>`).join('')}</div>`+
      `<div id='objImpBody'>${inner}</div>`+
      `<div class='row' style='justify-content:flex-end;margin-top:16px'><button class='btn light' onclick='objImpClose()'>Hủy</button><button class='btn' id='objImpCommitBtn' ${count?'':'disabled'} onclick='objImpCommit()'>${count?'Nhập '+count+' mục tiêu':'Nhập mục tiêu'}</button></div>`+
      `</div>`;
    return;
  }
  const d=m.querySelector('.dlg'),b=d&&d.querySelector('#objImpBody');
  if(!b){m.remove();document.getElementById('objOv');return objImpModal(title,inner,mode,count)}
  b.innerHTML=inner;
  d.querySelectorAll('.seg[role=tablist] button').forEach(x=>x.setAttribute('aria-selected',String(x.dataset.m===mode)));
  const cb=d.querySelector('#objImpCommitBtn');
  if(cb){cb.disabled=!count;cb.textContent=count?('Nhập '+count+' mục tiêu'):'Nhập mục tiêu'}
}
function objImpClose(){const m=document.getElementById('objOv');if(m)m.remove();OBJIMP=null}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('objOv'))objImpClose()});
function objImpOpen(){
  const c=selected(),r=folderResolve(c),l=r.l;
  if(!l){toast('Hãy mở một bài học trước để nhập mục tiêu.');return}
  if(role==='T'&&!owns(c)){toast('Bị từ chối: lớp này không do bạn phụ trách.');return}
  OBJIMP={mode:'text',text:'',items:[],warn:[],err:[],fileName:'',found:null,note:'',edit:null};
  objImpRender();
}
function objImpFillSample(){if(!OBJIMP)return;OBJIMP.text='LO01, Trình bày được quá trình xử lí thông tin\nLO02, Phân biệt được thông tin và dữ liệu\nNêu được ví dụ về vật mang tin';objImpRender()}
function objImpRender(){
  const c=selected(),r=folderResolve(c),l=r.l;
  if(!l||!OBJIMP)return;
  const M=OBJIMP.mode;
  let body='';
  if(M==='text'){
    body=`<div class='field'><label for='objText'>Mỗi dòng một mục tiêu, dạng <b>Mã, Nội dung</b></label><textarea id='objText' rows='7' oninput='OBJIMP.text=this.value' placeholder="LO01, Trình bày được quá trình xử lí thông tin&#10;LO02, Phân biệt được thông tin và dữ liệu">${esc(OBJIMP.text||'')}</textarea>
</div>
<div class='row' style='margin-top:10px'><button class='btn' onclick='objImpFromText()'>Đọc và xem trước</button><button class='btn light' onclick='objImpFillSample()'>Điền ví dụ</button></div>`;
  }
  if(M==='file'){
    body=`<div class='row' style='margin:12px 0'><button class='btn' onclick="document.getElementById('objFile').click()">Chọn tệp</button><button class='btn light' onclick='objImpTemplate()'>Tải tệp mẫu (CSV)</button></div>
<input id='objFile' class='sr' tabindex='-1' type='file' accept='.xlsx,.xls,.csv,.docx' onchange='objImpPick(this.files[0])'>`;
  }
  if(M==='plan'){
    const F=OBJIMP.found;
    body=`<div class='row' style='margin:0 0 10px'><button class='btn' onclick="document.getElementById('objPlanFile').click()">Chọn giáo án</button><span class='muted' style='font-size:.8125rem'>${OBJIMP.fileName?('Đang đọc: '+esc(OBJIMP.fileName)):''}</span></div>
<input id='objPlanFile' class='sr' tabindex='-1' type='file' accept='.docx,.txt,.md,.csv,.xlsx' onchange='objImpPickPlan(this.files[0])'>
<div class='field'><label for='objPlanText'>Nội dung giáo án</label><textarea id='objPlanText' rows='7' oninput='OBJIMP.planText=this.value' placeholder='Dán giáo án vào đây, ví dụ:&#10;I. MỤC TIÊU BÀI HỌC&#10;1. Về kiến thức:&#10;- Trình bày được quá trình xử lí thông tin&#10;- Phân biệt được thông tin và dữ liệu'>${esc(OBJIMP.planText||'')}</textarea></div>
<div class='row' style='margin-top:10px'><button class='btn' onclick='objImpFromPlan()'>Trích xuất mục tiêu</button></div>
${F?`<div class='notice' style='background:var(--good-soft);color:var(--ink)'>${ic('check',16)}<div>${F.found?'Đã tìm thấy phần mục tiêu trong giáo án':'Không thấy tiêu đề “Mục tiêu”, hệ thống đoán theo động từ nhận thức'}: <b>${F.lines.length}</b> dòng, tách được <b>${(OBJIMP.items||[]).length}</b> mục tiêu.</div></div>`:''}`;
  }
  const items=OBJIMP.items||[];
  const editing=OBJIMP.edit;
  const rowsHtml=items.map((o,i)=>editing===i
    ? `<tr class='obj-editing'><td><input id='objE-code' value="${esc(o.code)}" aria-label='Mã mục tiêu' style='width:100%'></td><td><input id='objE-desc' value="${esc(o.desc)}" aria-label='Nội dung mục tiêu' style='width:100%'></td><td><span class='row' style='flex-wrap:nowrap;gap:6px'><button class='btn icon-only' data-iconified='1' aria-label='Lưu mục tiêu ${esc(o.code)}' title='Lưu' onclick='objImpEditSave(${i})'>${ic('check',15)}</button><button class='btn light icon-only' data-iconified='1' aria-label='Huỷ sửa mục tiêu ${esc(o.code)}' title='Huỷ' onclick='objImpEditCancel()'>${ic('close',15)}</button></span></td></tr>`
    : `<tr><td><code class='obj-code'>${esc(o.code)}</code></td><td>${esc(o.desc)}</td><td><span class='row' style='flex-wrap:nowrap;gap:6px'><button class='btn light icon-only' data-iconified='1' aria-label='Sửa mục tiêu ${esc(o.code)}' title='Sửa' onclick='objImpEdit(${i})'>${ic('edit',15)}</button><button class='btn light icon-only obj-del' data-iconified='1' aria-label='Xoá mục tiêu ${esc(o.code)}' title='Xoá' onclick='objImpRemove(${i})'>${ic('trash',15)}</button></span></td></tr>`).join('');
  const list=items.length?`<div class='tablewrap' style='max-height:240px;overflow:auto'><table><thead><tr><th scope='col' style='width:120px'>Mã</th><th scope='col'>Nội dung mục tiêu</th><th scope='col' style='width:96px'>Điều chỉnh</th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`:'';
  const warn=(OBJIMP.warn||[]).length?`<div class='notice' style='background:var(--need-soft);color:var(--ink)'>${ic('alert',16)}<div>${OBJIMP.warn.slice(0,6).map(w=>esc(w)).join('<br>')}${OBJIMP.warn.length>6?'<br>…':''}</div></div>`:'';
  const err=(OBJIMP.err||[]).length?`<div class='notice' style='background:var(--err-bg);color:var(--err-ink)'>${ic('alert',16)}<div>${OBJIMP.err.slice(0,6).map(w=>esc(w)).join('<br>')}${OBJIMP.err.length>6?'<br>…':''}</div></div>`:'';
  objImpModal(`Tải mục tiêu lên cho “${esc(l.name)}”`, `${body}${warn}${err}${list}`, M, items.length);
}
function objImpSetMode(m){if(!OBJIMP)return;OBJIMP.mode=m;objImpRender()}
function objImpRemove(i){if(!OBJIMP)return;OBJIMP.items.splice(i,1);if(OBJIMP.edit===i)OBJIMP.edit=null;objImpRender()}
/* Sửa một dòng ngay trong bảng xem trước trước khi nhập vào hệ thống */
function objImpEdit(i){if(!OBJIMP)return;OBJIMP.edit=i;objImpRender();const el=document.getElementById('objE-desc');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length)}}
function objImpEditCancel(){if(!OBJIMP)return;OBJIMP.edit=null;objImpRender()}
function objImpEditSave(i){
  if(!OBJIMP)return;
  const codeEl=document.getElementById('objE-code'),descEl=document.getElementById('objE-desc');
  if(!codeEl||!descEl)return;
  const code=String(codeEl.value||'').trim().toUpperCase(),desc=String(descEl.value||'').replace(/\s+/g,' ').trim();
  if(!code){toast('Mã mục tiêu không được để trống.');return}
  if(desc.length<6){toast('Nội dung mục tiêu quá ngắn.');return}
  if(OBJIMP.items.some((o,k)=>k!==i&&String(o.code).toUpperCase()===code)){toast('Mã '+code+' đã có trong danh sách. Hãy dùng mã khác.');return}
  OBJIMP.items[i]={code,desc};
  OBJIMP.warn=(OBJIMP.warn||[]).filter(w=>w.indexOf('Dòng '+(i+1))!==0);
  OBJIMP.edit=null;objImpRender();toast('Đã sửa mục tiêu '+code+' trong danh sách chờ nhập.');
}
function objImpApply(text,fileName){
  const c=selected(),r=folderResolve(c),l=r.l;
  const R=parseObjectivesText(text,l);
  OBJIMP.items=R.items;OBJIMP.warn=R.warn;OBJIMP.err=R.err;OBJIMP.fileName=fileName||'';
  objImpRender();
  if(R.items.length)toast('Đã đọc được '+R.items.length+' mục tiêu. Kiểm tra rồi bấm “Nhập mục tiêu”.');
  else toast('Chưa đọc được mục tiêu nào. Xem gợi ý trong hộp thoại.');
}
function objImpFromText(){
  if(!OBJIMP)return;
  if(!String(OBJIMP.text||'').trim()){toast('Hãy dán nội dung mục tiêu trước.');return}
  objImpApply(OBJIMP.text,'');
}
async function objImpPick(f){
  if(!f||!OBJIMP)return;
  try{
    const text=await objLinesFromFile(f);
    objImpApply(text,f.name);
  }catch(e){toast(String(e&&e.message||e))}
}
async function objImpPickPlan(f){
  if(!f||!OBJIMP)return;
  try{
    const text=await objPlanFileText(f);
    OBJIMP.planText=text;OBJIMP.fileName=f.name;
    await objImpFromPlan();
  }catch(e){toast(String(e&&e.message||e))}
}
async function objImpFromPlan(){
  if(!OBJIMP)return;
  const text=String(OBJIMP.planText||'');
  if(!text.trim()){toast('Hãy chọn tệp giáo án hoặc dán nội dung giáo án.');return}
  if(objAIKey())toast('Đang nhờ Gemini đọc giáo án…');
  const P=await planObjectiveLinesSmart(text);
  OBJIMP.found={found:P.found,lines:P.lines};
  const R=parseObjectivesText(P.lines.join('\n'),folderResolve(selected()).l);
  OBJIMP.items=R.items;OBJIMP.warn=R.warn;OBJIMP.err=R.err;
  objImpRender();
  toast(P.lines.length?'Đã trích xuất '+R.items.length+' mục tiêu từ giáo án.':'Không thấy dòng mục tiêu nào trong giáo án.');
}
function objImpTemplate(){
  const csv='\ufeffMã mục tiêu,Nội dung mục tiêu\r\nLO01,Trình bày được quá trình xử lí thông tin\r\nLO02,Phân biệt được thông tin và dữ liệu\r\n,Nêu được ví dụ về vật mang tin';
  try{
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
    a.href=URL.createObjectURL(blob);a.download='Mau_muc_tieu_bai_hoc.csv';document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1500);
    toast('Đã tải tệp mẫu: Mau_muc_tieu_bai_hoc.csv');
  }catch(e){toast('Không lưu được tệp mẫu ở chế độ xem này.')}
}
function objImpCommit(){
  const c=selected(),r=folderResolve(c),l=r.l,items=(OBJIMP&&OBJIMP.items)||[];
  if(!l||!items.length)return;
  if(role==='T'&&!owns(c)){toast('Bị từ chối: lớp này không do bạn phụ trách.');return}
  const used=objUsedSet(l);
  items.forEach(o=>{
    let code=String(o.code||'').toUpperCase()||objNextCode(used);
    if(used.has(code))code=objNextCode(used);
    used.add(code);
    l.objs.push({code,desc:o.desc,idx:objGoalIndex(c,o.desc)});
  });
  l.upd=stamp();
  const n=items.length;
  objImpClose();render();
  toast('Đã nhập '+n+' mục tiêu cho “'+l.name+'”.');
}
