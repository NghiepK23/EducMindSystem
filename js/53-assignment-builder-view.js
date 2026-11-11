/* EducMind · js/53-assignment-builder-view.js
   Giao diện trình tạo bài tập (asgBuilder) và xem trước bài tập. */
/* xem trước đúng như học sinh sẽ thấy */
function pvModal(html){let m=document.getElementById('pvOv');if(!m){m=document.createElement('div');m.id='pvOv';m.className='ov enter';document.body.appendChild(m)}m.innerHTML=`<div class='dlg' role='dialog' aria-modal='true' aria-label='Xem trước bài tập' style='max-width:780px;max-height:88vh;overflow:auto'>${html}</div>`}
function pvClose(){const m=document.getElementById('pvOv');if(m)m.remove()}
document.addEventListener('keydown',e=>{if(e.key==='Escape')pvClose()});
function asgPrev(i){
  const c=selected(),a0=i==null?asgCur(c):c.assignments[i];if(!a0)return;
  const a=a0===asgDraft?Object.assign({},a0,{maxTries:parseInt(a0.tries,10)||1,max:asgIsQ(a0)?asgSum(a0):(parseFloat(a0.m)||0)}):a0;
  const bar=`<div class='notice' style='margin-bottom:12px'><div>Bản xem trước đúng như học sinh sẽ thấy. Mọi thao tác trong chế độ này không được lưu và không tính điểm.</div></div>`,close=`<div class='row' style='margin-top:12px'><button class='btn' onclick='pvClose()'>Đóng xem trước</button></div>`;
  if(asgIsQ(a)){
    if(!a.qs.length){toast('Bài tập chưa có câu hỏi để xem trước.');return}
    pvModal(bar+examHtml(c,a,{has:false,score:null},{qs:rdBuild(c,a),ans:{},miss:[]},true,true)+close);
  }else pvModal(bar+`<h2 style='font-size:18px'>${esc(a.name)}</h2><p class='muted'>Nộp tệp hoặc văn bản · Hạn nộp ${esc(a.due)} · Điểm tối đa ${a.max}</p><p>${esc(a.desc)}</p><div class='field'><label>Bài làm</label><textarea rows='4' style='width:100%' disabled></textarea></div><div class='field'><label>Tệp đính kèm</label><input type='file' disabled></div>`+close);
}
function asgBuilder(c){
  const a=asgCur(c);if(!a)return '';
  const isNew=a===asgDraft,isQ=asgIsQ(a),lock=!isNew&&asgWork(a),qs=a.qs||[];
  const src=isNew?asgSrc:(isQ?'BANK':'FILE');
  const fld=(id,lb,inner,st)=>`<div class='field' style='${st||'flex:1;min-width:180px'}'><label for='${id}'>${lb}</label>${inner}</div>`;
  const okName=!!String(a.name).trim();

  /* một câu trong bộ đề sẽ gửi cho học sinh */
  const row=(x,i)=>{const q=qOf(c,x.qid);if(!q)return '';return `<div class='item'><div><b>Câu ${i+1}. ${esc(q.content)}</b><div class='muted'>${QT[q.type]} · ${q.objs.length?q.objs.map(j=>codeOf(c,j)).join(', '):'Tổng hợp (không sinh bằng chứng)'} · ${x.w} điểm${q.del?' · đã xóa khỏi ngân hàng':''}</div>${isObj(q)?`<div class='muted'>${q.opts.map((o,k)=>([].concat(q.ans).includes(k)?'✓ ':'')+esc(o)).join(' · ')}</div>`:`<div class='muted'>Giáo viên chấm tay</div>`}</div>${lock?'':`<span class='row' style='flex-wrap:nowrap'><button class='btn light' onclick='asgMove(${i},-1)' ${i?'':'disabled'} aria-label='Chuyển câu ${i+1} lên'>↑</button><button class='btn light' onclick='asgMove(${i},1)' ${i<qs.length-1?'':'disabled'} aria-label='Chuyển câu ${i+1} xuống'>↓</button><button class='btn light' onclick='asgW(${i})'>Điểm</button><button class='btn light' onclick='asgRm(${i})'>Gỡ</button></span>`}</div>`};

  /* câu hỏi của bài học đang lọc, nhóm theo từng mục tiêu */
  const L=asgLes==='all'?c.lessonsData:c.lessonsData.filter(l=>l.name===asgLes),groups=[],seen=new Set();
  L.forEach(l=>l.objs.forEach(o=>{if(!seen.has(o.idx)){seen.add(o.idx);const code=codeOf(c,o.idx);groups.push({j:o.idx,title:(code?code+' · ':'')+c.goals[o.idx],les:l.name})}}));
  if(asgLes==='all')groups.push({j:null,title:'Câu tổng hợp (không gắn mục tiêu)',les:''});
  const vis=new Set();groups.forEach(g=>asgQsOf(c,g.j).forEach(q=>vis.add(q.id)));
  const off=qs.filter(x=>!vis.has(x.qid)).length,nBank=c.bank.filter(q=>!q.del).length;
  const lesCnt=l=>{const ix=l.objs.map(o=>o.idx);return c.bank.filter(q=>!q.del&&(q.objs||[]).some(j=>ix.includes(j))).length};
  const sum=asgSum(a);

  /* ---------- 1. Thông tin cơ bản (luôn hiện, một lần duy nhất) ---------- */
  const sc=asgScopes(c);
  const info=`<section class='panel ab-sec' aria-labelledby='h-ab'>
<div class='ab-sec-head'><h2 id='h-ab' tabindex='-1'>${isNew?'Tạo bài tập mới':'Soạn bài tập · '+esc(a.name)}</h2><button class='btn light' onclick='asgCancel()'>${isNew?'Hủy':'Đóng'}</button></div>
${isNew?`<div class='ab-quick' role='group' aria-label='Cách tạo nội dung'>${[['BANK',ic('questions',17),'Ngân hàng câu hỏi','Chọn câu có sẵn'],['UPLOAD',ic('upload',17),'Tải tệp Excel/Word','Đọc câu từ tệp'],['FILE',ic('file-text',17),'Học sinh nộp bài','Đề tự luận hoặc tệp'],['PLAN',ic('spark',17),'Từ giáo án (AI)','AI soạn câu, bạn duyệt']].map(k=>`<button type='button' class='ab-chip ${src===k[0]?'on':''}' aria-pressed='${src===k[0]}' onclick="asgSetSrc('${k[0]}')">${k[1]}<span><b>${k[2]}</b><i>${k[3]}</i></span></button>`).join('')}</div>`:''}
<div class='ab-grid'>
${fld('ab-name','Tên bài tập',`<input id='ab-name' value="${esc(a.name)}" oninput="asgF('name',this.value);abNameTick(this.value)">`,'grid-column:span 2')}
${fld('ab-scope','Giao cho',`<select id='ab-scope' onchange='asgScopeSet(this.value)'>${sc.map(o=>`<option ${o===a.scopeSel?'selected':''}>${esc(o)}</option>`).join('')}</select>`,'grid-column:span 2')}
${isQ?fld('ab-mode','Giao diện làm bài cho học sinh',`<select id='ab-mode' ${lock?'disabled':''} onchange='asgModeSet(this.value)'><option value='classic' ${(a.gameMode||'classic')==='classic'?'selected':''}>Truyền thống</option><option value='survival' ${a.gameMode==='survival'?'selected':''}>Sinh tồn tri thức</option></select>`,'grid-column:span 2'):''}
${fld('ab-due','Hạn nộp',`<span class='datebox'><input id='ab-due' value="${esc(a.due)}" autocomplete='off' oninput="asgF('due',this.value)"><button type='button' class='date-btn' data-iconified='1' aria-label='Chọn ngày từ lịch' title='Chọn ngày từ lịch' onclick="dateOpen('ab-due')">${ic('calendar',16)}</button></span>`)}
${fld('ab-tries','Số lần làm tối đa',`<input id='ab-tries' type='number' min='1' value="${esc(a.tries!=null?a.tries:(a.maxTries||3))}" oninput="asgF('tries',this.value)">`)}
${src==='FILE'?fld('ab-m','Điểm tối đa',`<input id='ab-m' type='number' min='1' value="${esc(a.m)}" oninput="asgF('m',this.value)">`):''}
${fld('ab-late','Nộp trễ',`<select id='ab-late' onchange="asgF('late',this.value==='1');render()"><option value='0' ${a.late?'':'selected'}>Không cho nộp trễ</option><option value='1' ${a.late?'selected':''}>Cho nộp trễ</option></select>`)}
${a.late?fld('ab-lc','Đóng nộp trễ',`<span class='datebox'><input id='ab-lc' value="${esc(a.lc)}" autocomplete='off' oninput="asgF('lc',this.value)"><button type='button' class='date-btn' data-iconified='1' aria-label='Chọn ngày từ lịch' title='Chọn ngày từ lịch' onclick="dateOpen('ab-lc')">${ic('calendar',16)}</button></span>`):''}
</div>
</section>`;

  /* ---------- 2. Nội dung: một khối duy nhất, đổi theo cách tạo ---------- */
  let body='';
  if(src==='FILE'){
    body=`<section class='panel ab-sec' aria-labelledby='h-af'><div class='ab-sec-head'><h2 id='h-af' tabindex='-1'>Đề bài cho học sinh</h2><span class='pill plain'>Học sinh nộp tệp hoặc bài viết</span></div>
<textarea id='ab-desc' rows='6' style='width:100%' placeholder='Ghi rõ học sinh phải làm gì, cần nộp gì, tiêu chí nào được tính điểm…' oninput="asgF('desc',this.value)">${esc(a.desc)}</textarea>
<p class='muted' style='margin:10px 0 0;font-size:.8125rem'>Mục tiêu bài đo được tính từ các mục tiêu bạn tick ở bảng bên dưới.</p>
${objPick(c,a)}</section>`;
  } else {
    const up=src==='PLAN'?asgPlanPanel(c):(src==='UPLOAD'?`<div class='upbox'><span class='ui'>${ic('upload',18)}</span><div style='flex:1;min-width:0'><b>Tải lên tệp Excel (.xlsx, .csv) hoặc Word (.docx)</b><div class='row' style='margin-top:10px'><button class='btn' onclick="importFile('asg')">${ic('plus',16)}Chọn tệp và tải lên</button><button class='btn light' onclick="impTemplate('asg')">Tải mẫu Excel</button><button class='btn light' onclick="impTemplateWord('asg')">Tải mẫu Word</button></div></div></div>`:'');
    /* danh sách câu chỉ hiện khi đang chọn từ ngân hàng; cách tạo đã chọn ở hàng chip phía trên */
    const bank=src==='BANK'?`
<div class='ab-tools'>
<div class='selectbox' style='min-width:250px'><label for='als'>Lấy câu hỏi của bài học</label><select id='als' onchange='asgLes=this.value;render()'><option value='all' ${asgLes==='all'?'selected':''}>Tất cả bài học (${nBank} câu)</option>${c.lessonsData.map(l=>`<option value="${esc(l.name)}" ${l.name===asgLes?'selected':''}>${esc(l.name)} (${lesCnt(l)} câu)</option>`).join('')}</select></div>
<div class='selectbox' style='flex:1;min-width:190px'><label for='ab-find'>Tìm câu hỏi</label><input id='ab-find' style='background:transparent;box-shadow:none;padding:2px 0' placeholder='Gõ từ khóa…' value="${esc(asgFind)}" oninput='asgLiveFind(this.value)'></div>
<div class='selectbox'><label for='adw'>Điểm mỗi câu</label><input id='adw' type='number' min='0.1' step='0.1' style='width:100px' value="${esc(asgDefW)}" oninput='asgDefW=this.value'></div>
</div>
<div class='row between' style='flex-wrap:wrap;gap:10px;margin-top:10px'>
<span class='chips'><button type='button' class='chip ${asgFT==='all'?'on':''}' data-ft='all' onclick="asgSetFT('all')">Mọi loại</button><button type='button' class='chip ${asgFT==='obj'?'on':''}' data-ft='obj' onclick="asgSetFT('obj')">Trắc nghiệm</button><button type='button' class='chip ${asgFT==='sub'?'on':''}' data-ft='sub' onclick="asgSetFT('sub')">Tự luận</button></span>
<span class='row' style='flex-wrap:wrap'><button class='btn light' onclick='asgAuto()'>Chọn nhanh theo mục tiêu</button><button class='btn light' onclick='asgNewQ()'>Soạn câu mới</button></span>
</div>
<p class='muted' id='asg-shown' role='status' style='margin:8px 0 0;font-size:.8125rem'></p>
<div class='ab-bank'>${groups.length?groups.map(g=>{const Q=asgQsOf(c,g.j),on=Q.filter(q=>qs.some(x=>x.qid===q.id)).length;return `<div class='qgrp'><div class='row between' style='flex-wrap:wrap'><b>${esc(g.title)} <span class='muted' style='font-weight:400'>· ${Q.length} câu</span>${on?` <span class='pill prog'>${ic('check',13)}đã chọn ${on}</span>`:''}</b>${Q.length?`<span class='row'><button class='btn light' onclick='asgGrp(${g.j},true)'>Chọn cả nhóm</button><button class='btn light' onclick='asgGrp(${g.j},false)'>Bỏ chọn</button></span>`:''}</div>${Q.length?Q.map(q=>{const x=qs.find(v=>v.qid===q.id);return `<label class='item qrow ${x?'sel':''}' data-qtype='${isObj(q)?'obj':'sub'}' data-qdiff='${q.diff||'MEDIUM'}' data-qtext="${esc(nz(q.content+' '+(q.opts||[]).join(' ')))}" style='display:flex;gap:10px;align-items:flex-start'><input type='checkbox' id='aq-${g.j}-${q.id}' data-q='${q.id}' ${x?'checked':''} onchange='asgTog(this.dataset.q,this.checked,this.id)'><span style='flex:1;min-width:0'><b>${esc(q.content)}</b><span class='muted' style='display:block'>${QT[q.type]}${q.diff?' · '+(DF[q.diff]||''):''}${isObj(q)?' · '+q.opts.map((o,k)=>([].concat(q.ans).includes(k)?'✓ ':'')+esc(o)).join(' · '):' · chấm tay'}</span></span></label>`}).join(''):`<div class='empty'>Ngân hàng chưa có câu cho mục tiêu này. Dùng “Soạn câu mới”, hoặc chọn cách tạo “Tải tệp Excel/Word” / “Từ giáo án (AI)” ở trên.</div>`}</div>`}).join(''):`<div class='empty'>Bài học này chưa có mục tiêu nên chưa có câu hỏi để chọn. Hãy chọn bài học khác, hoặc tải tệp câu hỏi lên.</div>`}</div>
${off?note(off+' câu đã chọn không thuộc bài học đang lọc nhưng vẫn nằm trong bài tập.'):''}`:'';
    const hint=src==='UPLOAD'?'Tệp được đọc và câu hỏi tự thêm vào bài tập. Xong thì chuyển sang “Ngân hàng câu hỏi” để tick thêm hoặc chỉnh điểm.':(src==='PLAN'?'Câu do AI soạn chỉ vào bài tập sau khi bạn bấm “Dùng các câu này”.':'');
    body=`<section class='panel ab-sec' aria-labelledby='h-ap'>
<div class='ab-sec-head'><h2 id='h-ap' tabindex='-1'>${src==='BANK'?'Chọn câu hỏi':(src==='UPLOAD'?'Nhập câu hỏi từ tệp':(src==='PLAN'?'Câu hỏi AI soạn từ giáo án':'Đề bài cho học sinh'))}</h2><span class='ab-sum'>${qs.length?qs.length+' câu · '+sum+' điểm':'Chưa chọn câu nào'}</span></div>
${up}${hint?`<p class='muted' style='margin:10px 0 0;font-size:.8125rem'>${hint}</p>`:''}${bank}
</section>`;
  }

  /* ---------- 3. Bộ đề đã chọn (luôn hiện) ---------- */
  const selP=isQ?`<section class='panel ab-sec' aria-labelledby='h-as2'><div class='ab-sec-head'><h2 id='h-as2' tabindex='-1'>Bài tập sẽ giao · ${qs.length} câu · ${sum} điểm</h2>${qs.length&&!lock?`<button class='btn light' onclick='asgClearQ()'>Bỏ tất cả câu</button>`:''}</div>${qs.length?qs.map(row).join(''):`<div class='empty'>Chưa chọn câu nào. Tick câu ở danh sách phía trên — bộ đề và điểm được cập nhật ngay.</div>`}</section>`:'';

  /* ---------- 4. Thanh hành động ---------- */
  const act=`<div class='asgbar'><span class='muted' style='font-size:.8125rem'>${isNew?(lock?'':'Tự động lưu khi bạn chuyển trang · chỉ giao cho học sinh khi bấm “Giao bài tập”'):(lock?'Bài đã có học sinh làm nên không sửa được danh sách câu hỏi.':'Thay đổi được lưu ngay vào bài tập.')}</span><span class='row'>${isNew?`<button class='btn light' onclick='asgPrev()'>Xem trước như học sinh</button><button class='btn light' onclick='asgSaveNew(false)'>Lưu nháp</button><button class='btn' id='ab-giao' onclick='asgSaveNew(true)' ${okName?'':'disabled title="Đặt tên bài tập trước"'}>${ic('check',16)}Giao bài tập</button>`:`<button class='btn light' onclick='asgPrev(${asgQ})'>Xem trước như học sinh</button><button class='btn light' onclick='asgCancel()'>Đóng</button>`}</span></div>`;

  return `<div class='asg-builder'>${info}${body}${selP}${act}</div>`;
}
/* đổi tên bài tập: bật/tắt nút Giao bài tập mà không cần vẽ lại toàn trang */
function abNameTick(v){const b=document.getElementById('ab-giao')||document.querySelector('.asgbar .btn:last-child');if(b&&b.tagName==='BUTTON')b.disabled=!String(v).trim()}
/* tick mục tiêu cho bài nộp tệp (mục tiêu quyết định bằng chứng học tập) */
function asgObjPick(j){
  const c=selected(),a=asgCur(c);if(!a)return;
  a.objs=a.objs||[];
  const i=a.objs.indexOf(j);if(i>=0)a.objs.splice(i,1);else a.objs.push(j);
  a.objs.sort((x,y)=>x-y);a.upd=stamp();render();
}
function objPick(c,a){return `<div class='ab-objs'><div class='muted' style='font-size:.8125rem;margin:12px 0 6px'>Mục tiêu bài đo</div>${c.goals.map((gl,j)=>`<label class='objrow'><input type='checkbox' ${(a.objs||[]).includes(j)?'checked':''} onchange='asgObjPick(${j})'><span><b>${codeOf(c,j)||'Mục tiêu '+(j+1)}</b> ${esc(gl)}</span></label>`).join('')}</div>`}
/* bộ lọc câu hỏi được áp lại sau mỗi lần vẽ để giữ nguyên trạng thái khi tick câu */
const _rd0=render;
window.render=function(){_rd0();if(document.querySelector('.qgrp'))asgApplyFilters()};
