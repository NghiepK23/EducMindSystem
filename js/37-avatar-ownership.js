/* EducMind · js/37-avatar-ownership.js
   Ảnh đại diện, người phụ trách lớp (owns) và phạm vi chủ đề / bài học. */
/* ===== Đợt 10: gợi ý trỏ nội dung đích (S06), đếm ngược lượt làm (S03), phạm vi bài kiểm tra (T06),
   nhiều giáo viên và phân quyền (T01, T02A, T07), tải tài liệu thật (S01) ===== */
let flashId=null,cdWarn=0;
const initials=()=>acctName().split(' ').filter(Boolean).map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?';
/* Ảnh đại diện: chữ viết tắt + bộ màu, hoặc ảnh người dùng tải lên */
const AV_THEMES=[['default','Mặc định'],['blue','Xanh dương'],['green','Xanh lá'],['violet','Tím'],['amber','Hổ phách'],['rose','Hồng']];
const AV_KEYS=AV_THEMES.map(x=>x[0]);
const acctRec=()=>sess?(ACCT[sess.email]||(ACCT[sess.email]={})):null;
const avOf=()=>{const a=acctRec();return (a&&a.avatar)||{}};
const avatarStorageKey=()=>`educmind.avatar:${String((sess&&sess.email)||'guest').toLowerCase()}`;
function avatarPhotoData(){
  if(sess&&!sess.backend){const av=avOf();if(av.photo)return av.photo}
  try{return localStorage.getItem(avatarStorageKey())||''}catch(e){return ''}
}
function avatarHtml(big){
  const av=avOf(),photo=avatarPhotoData(),cls='avatar'+(AV_KEYS.includes(av.theme)&&av.theme!=='default'?' av-'+av.theme:'');
  const st=big?" style='width:44px;height:44px;font-size:1rem;flex:none'":'';
  return `<span class='${cls}'${st} aria-hidden='true'>${photo?`<img src='${esc(photo)}' alt=''>`:initials()}</span>`;
}
function avatarPickerHtml(avatar){
  return `<button type='button' class='avatar-pick' aria-label='Đổi ảnh đại diện' title='Đổi ảnh đại diện' onclick="document.getElementById('avatar-upload').click()">${avatar}</button><input id='avatar-upload' type='file' accept='image/png,image/jpeg,image/webp,image/gif' hidden onchange='uploadAvatar(this.files&&this.files[0]);this.value=""'>`;
}
function uploadAvatar(file){
  if(!file)return;
  if(!/^image\/(png|jpeg|webp|gif)$/i.test(file.type)){toast('Hãy chọn ảnh PNG, JPG, WEBP hoặc GIF.');return}
  if(file.size>15*1024*1024){toast('Ảnh đại diện cần nhỏ hơn 15 MB.');return}
  const reader=new FileReader();reader.onerror=()=>toast('Không đọc được tệp ảnh.');
  reader.onload=()=>{const img=new Image();img.onerror=()=>toast('Tệp này không phải ảnh hợp lệ.');img.onload=()=>{
    try{
      const size=512,scale=Math.min(1,size/img.naturalWidth,size/img.naturalHeight),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale)),canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;const cx=canvas.getContext('2d');cx.fillStyle='#fff';cx.fillRect(0,0,w,h);cx.drawImage(img,0,0,w,h);
      const photo=canvas.toDataURL('image/jpeg',.84);
      localStorage.setItem(avatarStorageKey(),photo);
      const a=sess&&!sess.backend?acctRec():null;if(a)a.avatar=Object.assign({},a.avatar||{},{photo});
      render();toast('Đã cập nhật ảnh đại diện trên thiết bị này.');
    }catch(e){toast('Không lưu được ảnh đại diện. Hãy thử ảnh khác hoặc giải phóng dung lượng trình duyệt.')}
  };img.src=String(reader.result||'')};reader.readAsDataURL(file)
}
const ownerName=c=>(ACCT[c.owner]||{}).name||c.owner;
const owns=c=>!!c&&!!sess&&sess.role==='T'&&c.owner===sess.email;
/* Phạm vi có thể được lưu dạng chuỗi ở dữ liệu cũ; chuẩn hoá về dạng {type,…} khi đọc. */
function scopeObj(c,s){
  if(!s||typeof s!=='string')return s;
  const t=s.trim();
  if(t==='Cả lớp'||t==='')return {type:'course'};
  if(t.indexOf('Chủ đề: ')===0){const x=c.topics.find(k=>k.title===t.slice(8));if(x)return {type:'topic',id:x.id}}
  if(t==='Một chủ đề'&&c.topics[0])return {type:'topic',id:c.topics[0].id};
  if(t.indexOf('Bài học: ')===0){const x=c.lessonsData.find(k=>k.name===t.slice(9));if(x)return {type:'lesson',ref:x}}
  if(t==='Một bài học'&&c.lessonsData[0])return {type:'lesson',ref:c.lessonsData[0]};
  return {type:'course'};
}
const scopeLbl=(c,sc)=>{const s=scopeObj(c,sc);return !s||s.type==='course'?'Cả lớp':s.type==='topic'?'Chủ đề: '+((c.topics.find(t=>t.id===s.id)||{title:'(đã xóa)'}).title):'Bài học: '+(s.ref?s.ref.name:'(đã xóa)')};
