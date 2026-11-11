/* EducMind · js/63-folder-objectives.js
   Thư mục học tập · phần Mục tiêu: thêm, sửa, xóa mục tiêu; trang đánh giá. */
function folderObjectives(c,l){
  const c0=c,os=l.objs||[];
  const addBtn=(cls,label)=>`<button type='button' class='btn ${cls||''}' data-noicon='1' onclick='folderAddObjective()' aria-label='Thêm mục tiêu' title='Thêm mục tiêu'>${ic('plus',16)}<span>${label||'Thêm mục tiêu'}</span></button>`;
  const impBtn=`<button type='button' class='btn light obj-import-btn' data-noicon='1' onclick='objImpOpen()' aria-haspopup='dialog' aria-label='Nhập mục tiêu từ tệp, văn bản hoặc giáo án' title='Nhập mục tiêu từ tệp, văn bản hoặc giáo án'>${ic('upload',16)}<span>Nhập mục tiêu</span></button>`;
  const actBtn=(ic0,label,fn,i,tone)=>`<button class='btn light icon-only${tone==='danger'?' obj-del':''}' data-iconified='1' aria-label='${esc(label)}' title='${esc(label)}' onclick="${fn}(${i})">${ic(ic0,15)}</button>`;
  return `<section class='panel'><div class='row between'><h2>Mục tiêu cần đạt</h2><span class='row' style='flex-wrap:nowrap;gap:8px'>${impBtn}${addBtn('','Thêm mục tiêu')}</span></div><p class='lead'>Các mục tiêu này liên kết với bài tập, câu hỏi, kết quả và phân tích của bài học.</p>${os.length?`<div class='tablewrap'><table><thead><tr><th scope='col' style='width:150px'>Mã mục tiêu</th><th scope='col'>Nội dung mục tiêu</th><th scope='col' style='width:120px'>Điều chỉnh</th></tr></thead><tbody>${os.map((o,i)=>`<tr><td><code class='obj-code'>${esc(o.code||codeOf(c,o.idx))}</code></td><td>${esc(c.goals[o.idx]||o.desc||'')}</td><td><span class='row' style='flex-wrap:nowrap;gap:6px'>${actBtn('edit','Sửa mục tiêu '+esc(o.code||codeOf(c,o.idx)),'objEdit',i)}${actBtn('trash','Xoá mục tiêu '+esc(o.code||codeOf(c,o.idx)),'objDel',i,'danger')}</span></td></tr>`).join('')}</tbody></table></div>`:`<div class='folder-empty'>Bài học chưa có mục tiêu.</div>`}</section>`;
}
/* Thêm mục tiêu cho bài học đang mở: chỉ cần Mã (bắt buộc) và Nội dung (bắt buộc) */
function folderAddObjective(){
  const c=selected(),{l}=folderResolve(c);
  if(!l){toast('Hãy mở một bài học trước.');return}
  const used=new Set((l.objs||[]).map(o=>String(o.code||'').toUpperCase()));
  let n=1;while(used.has('LO'+String(n).padStart(2,'0')))n++;
  openDlg({title:'Thêm mục tiêu cho “'+esc(l.name)+'”',
    text:'Mã mục tiêu và nội dung đều bắt buộc. Mỗi mã dùng một lần trong bài học.',
    okLabel:'Thêm mục tiêu',
    fields:[{k:'c',label:'Mã mục tiêu',val:'LO'+String(n).padStart(2,'0'),hint:'Ví dụ: LO01, LO02…'},{k:'d',label:'Nội dung mục tiêu',val:'',area:true}],
    ok:v=>{
      const code=String(v.c||'').trim().toUpperCase(),d=String(v.d||'').trim();
      if(!code)return 'Mã mục tiêu không được để trống.';
      if(!d)return 'Nội dung mục tiêu không được để trống.';
      if((l.objs||[]).some(o=>String(o.code||'').toUpperCase()===code))return 'Bài học này đã có mã '+esc(code)+': mỗi mã dùng một lần trong bài học.';
      l.objs.push({code,desc:d,idx:addGoal(c,d)});l.upd=stamp();
      toast('Đã thêm mục tiêu '+code+'.');return null}});
}
/* Sửa một mục tiêu của bài học: đổi mã, đổi nội dung. Câu hỏi, bài tập, điểm đã ghi nhận giữ nguyên liên kết. */
function objEdit(i){
  const c=selected(),{l}=folderResolve(c);
  const o=l&&(l.objs||[])[i];if(!o)return;
  const oldCode=String(o.code||codeOf(c,o.idx)).toUpperCase(),oldDesc=c.goals[o.idx]||o.desc||'';
  openDlg({title:'Sửa mục tiêu '+esc(oldCode),
    text:'Đổi mã hoặc nội dung. Câu hỏi, bài tập và điểm đã ghi nhận vẫn giữ nguyên liên kết với mục tiêu này.',
    okLabel:'Lưu thay đổi',
    fields:[{k:'c',label:'Mã mục tiêu',val:oldCode,hint:'Mỗi mã dùng một lần trong bài học.'},{k:'d',label:'Nội dung mục tiêu',val:oldDesc,area:true}],
    ok:v=>{
      const code=String(v.c||'').trim().toUpperCase(),d=String(v.d||'').trim();
      if(!code)return 'Mã mục tiêu không được để trống.';
      if(!d)return 'Nội dung mục tiêu không được để trống.';
      if((l.objs||[]).some(x=>x!==o&&String(x.code||'').toUpperCase()===code))return 'Bài học này đã có mã '+esc(code)+': mỗi mã dùng một lần trong bài học.';
      if(code!==oldCode){
        o.code=code;
        (c.bank||[]).forEach(q=>{
          if(!(q.objs||[]).includes(o.idx))return;
          if(!(q.objCodes||[]).some(x=>String(x).toUpperCase()===oldCode))return;
          q.objCodes=q.objCodes.map(x=>String(x).toUpperCase()===oldCode?code:x);
        });
      }
      if(d!==oldDesc){
        o.desc=d;
        const shared=c.lessonsData.some(x=>x!==l&&(x.objs||[]).some(z=>z.idx===o.idx));
        if(!shared&&nz(c.goals[o.idx]||'')===nz(oldDesc)){c.goals[o.idx]=d}
        else{
          const from=o.idx;
          o.idx=addGoal(c,d);
          (c.bank||[]).forEach(q=>{
            if(!(q.objs||[]).includes(from))return;
            if(!(q.objCodes||[]).some(x=>String(x).toUpperCase()===oldCode))return;
            q.objs=q.objs.map(j=>j===from?o.idx:j);
          });
        }
      }
      l.upd=stamp();render();toast('Đã cập nhật mục tiêu '+code+'.');return null;
    }});
}
/* Xoá mục tiêu khỏi bài học: chỉ bỏ liên kết, giữ mục tiêu chung của lớp, điểm, bằng chứng và câu hỏi để không phần nào bị lỗi */
function objDel(i){
  const c=selected(),{l}=folderResolve(c);
  const o=l&&(l.objs||[])[i];if(!o)return;
  const code=String(o.code||codeOf(c,o.idx)).toUpperCase(),desc=c.goals[o.idx]||o.desc||'';
  const nQ=(c.bank||[]).filter(q=>!q.del&&(q.objs||[]).includes(o.idx)).length
    ,nA=(c.assignments||[]).filter(a=>a.status==='Đã xuất bản'&&(a.objs||[]).includes(o.idx)).length;
  openDlg({title:'Xoá mục tiêu '+esc(code)+'?',danger:true,okLabel:'Xoá mục tiêu',
    text:'Mục tiêu “'+esc(desc)+'” sẽ không còn trong bài học này.'+(nQ||nA?' Hiện có '+nQ+' câu hỏi trong ngân hàng và '+nA+' bài tập đã xuất bản gắn với mục tiêu này.':'')+' Điểm, bằng chứng và câu hỏi liên quan vẫn được giữ, chỉ mục tiêu là ẩn khỏi bài học — các phần khác không bị lỗi và có thể thêm lại mục tiêu bất cứ lúc nào.',
    ok:()=>{
      l.objs.splice(i,1);
      c.trash.unshift({type:'Mục tiêu',name:code+' · '+desc,ref:null,note:'Điểm, bằng chứng và câu hỏi liên quan vẫn được giữ',objIdx:[o.idx],at:stamp()});
      l.upd=stamp();render();toast('Đã xoá mục tiêu '+code+' khỏi bài học. Điểm và câu hỏi liên quan vẫn được giữ.');return null;
    }});
}
/* Ba mục Mức độ nắm vững / Lỗ hổng kiến thức / Gợi ý học tập đã tách thành tab riêng cấp hệ thống */
function assessPage(){
  return page==='mastery'?mastery():page==='gaps'?gapPage():recommend();
}
