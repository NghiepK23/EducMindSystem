/* EducMind · js/64-folder-resources.js
   Thư mục học tập · phần Tài liệu: xem trước, thêm tệp / liên kết, xóa tài liệu. */
function previewRes(id){
  const r=RESREG[id];if(!r)return;
  const real=!!r.blob;
  const box=document.getElementById('resPreviewBox');
  if(!box){toast('Không tìm thấy khu vực xem trước.');return}
  // Toggle: bấm tên file đang được preview → tắt
  if(box.dataset.previewId===id){
    const oldUrl=box.dataset.previewUrl;
    if(oldUrl)URL.revokeObjectURL(oldUrl);
    box.innerHTML='';
    delete box.dataset.previewId;
    delete box.dataset.previewUrl;
    return;
  }
  const ext=String(r.name||'').split('.').pop().toLowerCase();
  // Link: mở tab mới
  if(r.type==='link'){window.open(r.url,'_blank');return}
  if(!real){box.innerHTML=`<div class='folder-empty'>Tệp chưa có nội dung thật để xem trước.</div>`;return}
  // Thu hồi URL cũ nếu đang preview file khác, reset trạng thái
  const oldUrl=box.dataset.previewUrl;
  if(oldUrl)URL.revokeObjectURL(oldUrl);
  box.dataset.previewId=id;
  box.dataset.previewUrl='';
  box.innerHTML='';
  // Chỉ preview ảnh và video phổ biến, các định dạng khác tải xuống
  if(['jpg','jpeg','png','gif','webp'].includes(ext)){
    const url=URL.createObjectURL(r.blob);box.dataset.previewUrl=url;
    box.innerHTML=`<div class='res-preview'><div style='font-weight:600;margin-bottom:6px'>${esc(r.name)}</div><img src='${url}' style='max-width:100%;max-height:320px;border:1px solid var(--line);border-radius:10px'><div class='row' style='margin-top:8px;gap:8px'><button class='btn light' onclick='dlRes("${resId(r)}")'>${ic('download',16)}<span>Tải xuống</span></button></div></div>`;
    setTimeout(()=>{if(box.dataset.previewUrl===url)URL.revokeObjectURL(url);},60000);return;
  }
  if(['mp4','mov','webm','m4v','avi'].includes(ext)){
    const url=URL.createObjectURL(r.blob);box.dataset.previewUrl=url;
    box.innerHTML=`<div class='res-preview'><div style='font-weight:600;margin-bottom:6px'>${esc(r.name)}</div><video controls playsinline src='${url}' style='max-width:100%;max-height:320px;border:1px solid var(--line);border-radius:10px'></video><div class='row' style='margin-top:8px;gap:8px'><button class='btn light' onclick='dlRes("${resId(r)}")'>${ic('download',16)}<span>Tải xuống</span></button></div></div>`;
    setTimeout(()=>{if(box.dataset.previewUrl===url)URL.revokeObjectURL(url);},60000);return;
  }
  // Các định dạng khác (pdf, doc, docx, xlsx, pptx, cpp, zip,…): tải xuống
  dlRes(id);
}

/* Icon theo loại file đính kèm */
function fileIcon(ext){
  const img=['jpg','jpeg','png','gif','webp'];
  const vid=['mp4','mov','webm','m4v','avi'];
  const pdf=['pdf'];
  const doc=['doc','docx'];
  const xls=['xls','xlsx'];
  const ppt=['ppt','pptx'];
  const code=['c','cpp','h','hpp','js','ts','py','java','php','rb','go','rs','swift','kt','cs','sh','bat','sql','html','htm','css','json','xml','csv','md','txt','log','ini','yaml','yml','toml'];
  if(img.includes(ext))return 'file-image';
  if(vid.includes(ext))return 'file-video';
  if(pdf.includes(ext))return 'file-pdf';
  if(doc.includes(ext))return 'file-text';
  if(xls.includes(ext))return 'file-spreadsheet';
  if(ppt.includes(ext))return 'file-presentation';
  if(code.includes(ext))return 'file-code';
  return 'file';
}

