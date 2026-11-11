/* EducMind · js/db/06-questions.js
   Ngân hàng câu hỏi của lớp (chỉ giáo viên): thêm, sửa, xóa câu hỏi và gắn mục tiêu.
   Quy ước lưu đáp án (máy chủ chấm tự động theo quy ước này):
     Một lựa chọn   : options = ["A","B",…], correct_answer = số thứ tự lựa chọn đúng (bắt đầu từ 0)
     Nhiều lựa chọn : correct_answer = mảng số thứ tự các lựa chọn đúng
     Đúng / Sai     : correct_answer = true hoặc false
     Trả lời ngắn, Tự luận : giáo viên chấm tay; correct_answer là đáp án tham khảo (có thể để trống) */

const DB_QKIND = { SINGLE_CHOICE: 'Một lựa chọn', MULTIPLE_CHOICE: 'Nhiều lựa chọn', TRUE_FALSE: 'Đúng / Sai', SHORT_ANSWER: 'Trả lời ngắn', ESSAY: 'Tự luận' };
const DB_QDIFF = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' };
const DB_QAUTO = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'];
const DB_QOPTIONS = 6;   // số ô lựa chọn tối đa trong biểu mẫu
const dbLetter = (i) => String.fromCharCode(65 + i);
/* Đáp án đúng ở dạng chữ để hiển thị cho giáo viên. */
function dbAnswerKeyText(q) {
  const a = q.correct_answer, opts = Array.isArray(q.options) ? q.options : [];
  if (a == null || a === '') return DB_QAUTO.includes(q.kind) ? 'Chưa có đáp án' : 'Giáo viên chấm tay';
  if (q.kind === 'TRUE_FALSE') return a === true || String(a).toLowerCase() === 'true' ? 'Đúng' : 'Sai';
  if (q.kind === 'SINGLE_CHOICE' || q.kind === 'MULTIPLE_CHOICE') return [].concat(a).map((i) => dbLetter(Number(i)) + (opts[Number(i)] != null ? '. ' + opts[Number(i)] : '')).join('; ');
  return String(a);
}
/* Câu trả lời của học sinh ở dạng chữ. */
function dbAnswerText(q, a) {
  const opts = Array.isArray(q.options) ? q.options : [];
  if (a == null || a === '' || (Array.isArray(a) && !a.length)) return '';
  if (q.kind === 'TRUE_FALSE') return a === true || String(a).toLowerCase() === 'true' ? 'Đúng' : 'Sai';
  if (q.kind === 'SINGLE_CHOICE' || q.kind === 'MULTIPLE_CHOICE') return [].concat(a).map((i) => dbLetter(Number(i)) + (opts[Number(i)] != null ? '. ' + opts[Number(i)] : '')).join('; ');
  return String(a);
}

