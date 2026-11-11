/* EducMind · js/42-recommendations-required.js
   Gợi ý bắt buộc: trang Gợi ý của học sinh, bật / tắt “cho phép bỏ qua” theo lớp. */
/* ===== Đợt 6: gợi ý bắt buộc, khóa màn hình kiểm tra, nhập câu hỏi/học sinh từ tệp ===== */

/* --- 1. Gợi ý học tập: mặc định bắt buộc làm; giáo viên bật/tắt “cho phép bỏ qua” theo lớp --- */
function recActionLabel(x){
  const t=x&&x[4];if(!t)return '';
  if(t.kind==='lesson')return 'Mở bài học';
  if(t.kind==='cres')return 'Mở tài liệu';
  if(t.kind==='assessment')return 'Làm bài kiểm tra';
  if(t.kind==='assignment'){
    const a=selected().assignments[t.i];
    return !a?'Mở gợi ý':a.gameMode==='survival'?'Chọn cách chơi':asgIsQ(a)?'Bắt đầu luyện tập':'Mở bài nộp';
  }
  return 'Thực hiện gợi ý';
}
function recIcon(x){
  const t=x&&x[4];if(t&&t.kind==='lesson')return ic('lessons',17);
  if(t&&t.kind==='assignment')return ic(selected().assignments[t.i]?.gameMode==='survival'?'play':'assignments',17);
  if(t&&t.kind==='assessment')return ic('assessments',17);
  if(t&&t.kind==='cres')return ic('file',17);
  return ic('arrow',17);
}
function sRecs(){
  const c=selected(),L=activeRecs(c,me()),sk=!!c.recSkip;
  return `<section class='panel student-recommendations' aria-labelledby='h-sg'><header class='student-recs-header'><div><span class='student-page-eyebrow'>LỘ TRÌNH CÁ NHÂN</span><h2 id='h-sg'>Gợi ý học tập</h2><p>${sk?'Chọn một gợi ý để bắt đầu ngay, hoặc để lại thực hiện sau.':'Hãy bắt đầu từ gợi ý phù hợp với mục tiêu của em; nội dung sẽ mở trực tiếp.'}</p></div><span class='student-recs-count'>${L.length}<small>${L.length===1?'gợi ý':'gợi ý'}</small></span></header>${L.length?`<div class='student-recs-list'>${L.map((x,i)=>`<article class='student-rec-card'><div class='student-rec-symbol ${x[1]}' aria-hidden='true'>${ic(x[0]==='Ôn lại nội dung'?'lessons':x[0]==='Làm lại bài kiểm tra'?'refresh':x[0]==='Hoạt động nâng cao'?'spark':'target',20)}</div><div class='student-rec-content'><div class='student-rec-labels'><span class='pill ${x[1]}'>${esc(x[0])}</span>${!sk&&x[4]?`<span class='pill need'>Cần hoàn thành</span>`:''}</div><h3>${esc(x[2])}</h3><p>${esc(SR[x[0]]||x[3])}</p>${x[4]?`<div class='student-rec-target'><span>Nội dung đề xuất</span><b>${esc(x[4].label)}</b></div>`:`<div class='student-rec-finished'>Em đã làm các hoạt động hiện có cho mục tiêu này. Hãy tiếp tục phát huy!</div>`}</div><div class='student-rec-actions'>${x[4]?`<button type='button' class='btn student-rec-primary' data-noicon='1' onclick='recAct(${i},true)'>${recIcon(x)}<span>${recActionLabel(x)}</span>${ic('arrow',15)}</button>`:sk?`<button type='button' class='btn student-rec-primary' data-noicon='1' onclick='recAct(${i},true)'>${ic('check',16)}<span>Đã nắm rõ</span></button>`:''}${sk?`<button type='button' class='btn light student-rec-later' data-noicon='1' onclick='recAct(${i},false)'>${ic('clock',15)}<span>Để sau</span></button>`:''}</div></article>`).join('')}</div>`:`<div class='student-recs-empty'><span aria-hidden='true'>✨</span><h3>Chưa có gợi ý mới</h3><p>Khi có mục tiêu cần củng cố hoặc hoạt động nâng cao, gợi ý sẽ xuất hiện tại đây.</p></div>`}</section>`;
}
function recAct(i,acc){
  const c=selected(),s=me(),x=activeRecs(c,s)[i];if(!x)return;
  if(!acc&&!c.recSkip){toast('Gợi ý này cần được hoàn thành. Hãy chọn nút hành động để mở nội dung.');return}
  const key=x[0]+'|'+x[2];
  if(acc)markRecKeys(s,[key],'opened');
  else if(c.recSkip){s.rs=s.rs||{};s.rs[key]={t:'D',day:lastEv(s),source:'deferred'}}
  if(acc&&x[4]){const label=recActionLabel(x);openTarget(x[4]);toast('Đã mở bước tiếp theo: '+label+'.');return}
  render();toast(acc?'Đã ghi nhận gợi ý.':'Đã để gợi ý lại sau.');
}
function recSkipCtl(c){
  return `<div class='item' style='margin-bottom:12px'><div><b>Cho phép học sinh bỏ qua gợi ý</b><div class='muted'>${c.recSkip?'Đang bật: học sinh có thể chấp nhận hoặc bỏ qua từng gợi ý.':'Đang tắt: học sinh phải làm nội dung được gợi ý, không có nút “Bỏ qua”.'}</div></div><label class='row' style='gap:8px'><input type='checkbox' role='switch' ${c.recSkip?'checked':''} onchange='setRecSkip(this.checked)'> ${c.recSkip?'Cho phép bỏ qua':'Bắt buộc làm'}</label></div>`;
}
function setRecSkip(v){
  const c=selected();if(!owns(c)){toast('Bị từ chối: lớp này không do bạn phụ trách.');render();return}
  c.recSkip=v;
  if(!v)c.students.forEach(s=>Object.keys(s.rs).forEach(k=>{if(s.rs[k].t==='D')delete s.rs[k]}));
  render();toast(v?'Đã cho phép học sinh bỏ qua gợi ý.':'Học sinh bắt buộc làm gợi ý; các gợi ý từng bị bỏ qua được mở lại.');
}
const _rec0=recommend;
window.recommend=function(){const c=selected();return _rec0().replace('<div class="tablewrap">',recSkipCtl(c)+'<div class="tablewrap">')};