/* Tài liệu bài học: giáo viên upload file hoặc thêm liên kết (YouTube, trò chơi…), học sinh xem/tải về */
function folderResources(c,l){
    const res=(l.res||[]).map((r,i)=>{
    const isLink=r.type==='link';
    const rid=resId(r);
    const ext=String(r.name||'').split('.').pop().toLowerCase();
    const fIcon=isLink?'link':fileIcon(ext);
    return `<div class='item' style='display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line)'>
      <span class='ic' style='width:24px;height:24px;flex:none'>${ic(fIcon,18)}</span>
      <div style='min-width:0' onclick="event.stopPropagation();previewRes('${rid}')" title='Bấm để xem trước / tải về'>
        <div style='font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>${esc(r.name)}</div>
        <div class='muted' style='font-size:.8125rem'>${isLink?'Liên kết':r.type||'Tài liệu'}${isLink?'':(' · '+r.size||'–')}</div>
      </div>
      <span class='spacer'></span>
      <!-- nút mắt xóa, preview gộp vào tên file -->
      <button class='btn light' data-iconified='1' onclick='dlRes("${rid}")' aria-label='Tải ${esc(r.name)}'>${ic('download',16)}<span class='sr'>Tải xuống</span></button>
      <button class='btn light danger-soft' onclick='folderDelRes(${i})' aria-label='Xoá ${esc(r.name)}'>${ic('trash',16)}</button>
    </div>`;
  }).join('');
  const addBtn=`<button type='button' class='btn add-res-btn' data-noicon='1' onclick='folderResMenu(event)' aria-haspopup='menu' aria-expanded='false' aria-label='Thêm tài liệu' title='Thêm tài liệu: tải tệp lên hoặc thêm liên kết'>${ic('plus',16)}<span>Thêm tài liệu</span></button>`;
  return `<section class='panel'>
    <div class='row between' style='margin-bottom:12px'><h2 style='margin:0'>Tài liệu bài học</h2><span class='row' style='gap:8px'>${addBtn}</span></div>
    <input id='resFile' class='sr' type='file' onchange='folderResPick(this.files[0])' multiple>
    <div id='resPreviewBox' style='margin:12px 0;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--fill)'></div>
    ${res||`<div class='folder-empty'>Chưa có tài liệu nào. Bấm <b>Thêm tài liệu</b> để tải tệp lên hoặc thêm liên kết.</div>`}
  </section>`;
}


/* ===== Nút (+) Thêm tài liệu: mở menu 2 lựa chọn (tải tệp lên / thêm liên kết) ===== */
let resMenuEl=null;
function resMenuClose(){
  if(!resMenuEl)return;
  resMenuEl.remove();resMenuEl=null;
  const b=document.querySelector('.add-res-btn');if(b)b.setAttribute('aria-expanded','false');
  document.removeEventListener('mousedown',resMenuOutside,true);
  document.removeEventListener('keydown',resMenuKey,true);
  window.removeEventListener('scroll',resMenuClose,true);
  window.removeEventListener('resize',resMenuClose);
}
function resMenuOutside(e){if(resMenuEl&&!resMenuEl.contains(e.target)&&!(e.target.closest&&e.target.closest('.add-res-btn')))resMenuClose()}
function resMenuKey(e){if(e.key==='Escape'){resMenuClose();const b=document.querySelector('.add-res-btn');if(b)b.focus()}}
function folderResMenu(ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(resMenuEl){resMenuClose();return}
  const btn=ev&&ev.currentTarget;
  const el=document.createElement('div');
  el.className='resmenu';el.setAttribute('role','menu');el.setAttribute('aria-label','Thêm tài liệu');
  el.innerHTML=`<button type='button' role='menuitem' onclick="resMenuClose();document.getElementById('resFile').click()">${ic('upload',16)}<span><b>Tải tệp lên</b><small>Tệp từ máy · tối đa ${'50'} MB</small></span></button>
    <button type='button' role='menuitem' onclick="resMenuClose();folderAddLink()">${ic('link',16)}<span><b>Thêm liên kết</b><small>Dán địa chỉ URL (YouTube, trang web…)</small></span></button>`;
  document.body.appendChild(el);
  /* đặt menu ngay dưới nút, luôn nằm trong khung nhìn */
  const r=btn?btn.getBoundingClientRect():{left:16,right:16,bottom:80};
  const w=Math.min(280,window.innerWidth-24);
  el.style.width=w+'px';
  let left=Math.min(Math.max(12,r.right-w),window.innerWidth-w-12);
  let top=r.bottom+8;
  const h=el.offsetHeight||112;
  if(top+h>window.innerHeight-12)top=Math.max(12,r.top-h-8);
  el.style.left=left+'px';el.style.top=top+'px';
  resMenuEl=el;
  btn&&btn.setAttribute('aria-expanded','true');
  const first=el.querySelector('button');if(first)first.focus({preventScroll:true});
  setTimeout(()=>{
    document.addEventListener('mousedown',resMenuOutside,true);
    document.addEventListener('keydown',resMenuKey,true);
    window.addEventListener('scroll',resMenuClose,true);
    window.addEventListener('resize',resMenuClose);
  },0);
}