DB_PAGES.questions = {
  title: 'Ngân hàng câu hỏi',
  sub: 'Câu hỏi dùng chung cho các bài kiểm tra của lớp. Gắn mục tiêu để kết quả được tính vào mức nắm vững.',
  async load() {
    const content = await dbLoadContent();
    const questions = DB.course ? await dbCall(EducMindDB.listQuestions(DB.course.id)) : [];
    const links = await dbCallIn(EducMindDB.listQuestionObjectives, questions.map((q) => q.id));
    return { ...content, questions, qlinks: links };
  },
  view(d) {
    if (DB.arg.edit) return dbQuestionForm(d, DB.arg.edit === 'new' ? null : d.questions.find((q) => q.id === DB.arg.edit));
    const byId = dbById(d.objectives), linksBy = dbGroup(d.qlinks, 'question_id');
    const rows = d.questions.map((q) => {
      const objs = (linksBy[q.id] || []).map((x) => byId[x.objective_id]).filter(Boolean);
      return `<tr data-kind="${h(q.kind)}" data-text="${h((q.content || '').toLowerCase())}">
        <th scope="row"><div class="db-qtext">${h(q.content)}</div><div class="muted">Đáp án: ${h(dbAnswerKeyText(q))}</div></th>
        <td>${h(DB_QKIND[q.kind] || q.kind)}</td>
        <td>${h(DB_QDIFF[q.difficulty] || q.difficulty)}</td>
        <td>${objs.length ? objs.map((o) => `<span class="db-obj-code" title="${h(o.description)}">${h(o.code)}</span>`).join(' ') : '<span class="muted">Chưa gắn</span>'}</td>
        <td class="db-cell-actions">${dbBtn('Sửa', 'go', { page: 'questions', edit: q.id }, 'light mini')}${dbBtn('Xóa', 'deleteQuestion', { id: q.id }, 'light mini danger-soft')}</td>
      </tr>`;
    });
    return `<section class="panel" aria-labelledby="db-h-q">
      <div class="row between"><div><h2 id="db-h-q">Câu hỏi của lớp</h2><p class="lead">${d.questions.length} câu hỏi</p></div>${dbBtn(ic('plus', 16) + 'Thêm câu hỏi', 'go', { page: 'questions', edit: 'new' })}</div>
      ${d.questions.length ? `<div class="row db-filter">
        <label class="sr" for="db-q-search">Tìm câu hỏi</label><input id="db-q-search" type="search" placeholder="Tìm theo nội dung" data-input="filterQuestions">
        <label class="sr" for="db-q-kind">Lọc theo dạng</label><select id="db-q-kind" data-change="filterQuestions"><option value="">Mọi dạng câu hỏi</option>${Object.entries(DB_QKIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      </div>` : ''}
      ${rows.length ? dbTable(['Câu hỏi', 'Dạng', 'Độ khó', 'Mục tiêu', '<span class="sr">Thao tác</span>'], rows, 'Ngân hàng câu hỏi') : dbEmpty('Chưa có câu hỏi nào.')}
    </section>`;
  },
};
/* Lọc ngay trên bảng đang hiển thị (không gọi máy chủ, không vẽ lại trang). */
DB_ACT.filterQuestions = () => {
  const text = (document.getElementById('db-q-search').value || '').trim().toLowerCase(), kind = document.getElementById('db-q-kind').value;
  document.querySelectorAll('#main tbody tr[data-kind]').forEach((tr) => { tr.hidden = !((!kind || tr.dataset.kind === kind) && (!text || tr.dataset.text.includes(text))); });
};

function dbQuestionForm(d, q) {
  if (DB.arg.edit !== 'new' && !q) return `<section class="panel">${dbEmpty('Không tìm thấy câu hỏi cần sửa.')}</section>`;
  const kind = q ? q.kind : 'SINGLE_CHOICE', opts = q && Array.isArray(q.options) ? q.options : [];
  const correct = new Set(q && (kind === 'SINGLE_CHOICE' || kind === 'MULTIPLE_CHOICE') && q.correct_answer != null ? [].concat(q.correct_answer).map(Number) : []);
  const tf = q && kind === 'TRUE_FALSE' ? (q.correct_answer === true || String(q.correct_answer).toLowerCase() === 'true' ? 'true' : q.correct_answer == null ? '' : 'false') : '';
  const ref = q && (kind === 'SHORT_ANSWER' || kind === 'ESSAY') && q.correct_answer != null ? String(q.correct_answer) : '';
  const picked = new Set(q ? d.qlinks.filter((x) => x.question_id === q.id).map((x) => x.objective_id) : []);
  const optionRows = Array.from({ length: DB_QOPTIONS }, (_, i) => `<div class="db-option">
      <span class="db-option-letter" aria-hidden="true">${dbLetter(i)}</span>
      <label class="sr" for="db-qo-${i}">Lựa chọn ${dbLetter(i)}</label><input id="db-qo-${i}" name="opt${i}" maxlength="500" value="${h(opts[i] == null ? '' : opts[i])}" placeholder="Nội dung lựa chọn ${dbLetter(i)}">
      <label class="db-check"><input type="checkbox" name="ok${i}" ${correct.has(i) ? 'checked' : ''}> Đúng</label>
    </div>`).join('');
  return `<section class="panel" aria-labelledby="db-h-qf">
    <h2 id="db-h-qf">${q ? 'Sửa câu hỏi' : 'Thêm câu hỏi'}</h2>
    <form data-act="saveQuestion" data-id="${h(q ? q.id : '')}" data-kind="${h(kind)}" class="db-qform" novalidate>
      ${dbField('Nội dung câu hỏi', 'db-qf-content', `<textarea id="db-qf-content" name="content" rows="3" maxlength="4000" required>${h(q ? q.content : '')}</textarea>`)}
      <div class="db-form-grid">
        ${dbField('Dạng câu hỏi', 'db-qf-kind', `<select id="db-qf-kind" name="kind" data-change="questionKind" data-apply>${Object.entries(DB_QKIND).map(([k, v]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${dbField('Độ khó', 'db-qf-diff', `<select id="db-qf-diff" name="difficulty">${Object.entries(DB_QDIFF).map(([k, v]) => `<option value="${k}" ${(q ? q.difficulty : 'MEDIUM') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
      </div>
      <div class="field db-only" data-for="SINGLE_CHOICE MULTIPLE_CHOICE">
        <span class="db-label">Các lựa chọn</span>
        <div class="muted db-hint">Bỏ trống ô không dùng. Đánh dấu “Đúng” cho lựa chọn đúng (một lựa chọn: đúng một ô; nhiều lựa chọn: một hoặc nhiều ô).</div>
        ${optionRows}
      </div>
      <div class="db-only" data-for="TRUE_FALSE">${dbField('Đáp án đúng', 'db-qf-tf', `<select id="db-qf-tf" name="tf"><option value="">Chọn đáp án</option><option value="true" ${tf === 'true' ? 'selected' : ''}>Đúng</option><option value="false" ${tf === 'false' ? 'selected' : ''}>Sai</option></select>`)}</div>
      <div class="db-only" data-for="SHORT_ANSWER ESSAY">${dbField('Đáp án tham khảo (không bắt buộc)', 'db-qf-ref', `<textarea id="db-qf-ref" name="ref" rows="2" maxlength="2000">${h(ref)}</textarea>`, 'Câu trả lời ngắn và tự luận do giáo viên chấm tay. Học sinh không nhìn thấy đáp án tham khảo.')}</div>
      <div class="field"><span class="db-label">Mục tiêu mà câu hỏi đánh giá</span>${dbObjectivePicker(d, 'objectives', picked)}</div>
      ${dbFormError()}
      <div class="row db-form-actions">${dbBtn('Hủy', 'go', { page: 'questions' }, 'light')}<button type="submit" class="btn">${q ? 'Lưu thay đổi' : 'Thêm câu hỏi'}</button></div>
    </form>
  </section>`;
}
/* Đổi dạng câu hỏi: chỉ đổi thuộc tính data-kind của biểu mẫu, CSS tự hiện đúng phần đáp án (không vẽ lại, không mất nội dung đã nhập). */
DB_ACT.questionKind = (el) => { el.closest('form').dataset.kind = el.value; };
/* Đọc biểu mẫu câu hỏi thành dòng dữ liệu của bảng questions. */
function dbReadQuestion(v) {
  if (!v.content) throw new Error('Nhập nội dung câu hỏi.');
  const row = { content: v.content, kind: v.kind, difficulty: v.difficulty || 'MEDIUM', options: [], correct_answer: null };
  if (v.kind === 'SINGLE_CHOICE' || v.kind === 'MULTIPLE_CHOICE') {
    const right = [];
    for (let i = 0; i < DB_QOPTIONS; i++) {
      const text = v['opt' + i];
      if (!text) { if (v['ok' + i]) throw new Error('Lựa chọn ' + dbLetter(i) + ' được đánh dấu đúng nhưng chưa có nội dung.'); continue; }
      if (v['ok' + i]) right.push(row.options.length);
      row.options.push(text);
    }
    if (row.options.length < 2) throw new Error('Cần ít nhất hai lựa chọn.');
    if (!right.length) throw new Error('Đánh dấu lựa chọn đúng.');
    if (v.kind === 'SINGLE_CHOICE' && right.length !== 1) throw new Error('Câu một lựa chọn chỉ có đúng một đáp án đúng.');
    row.correct_answer = v.kind === 'SINGLE_CHOICE' ? right[0] : right;
  } else if (v.kind === 'TRUE_FALSE') {
    if (v.tf !== 'true' && v.tf !== 'false') throw new Error('Chọn đáp án đúng (Đúng hoặc Sai).');
    row.correct_answer = v.tf === 'true';
  } else row.correct_answer = v.ref ? v.ref : null;
  return row;
}
DB_ACT.saveQuestion = (form) => dbRun(form, async (v) => {
  const id = form.dataset.id, row = dbReadQuestion(v);
  const course = await dbEnsureCourse();
  const q = id ? await dbCall(EducMindDB.updateQuestion(id, row)) : await dbCall(EducMindDB.createQuestion({ ...row, course_id: course.id }));
  const current = id ? DB.data.qlinks.filter((x) => x.question_id === id).map((x) => x.objective_id) : [];
  await dbSyncLinks(current, v.objectives || [],
    (add) => dbCall(EducMindDB.addQuestionObjectives(add.map((o) => ({ question_id: q.id, objective_id: o })))),
    (rem) => dbCall(EducMindDB.removeQuestionObjectives(q.id, rem)));
  toast(id ? 'Đã lưu câu hỏi.' : 'Đã thêm câu hỏi vào ngân hàng.');
  await dbGo('questions', {});
  return false;
});
DB_ACT.deleteQuestion = (el) => {
  const q = DB.data.questions.find((x) => x.id === el.dataset.id);
  dbConfirm('Xóa câu hỏi?', 'Câu hỏi sẽ bị ẩn khỏi ngân hàng và không còn xuất hiện trong đề của các lượt làm mới. Kết quả của các lượt đã làm vẫn được giữ.', 'Xóa câu hỏi', async () => {
    await dbCall(EducMindDB.updateQuestion(q.id, { deleted_at: new Date().toISOString() }));
    toast('Đã xóa câu hỏi.');
  }, true);
};
