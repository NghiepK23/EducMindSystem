/* EducMind · js/71-classes-page.js
   Trang Lớp học phụ trách: thẻ lớp, sửa / xóa lớp, ô tạo lớp mới. */
/* ===== Lớp phụ trách: thẻ lớp có thao tác ngay trong thẻ và ô tạo lớp mới ===== */
function classEditAt(id){current=id;editClass()}
function classDeleteAt(id){current=id;delClass()}

/* Bấm một chỉ số trên thẻ lớp: chọn lớp đó rồi mở đúng màn tương ứng */
function classStat(cid,pg){
  if(!visClasses().some(x=>x.id===cid)){toast('Lớp '+cid+' không thuộc quyền của bạn.');return}
  current=cid;
  if(pg==='overview'){folderTopicId=null;folderLessonName=null;folderModule='goals'}
  if(pg==='assessments'){setPage('assignments');if(typeof asgTabSet==='function')asgTabSet('quiz');window.scrollTo(0,0);return}
  setPage(pg);
}

function classPage(){
  const L=visClasses();
  const cards=L.map(c=>{
    const nAsg=(c.assignments||[]).filter(a=>(a.status||'Đã xuất bản')==='Đã xuất bản').length;
    const nQuiz=(!c.quiz||c.quiz.deleted)?0:1;
    return `<article class='classcard ${c.id===current?'selected':''}' id='cc-${esc(c.id)}'>
      <div class='classcard-top'><span class='classcard-name'><b>${esc(c.id)}</b></span><span class='classcard-actions'><button class='btn light mini' onclick="classEditAt('${esc(c.id)}')" aria-label='Sửa lớp ${esc(c.id)}' title='Sửa lớp'>${ic('edit',16)}Sửa</button><button class='btn light mini' onclick="classDeleteAt('${esc(c.id)}')" aria-label='Xóa lớp ${esc(c.id)}' title='Xóa lớp'>${ic('trash',16)}Xóa</button></span></div>
      <div class='classcard-meta'>
        <button type='button' class='cc-link' onclick="classStat('${esc(c.id)}','students')" aria-label='${c.count} học sinh của lớp ${esc(c.id)}'><b>${c.count}</b> học sinh</button>
      </div>
      <div class='classcard-meta'>
        <button type='button' class='cc-link' onclick="classStat('${esc(c.id)}','overview')" aria-label='${c.lessonsData.length} bài học của lớp ${esc(c.id)}'><b>${c.lessonsData.length}</b> bài học</button><span class='cc-dot'>·</span><button type='button' class='cc-link' onclick="classStat('${esc(c.id)}','assignments')" aria-label='${nAsg} bài tập của lớp ${esc(c.id)}'><b>${nAsg}</b> bài tập</button><span class='cc-dot'>·</span><button type='button' class='cc-link' onclick="classStat('${esc(c.id)}','assessments')" aria-label='${nQuiz} bài kiểm tra của lớp ${esc(c.id)}'><b>${nQuiz}</b> bài kiểm tra</button>
      </div>
    </article>`;}).join('');
  return `<section class='panel' aria-labelledby='h-cls'><div class='row between'><div><h2 id='h-cls'>Danh sách lớp phụ trách</h2><p class='lead' style='margin:4px 0 0'>${L.length} lớp · chọn một thẻ để mở lớp; sửa hoặc xóa ngay trên thẻ tương ứng.</p></div></div><div class='classgrid'>${cards}<button type='button' class='classcard classcard-create' onclick='newClass()' aria-label='Tạo lớp mới' title='Tạo lớp mới'><span class='create-plus'>${ic('plus',25)}</span></button></div></section>`;
}
function classPage2(){return classPage()}