function folderResPick(file){
  if(!file)return;
  const c=selected(),{l}=folderResolve(c);
  if(!l){toast('Hãy mở một bài học trước.');return}
  const ext=file.name.split('.').pop().toLowerCase();
  if(file.size>52428800){toast('Tệp '+fsize(file.size)+' vượt giới hạn 50 MB, bị từ chối.');return}
  if(!ALLOWED.includes(ext)){toast('Định dạng .'+ext+' không được phép. Cho phép: '+ALLOWED.join(', ')+'.');return}
  l.res=l.res||[];
  l.res.push({name:file.name,size:file.size,blob:file});
  l.upd=stamp();render();toast('Đã đính kèm tài liệu');
}

function folderAddLink(){
  const c=selected(),{l}=folderResolve(c);
  if(!l){toast('Hãy mở một bài học trước.');return}
  openDlg({title:'Thêm liên kết',text:'Nhập địa chỉ trang web (YouTube, trò chơi…). Học sinh bấm vào sẽ mở liên kết ngay.',okLabel:'Thêm liên kết',fields:[{k:'n',label:'Tên hiển thị',val:'Liên kết tham khảo'},{k:'u',label:'Địa chỉ URL',val:'https://'}],ok:v=>{
    const name=String(v.n||'').trim(),url=String(v.u||'').trim();
    if(!name)return 'Hãy nhập tên hiển thị.';
    if(!url)return 'Hãy nhập địa chỉ URL.';
    if(!/^https?:\/\//i.test(url))return 'URL phải bắt đầu bằng http:// hoặc https://.';
    l.res=l.res||[];
    l.res.push({name,type:'link',url});
    l.upd=stamp();render();toast('Đã thêm liên kết');return null}});
}

function folderDelRes(i){
  const c=selected(),{l}=folderResolve(c);
  if(!l||!l.res||!l.res[i])return;
  const r=l.res[i];
  openDlg({title:'Xóa tài liệu?',text:esc(r.name)+' sẽ không còn tải được đối với học sinh.',danger:true,okLabel:'Xóa tài liệu',ok:()=>{
    c.trash.unshift({type:'Tài liệu',name:r.name,note:'Thuộc bài học “'+esc(l.name)+'”; học sinh không còn tải được',objIdx:[],at:stamp()});
    l.res.splice(i,1);l.upd=stamp();render();toast('Đã xóa tài liệu');return null}});
}

function stuDelRes(i){
  const c=selected(),{l}=folderResolve(c);
  if(!l||!l.res||!l.res[i])return;
  const r=l.res[i];
  openDlg({title:'Xóa tài liệu?',text:esc(r.name)+' sẽ không còn tải được.',danger:true,okLabel:'Xóa tài liệu',ok:()=>{
    l.res.splice(i,1);l.upd=stamp();render();toast('Đã xóa tài liệu');return null}});
}
