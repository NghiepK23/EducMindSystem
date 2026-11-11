/* EducMind · js/22-question-bank-page.js
   Trang Ngân hàng câu hỏi của giáo viên: lọc, thêm, sửa, xóa câu hỏi. */
/* --- Ngân hàng câu hỏi (US-T05, T11, T12) --- */
let qbLes='all',qbObj='all',qbType='all',qbSrc='all',qbFind='';
function qbSet(k,v){if(k==='les')qbLes=v;else if(k==='obj')qbObj=v;else if(k==='type')qbType=v;else if(k==='src')qbSrc=v;else qbFind=v;render();const h=document.getElementById('h-qb');if(h)h.scrollIntoView({block:'nearest'})}
function qbResetFilters(){qbLes='all';qbObj='all';qbType='all';qbSrc='all';qbFind='';render()}
function questionsPage(){
  const c=selected(),all=c.bank.filter(q=>!q.del),sib=bankClasses(c);
  const lessonOfQ=q=>qbLessonOf(c,q);
  const objsAll=[...new Set(all.flatMap(q=>qCodes(c,q)))].sort();
  const fnd=nz(qbFind);
  const match=q=>{
    const les=lessonOfQ(q);
    if(qbLes==='none'&&les)return false;
    if(qbLes!=='all'&&qbLes!=='none'&&les!==qbLes)return false;
    if(qbObj!=='all'&&!qCodes(c,q).includes(qbObj))return false;
    if(qbType!=='all'&&q.type!==qbType)return false;
    if(qbSrc!=='all'&&(q.src||'MANUAL')!==qbSrc)return false;
    if(fnd&&nz(q.content).indexOf(fnd)<0)return false;
    return true};
  const L=all.filter(match);
  const groups=[];
  c.lessonsData.forEach(l=>{const its=L.filter(q=>lessonOfQ(q)===l.name);if(its.length)groups.push([l.name,its])});
  const none=L.filter(q=>!lessonOfQ(q));if(none.length)groups.push(['Chưa gắn bài học',none]);
  const typeOpts=[['all','Tất cả loại câu hỏi'],...QTK.map(k=>[k,QT[k]])];
  const lesOpts=[['all','Tất cả bài học'],...c.lessonsData.map(l=>[l.name,l.name]),['none','Chưa gắn bài học']];
  const objOpts=[['all','Tất cả mục tiêu'],...objsAll.map(o=>[o,o])];
  const srcOpts=[['all','Mọi nguồn'],['MANUAL','Tự soạn'],['AI','AI tạo']];
  const sel=(id,label,opts,val)=>`<div class='selectbox' style='min-width:0'><label for='${id}'>${label}</label><select id='${id}' onchange="qbSet('${id.replace('qb-','')}',this.value)">${opts.map(([k,v])=>`<option value="${esc(k)}" ${val===k?'selected':''}>${esc(v)}</option>`).join('')}</select></div>`;
  const row=q=>{const i=c.bank.indexOf(q),codes=qCodes(c,q);
    return `<tr><td style='min-width:240px'>${esc(q.content)}${qLocked(c,q)?` <span class='pill plain'>Đã có người làm</span>`:''}</td><td>${codes.length?codes.map(x=>`<code class='obj-code'>${esc(x)}</code>`).join(' '):'<span class="muted">Tổng hợp</span>'}</td><td>${QT[q.type]}</td><td style='white-space:nowrap'>${DF[q.diff]} · ${esc(q.bloom)}</td><td>${(q.src||'MANUAL')==='MANUAL'?'Tự soạn':'AI tạo'}</td><td><span class='row' style='flex-wrap:nowrap'><button class='btn light mini' onclick='editQ(${i})' aria-label='Sửa câu hỏi' title='Sửa câu hỏi'>${ic('edit',16)}</button><button class='btn light mini danger-soft' onclick='delQ(${i})' aria-label='Xoá câu hỏi' title='Xoá câu hỏi'>${ic('trash',16)}</button></span></td></tr>`};
  const tables=groups.map(([title,its])=>`<div class='qb-group'><div class='row between' style='margin:14px 0 6px'><b style='font-size:.9rem'>${esc(title)}</b><span class='pill plain'>${its.length} câu hỏi</span></div><div class='tablewrap'><table><thead><tr><th scope='col'>Nội dung câu hỏi</th><th scope='col' style='width:120px'>Mục tiêu</th><th scope='col' style='width:130px'>Loại</th><th scope='col' style='width:170px;white-space:nowrap'>Độ khó · Bloom</th><th scope='col' style='width:100px'>Nguồn</th><th scope='col' style='width:96px'><span class='sr'>Thao tác</span></th></tr></thead><tbody>${its.map(row).join('')}</tbody></table></div></div>`).join('');
  return `<section class='panel' aria-labelledby='h-qb'>
    <div class='row between' style='flex-wrap:wrap;gap:10px'><div><h2 id='h-qb'>Ngân hàng câu hỏi · Khối ${esc(String(c.grade))}</h2></div><div class='row' style='flex-wrap:nowrap'><button class='btn light' onclick='importFile("questions")' aria-label='Nhập từ Excel/Word' title='Nhập từ Excel/Word'>${ic('upload',16)}</button><button class='btn' onclick='editQ(-1)' aria-label='Thêm câu hỏi' title='Thêm câu hỏi'>${ic('plus',16)}</button></div></div>
    <div class='qb-filters'>${sel('qb-les','Bài học',lesOpts,qbLes)}${sel('qb-obj','Mục tiêu',objOpts,qbObj)}${sel('qb-type','Loại câu hỏi',typeOpts,qbType)}${sel('qb-src','Nguồn',srcOpts,qbSrc)}
      <div class='selectbox' style='min-width:0'><label for='qb-find'>Tìm nội dung</label><input id='qb-find' value='${esc(qbFind)}' placeholder='Nhập từ khoá…' onchange="qbSet('find',this.value)" onkeydown="if(event.key==='Enter')qbSet('find',this.value)"></div>
      <button class='btn light' data-noicon onclick='qbResetFilters()'>Xoá lọc</button>
    </div>
    <p class='muted' style='margin:10px 0 0;font-size:.82rem'>Tổng ${all.length} câu hỏi · đang hiển thị ${L.length} · câu đã dùng trong bài có người làm chỉ sửa được độ khó và mức Bloom.</p>
    ${groups.length?tables:`<div class='empty'>${all.length?'Không có câu hỏi nào khớp bộ lọc.':'Ngân hàng chưa có câu hỏi.'}</div>`}
  </section>${trashPanel(c,['Câu hỏi'])}`;
}
function editQ(i){
  const c=selected(),q=i<0?null:c.bank[i],lock=q&&qLocked(c,q),cm=codeMap(c);
  const kd=[{k:'d',label:'Độ khó',val:q?DF[q.diff]:DFV[1],sel:DFV},{k:'b',label:'Mức Bloom',val:q?q.bloom:BL[2],sel:BL}];
  const full=[{k:'c',label:'Nội dung',val:q?q.content:'',area:true},{k:'t',label:'Loại câu hỏi',val:q?QT[q.type]:QTV[0],sel:QTV},{k:'o',label:'Phương án (mỗi dòng một phương án; Đúng/Sai có sẵn hai phương án)',val:q?q.opts.join(NL):'',area:true},{k:'a',label:'Đáp án đúng (số thứ tự phương án, nhiều đáp án cách nhau dấu phẩy; Đúng/Sai: 1 = Đúng, 2 = Sai)',val:q&&q.ans!=null?[].concat(q.ans).map(x=>x+1).join(','):''},{k:'g',label:'Mục tiêu (không chọn = câu tổng hợp, không sinh bằng chứng học tập)',chk:objLabels(c).map(o=>o.label),val:q?objLabels(c).filter(o=>q.objs.includes(o.j)).map(o=>o.label):[]}];
  openDlg({title:q?'Sửa câu hỏi':'Thêm câu hỏi',text:lock?'Câu hỏi đã dùng trong bài kiểm tra có người làm: chỉ sửa được độ khó và mức Bloom. Muốn đổi nội dung, hãy tạo câu hỏi mới thay thế.':'',fields:lock?kd:full.concat(kd),ok:v=>{
    if(lock){q.diff=DFK[DFV.indexOf(v.d)];q.bloom=v.b;q.upd=stamp();toast('Đã lưu độ khó và mức Bloom');return null}
    const content=v.c.trim(),type=QTK[QTV.indexOf(v.t)];let opts=[],ans=null;
    if(!content)return 'Câu hỏi phải có nội dung.';
    if(isObjT(type)){
      opts=type==='TRUE_FALSE'?['Đúng','Sai']:v.o.split(NL).map(x=>x.trim()).filter(Boolean);
      if(opts.length<2)return 'Câu trắc nghiệm cần ít nhất 2 phương án.';
      const nums=v.a.split(',').map(x=>parseInt(x,10)-1).filter(x=>!isNaN(x));
      if(!nums.length||nums.some(n=>n<0||n>=opts.length))return 'Thiếu đáp án đúng hoặc đáp án nằm ngoài danh sách phương án.';
      if(type!=='MULTIPLE_CHOICE'&&nums.length!==1)return 'Loại câu này chỉ có một đáp án đúng.';
      ans=type==='MULTIPLE_CHOICE'?[...new Set(nums)]:nums[0];
    }
    const objs=v.g.map(l=>OBJL(c)[l]).filter(x=>x!=null);
    const o={content,type,opts,ans,objs,diff:DFK[DFV.indexOf(v.d)],bloom:v.b,upd:stamp()};
    if(q){Object.assign(q,o);normQ(c,q)}else{const nq=Object.assign({id:'C'+(QID++),src:'MANUAL'},o);normQ(c,nq);c.bank.push(nq);asgHookAdd(c,nq)}
    toast(q?'Đã lưu câu hỏi':'Đã thêm câu hỏi vào ngân hàng (nguồn: tự soạn)');return null}});
}
function delQ(i){
  const c=selected(),q=c.bank[i],inQ=c.quiz.qs.some(x=>x.qid===q.id);
  openDlg({title:'Xóa câu hỏi?',text:'Câu hỏi ẩn khỏi ngân hàng nên không chọn được cho bài kiểm tra mới.'+(inQ?' Câu hỏi vẫn được giữ nguyên trong bài kiểm tra hiện có.':''),danger:true,okLabel:'Xóa câu hỏi',ok:()=>{
    q.del=true;c.trash.unshift({type:'Câu hỏi',name:q.content,note:'Ẩn khỏi ngân hàng; vẫn nằm trong bài kiểm tra đã có',objIdx:[],at:stamp()});toast('Đã xóa mềm câu hỏi');return null}});
}
