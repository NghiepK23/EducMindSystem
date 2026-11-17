/* EducMind · js/db/06-questions.js
   Ngân hàng câu hỏi của lớp (chỉ giáo viên): thêm, sửa, xóa câu hỏi và gắn mục tiêu.
   Quy ước lưu đáp án (máy chủ chấm tự động theo quy ước này):
     Một lựa chọn   : options = ["A","B",…], correct_answer = số thứ tự lựa chọn đúng (bắt đầu từ 0)
     Nhiều lựa chọn : correct_answer = mảng số thứ tự các lựa chọn đúng
     Đúng / Sai     : correct_answer = true hoặc false
     Trả lời ngắn, Tự luận : giáo viên chấm tay; correct_answer là đáp án tham khảo (có thể để trống) */

const DB_QKIND = { SINGLE_CHOICE: 'Một lựa chọn', MULTIPLE_CHOICE: 'Nhiều lựa chọn', TRUE_FALSE: 'Đúng / Sai', SHORT_ANSWER: 'Trả lời ngắn', ESSAY: 'Tự luận' };
const DB_QDIFF = { EASY: 'Dễ', MEDIUM: 'Trung bình', HARD: 'Khó' };
/* Phân loại theo khối (3–12) và cấp độ tư duy Bloom. */
const DB_QBLOOM = { REMEMBER: 'Nhớ', UNDERSTAND: 'Hiểu', APPLY: 'Vận dụng', ANALYZE: 'Phân tích', EVALUATE: 'Đánh giá', CREATE: 'Sáng tạo' };
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
  sub: 'Câu hỏi dùng cho bài kiểm tra và bài tập của lớp. Gắn mục tiêu để kết quả được tính vào mức nắm vững.',
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
      return `<tr data-kind="${h(q.kind)}" data-grade="${h(q.grade == null ? '' : q.grade)}" data-bloom="${h(q.bloom_level || '')}" data-text="${h((q.content || '').toLowerCase())}">
        <th scope="row"><div class="db-qtext">${h(q.content)}</div><div class="muted">Đáp án: ${h(dbAnswerKeyText(q))}</div></th>
        <td>${h(DB_QKIND[q.kind] || q.kind)}</td>
        <td>${h(DB_QDIFF[q.difficulty] || q.difficulty)}</td>
        <td>${q.grade ? 'Khối ' + q.grade : '<span class="muted">—</span>'}</td>
        <td>${q.bloom_level ? h(DB_QBLOOM[q.bloom_level] || q.bloom_level) : '<span class="muted">—</span>'}</td>
        <td>${objs.length ? objs.map((o) => `<span class="db-obj-code" title="${h(o.description)}">${h(o.code)}</span>`).join(' ') : '<span class="muted">Chưa gắn</span>'}</td>
        <td class="db-cell-actions">${dbBtn('Sửa', 'go', { page: 'questions', edit: q.id }, 'light mini')}${dbBtn('Xóa', 'deleteQuestion', { id: q.id }, 'light mini danger-soft')}</td>
      </tr>`;
    });
    return `<section class="panel" aria-labelledby="db-h-q">
      <div class="row between"><div><h2 id="db-h-q">Câu hỏi của lớp</h2><p class="lead">${d.questions.length} câu hỏi</p></div>
        <div class="row">${dbBtn('Xuất Excel', 'exportQuestions', {}, 'light')}</div></div>
      <div class="db-create-source" aria-label="Chọn cách tạo câu hỏi">
        <article class="db-create-source-card">
          <h3>Nhập từ Excel hoặc Word</h3>
          <p class="muted">Tải tệp mẫu, điền câu hỏi rồi xem lại trước khi nhập. Hỗ trợ .xlsx, .xls, .csv và .docx.</p>
          <form data-act="importQuestionFile" class="db-import-source" novalidate>
            <label class="db-label" for="db-q-import">Chọn tệp câu hỏi</label>
            <input type="file" id="db-q-import" name="file" accept=".xlsx,.xls,.csv,.docx" class="db-input-file" aria-label="Chọn tệp câu hỏi Excel hoặc Word">
            <div class="row db-source-actions">
              <button type="button" class="btn light" onclick="impTemplate('questions')">Tải mẫu Excel</button>
              <button type="button" class="btn light" onclick="impTemplateWord('questions')">Tải mẫu Word</button>
              <button type="submit" class="btn">Xem và nhập</button>
            </div>
            ${dbFormError()}
          </form>
        </article>
        <article class="db-create-source-card">
          <h3>Soạn câu hỏi thủ công</h3>
          <p class="muted">Tự nhập nội dung, đáp án, độ khó và mục tiêu cho từng câu.</p>
          ${dbBtn(ic('plus', 16) + 'Thêm câu hỏi', 'go', { page: 'questions', edit: 'new' })}
        </article>
        <article class="db-create-source-card">
          <h3>Từ giáo án với AI</h3>
          <p class="muted">Tải giáo án hoặc dán nội dung để Gemini đề xuất câu hỏi nháp. Bạn duyệt trước khi lưu.</p>
          ${dbBtn(ic('spark', 16) + 'Tạo từ giáo án', 'go', { page: 'ai', source: 'plan' }, 'light')}
        </article>
      </div>
      ${d.questions.length ? `<div class="row db-filter">
        <label class="sr" for="db-q-search">Tìm câu hỏi</label><input id="db-q-search" type="search" placeholder="Tìm theo nội dung" data-input="filterQuestions">
        <label class="sr" for="db-q-kind">Lọc theo dạng</label><select id="db-q-kind" data-change="filterQuestions"><option value="">Mọi dạng câu hỏi</option>${Object.entries(DB_QKIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <label class="sr" for="db-q-grade">Lọc theo khối</label><select id="db-q-grade" data-change="filterQuestions"><option value="">Mọi khối</option>${educmindGradeOptions()}</select>
        <label class="sr" for="db-q-bloom">Lọc theo Bloom</label><select id="db-q-bloom" data-change="filterQuestions"><option value="">Mọi cấp độ Bloom</option>${Object.entries(DB_QBLOOM).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      </div>` : ''}
      ${rows.length ? dbTable(['Câu hỏi', 'Dạng', 'Độ khó', 'Khối', 'Bloom', 'Mục tiêu', '<span class="sr">Thao tác</span>'], rows, 'Ngân hàng câu hỏi') : dbEmpty('Chưa có câu hỏi nào.')}
    </section>`;
  },
};
/* Lọc ngay trên bảng đang hiển thị (không gọi máy chủ, không vẽ lại trang). */
DB_ACT.filterQuestions = () => {
  const text = (document.getElementById('db-q-search').value || '').trim().toLowerCase(), kind = document.getElementById('db-q-kind').value,
    grade = document.getElementById('db-q-grade').value, bloom = document.getElementById('db-q-bloom').value;
  document.querySelectorAll('#main tbody tr[data-kind]').forEach((tr) => {
    tr.hidden = !((!kind || tr.dataset.kind === kind) && (!grade || tr.dataset.grade === grade) && (!bloom || tr.dataset.bloom === bloom) && (!text || tr.dataset.text.includes(text)));
  });
};

function dbQuestionForm(d, q) {
  if (DB.arg.edit !== 'new' && !q) return `<section class="panel">${dbEmpty('Không tìm thấy câu hỏi cần sửa.')}</section>`;
  const returnToAssignment = DB.arg.return_to === 'assignment' && DB.arg.assignment_id;
  const cancelTarget = returnToAssignment ? { page: 'assignments', id: DB.arg.assignment_id } : { page: 'questions' };
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
      <div class="db-form-grid">
        ${dbField('Khối', 'db-qf-grade', `<select id="db-qf-grade" name="grade"><option value="">Chưa chọn</option>${educmindGradeOptions(q && q.grade)}</select>`, 'Khối lớp áp dụng cho câu hỏi (tùy chọn).')}
        ${dbField('Cấp độ Bloom', 'db-qf-bloom', `<select id="db-qf-bloom" name="bloom_level"><option value="">Chưa chọn</option>${Object.entries(DB_QBLOOM).map(([k, v]) => `<option value="${k}" ${(q ? q.bloom_level : '') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`, 'Mức tư duy mà câu hỏi đánh giá (tùy chọn).')}
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
      <div class="row db-form-actions">${dbBtn('Hủy', 'go', cancelTarget, 'light')}<button type="submit" class="btn">${q ? 'Lưu thay đổi' : 'Thêm câu hỏi'}</button></div>
    </form>
  </section>`;
}
/* Đổi dạng câu hỏi: chỉ đổi thuộc tính data-kind của biểu mẫu, CSS tự hiện đúng phần đáp án (không vẽ lại, không mất nội dung đã nhập). */
DB_ACT.questionKind = (el) => { el.closest('form').dataset.kind = el.value; };
/* Đọc biểu mẫu câu hỏi thành dòng dữ liệu của bảng questions. */
function dbReadQuestion(v) {
  if (!v.content) throw new Error('Nhập nội dung câu hỏi.');
  const grade = v.grade ? Number(v.grade) : null;
  if (grade != null && !educmindGradeIsValid(grade)) throw new Error(`Khối phải là số từ ${EDUCMIND_GRADE_MIN} đến ${EDUCMIND_GRADE_MAX}.`);
  const row = { content: v.content, kind: v.kind, difficulty: v.difficulty || 'MEDIUM', options: [], correct_answer: null, grade, bloom_level: v.bloom_level || null };
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
function dbQuestionImportPick(o, names) {
  for (const name of names) {
    const value = o[nz(name)];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}
function dbQuestionObjectiveCode(code) {
  return String(code || '').trim().toUpperCase();
}
function dbQuestionObjectiveCodeKey(code) {
  return dbQuestionObjectiveCode(code).replace(/^LO0+(?=\d+$)/, 'LO');
}
function dbParseQuestionImportRows(rows, lessonId) {
  if (!rows.length || !rows[0].some((x) => String(x).trim())) throw new Error('Tệp không có hàng tiêu đề.');
  const headers = rows[0].map((x) => nz(x));
  const objects = rows.slice(1).map((cells) => Object.fromEntries(headers.map((key, i) => [key, cells[i] == null ? '' : cells[i]])));
  const kindByText = Object.fromEntries([
    ...Object.entries(DB_QKIND).map(([key, value]) => [nz(value), key]),
    ...Object.keys(DB_QKIND).map((key) => [nz(key), key]),
  ]);
  const diffByText = Object.fromEntries(Object.entries(DB_QDIFF).map(([key, value]) => [nz(value), key]));
  const bloomByText = Object.fromEntries(Object.entries(DB_QBLOOM).map(([key, value]) => [nz(value), key]));
  const objectiveByCode = new Map(), objectivesByCodeKey = new Map();
  const addObjective = (map, code, id) => {
    if (!map.has(code)) map.set(code, new Set());
    map.get(code).add(id);
  };
  (DB.data.objectives || []).filter((o) => !lessonId || o.lesson_id === lessonId).forEach((o) => {
    const code = dbQuestionObjectiveCode(o.code);
    if (!code || !o.id) return;
    addObjective(objectiveByCode, code, o.id);
    addObjective(objectivesByCodeKey, dbQuestionObjectiveCodeKey(code), o.id);
  });
  const parsed = [], skipped = [], unknownCodes = new Set(), ambiguousCodes = new Set();
  objects.forEach((o, i) => {
    try {
      const content = dbQuestionImportPick(o, ['nội dung', 'nội dung câu hỏi', 'content', 'câu hỏi']);
      if (!content) throw new Error('thiếu nội dung');
      if (content.length > 4000) throw new Error('nội dung dài quá 4.000 ký tự');
      const answer = dbQuestionImportPick(o, ['đáp án', 'đáp án đúng', 'correct', 'correct answer']);
      let options = dbQuestionImportPick(o, ['lựa chọn', 'các lựa chọn', 'options'])
        .split(/\n|\|/).map((x) => x.trim()).filter(Boolean);
      if (!options.length) {
        options = ['A', 'B', 'C', 'D', 'E', 'F'].map((letter) =>
          dbQuestionImportPick(o, ['đáp án ' + letter, 'lựa chọn ' + letter, 'option ' + letter]));
        options = options.filter(Boolean);
      }
      const answerParts = answer.split(/[,;|]|\bvà\b|\band\b/i).map((x) => x.trim()).filter(Boolean);
      const rawKind = dbQuestionImportPick(o, ['dạng', 'dạng câu hỏi', 'loại', 'kind']).toLowerCase();
      const kindAliases = {
        'single choice': 'SINGLE_CHOICE', 'multiple choice': 'MULTIPLE_CHOICE',
        'trac nghiem': answerParts.length > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE',
        'trac nghiem mot lua chon': 'SINGLE_CHOICE', 'trac nghiem nhieu lua chon': 'MULTIPLE_CHOICE',
        'dung sai': 'TRUE_FALSE', 'true false': 'TRUE_FALSE',
        'tra loi ngan': 'SHORT_ANSWER', 'short answer': 'SHORT_ANSWER', 'tu luan': 'ESSAY', 'essay': 'ESSAY',
      };
      let kind = DB_QKIND[rawKind] ? rawKind : (kindByText[nz(rawKind)] || kindAliases[nz(rawKind)]);
      if (!kind) {
        if (options.length >= 2) kind = answerParts.length > 1 ? 'MULTIPLE_CHOICE' : 'SINGLE_CHOICE';
        else if (/^(đúng|sai|true|false)$/i.test(answer)) kind = 'TRUE_FALSE';
        else kind = answer ? 'SHORT_ANSWER' : 'ESSAY';
      }
      const answerIndex = (x) => {
        const token = x.trim().toUpperCase();
        return /^[A-Z]$/.test(token) ? token.charCodeAt(0) - 65 : (/^\d+$/.test(token) ? Number(token) - 1 : -1);
      };
      let correct_answer = null;
      if (kind === 'SINGLE_CHOICE' || kind === 'MULTIPLE_CHOICE') {
        if (options.length < 2 || options.length > DB_QOPTIONS) throw new Error('cần từ 2 đến ' + DB_QOPTIONS + ' lựa chọn');
        const indices = answerParts.map(answerIndex);
        if (!indices.length || indices.some((x) => x < 0 || x >= options.length)) throw new Error('đáp án cần là chữ cái đúng (ví dụ A hoặc A, C)');
        if (kind === 'SINGLE_CHOICE' && indices.length !== 1) throw new Error('câu một lựa chọn chỉ được có một đáp án đúng');
        correct_answer = kind === 'SINGLE_CHOICE' ? indices[0] : [...new Set(indices)];
        if (kind === 'MULTIPLE_CHOICE' && correct_answer.length < 2) throw new Error('câu nhiều lựa chọn cần ít nhất hai đáp án đúng');
      } else if (kind === 'TRUE_FALSE') {
        if (!/^(đúng|sai|true|false)$/i.test(answer)) throw new Error('đáp án Đúng/Sai không hợp lệ');
        correct_answer = /^(đúng|true)$/i.test(answer);
        options = [];
      } else {
        options = [];
        correct_answer = answer || null;
      }
      const diffRaw = dbQuestionImportPick(o, ['độ khó', 'difficulty']);
      const difficulty = diffByText[nz(diffRaw)] || (DB_QDIFF[diffRaw.toUpperCase()] ? diffRaw.toUpperCase() : 'MEDIUM');
      const bloomRaw = dbQuestionImportPick(o, ['mức bloom', 'cấp độ bloom', 'bloom', 'bloom_level']);
      const bloom = bloomByText[nz(bloomRaw)] || (DB_QBLOOM[bloomRaw.toUpperCase()] ? bloomRaw.toUpperCase() : null);
      const gradeRaw = dbQuestionImportPick(o, ['khối', 'grade']);
      const grade = gradeRaw ? Number(gradeRaw) : null;
      if (grade != null && !educmindGradeIsValid(grade)) throw new Error(`khối phải là số từ ${EDUCMIND_GRADE_MIN} đến ${EDUCMIND_GRADE_MAX}`);
      const codes = dbQuestionImportPick(o, ['mục tiêu', 'mã mục tiêu', 'objectives']).split(/[,;|]/).map((x) => x.trim().toUpperCase()).filter(Boolean);
      const objectiveIds = [...new Set(codes.map((code) => {
        const matches = objectiveByCode.get(dbQuestionObjectiveCode(code)) || objectivesByCodeKey.get(dbQuestionObjectiveCodeKey(code));
        if (!matches || !matches.size) { unknownCodes.add(code); return null; }
        if (matches.size > 1) { ambiguousCodes.add(code); return null; }
        return matches.values().next().value;
      }).filter(Boolean))];
      parsed.push({
        row: { course_id: DB.course.id, content, kind, difficulty, grade, bloom_level: bloom, options, correct_answer },
        objectiveIds,
      });
    } catch (e) {
      skipped.push('Dòng ' + (i + 2) + ': ' + (e.message || 'dữ liệu không hợp lệ'));
    }
  });
  if (parsed.length > 200) throw new Error('Tệp có ' + parsed.length + ' câu hợp lệ; mỗi lần nhập tối đa 200 câu.');
  return { parsed, skipped, unknownCodes: [...unknownCodes], ambiguousCodes: [...ambiguousCodes] };
}
async function dbReadQuestionImport(file, lessonId) {
  if (!file) throw new Error('Hãy chọn tệp câu hỏi.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Tệp vượt giới hạn 20 MB.');
  const rows = await readRows(file);
  const result = dbParseQuestionImportRows(rows, lessonId);
  if (!result.parsed.length) throw new Error('Không có câu hỏi hợp lệ nào trong tệp.' + (result.skipped.length ? ' ' + result.skipped.slice(0, 3).join(' · ') : ''));
  return result;
}
DB_ACT.saveQuestion = (form) => dbRun(form, async (v) => {
  const id = form.dataset.id, row = dbReadQuestion(v);
  const course = await dbEnsureCourse();
  const q = id ? await dbCall(EducMindDB.updateQuestion(id, row)) : await dbCall(EducMindDB.createQuestion({ ...row, course_id: course.id }));
  const current = id ? DB.data.qlinks.filter((x) => x.question_id === id).map((x) => x.objective_id) : [];
  await dbSyncLinks(current, v.objectives || [],
    (add) => dbCall(EducMindDB.addQuestionObjectives(add.map((o) => ({ question_id: q.id, objective_id: o })))),
    (rem) => dbCall(EducMindDB.removeQuestionObjectives(q.id, rem)));
  const returnToAssignment = !id && DB.arg.return_to === 'assignment' && DB.arg.assignment_id;
  if (returnToAssignment) {
    const assignmentId = DB.arg.assignment_id;
    const links = await dbCall(EducMindDB.listAssignmentQuestions([assignmentId]));
    const display_order = links.reduce((max, link) => Math.max(max, Number(link.display_order) || 0), 0) + 1;
    await dbCall(EducMindDB.addAssignmentQuestions([{ assignment_id: assignmentId, question_id: q.id, display_order }]));
  }
  toast(returnToAssignment ? 'Đã tạo và thêm câu hỏi vào bài tập.' : id ? 'Đã lưu câu hỏi.' : 'Đã thêm câu hỏi vào ngân hàng.');
  await dbGo(returnToAssignment ? 'assignments' : 'questions', returnToAssignment ? { id: DB.arg.assignment_id } : {});
  return false;
});
DB_ACT.deleteQuestion = (el) => {
  const q = DB.data.questions.find((x) => x.id === el.dataset.id);
  dbConfirm('Xóa câu hỏi?', 'Câu hỏi sẽ bị ẩn khỏi ngân hàng và không còn xuất hiện trong đề của các lượt làm mới. Kết quả của các lượt đã làm vẫn được giữ.', 'Xóa câu hỏi', async () => {
    await dbCall(EducMindDB.updateQuestion(q.id, { deleted_at: new Date().toISOString() }));
    toast('Đã xóa câu hỏi.');
  }, true);
};

/* ----- Xuất / nhập ngân hàng câu hỏi bằng Excel, CSV hoặc Word ----- */
DB_ACT.exportQuestions = () => {
  const d = DB.data, byObj = dbById(d.objectives), linksBy = dbGroup(d.qlinks, 'question_id');
  const rows = d.questions.map((q) => {
    const objs = (linksBy[q.id] || []).map((x) => (byObj[x.objective_id] || {}).code).filter(Boolean).join(', ');
    return [q.content, DB_QKIND[q.kind] || q.kind, DB_QDIFF[q.difficulty] || q.difficulty, q.grade == null ? '' : q.grade, DB_QBLOOM[q.bloom_level] || q.bloom_level || '',
      (Array.isArray(q.options) ? q.options : []).join('\n'), dbAnswerKeyText(q), objs];
  });
  DBTF.exportExcel(dbExportName('ngan-hang-cau-hoi', 'xlsx'), [{ name: 'Câu hỏi', headers: ['Nội dung', 'Dạng', 'Độ khó', 'Khối', 'Bloom', 'Lựa chọn', 'Đáp án', 'Mục tiêu'], rows }]);
  toast('Đã xuất ngân hàng câu hỏi ra tệp Excel.');
};
/* Đọc tệp Excel/CSV/Word và hỏi xác nhận trước khi nhập vào ngân hàng hoặc gắn vào bài tập. */
DB_ACT.importQuestionFile = (form) => dbRun(form, async () => {
  const input = form.querySelector('input[type="file"]');
  const file = input.files && input.files[0], { parsed, skipped, unknownCodes, ambiguousCodes } = await dbReadQuestionImport(file);
  const assignmentId = form.dataset.assignmentId;
  dbOpenDialog({
    title: 'Nhập câu hỏi từ tệp',
    body: `<p class="muted">Tìm thấy <b>${parsed.length}</b> câu hỏi hợp lệ${skipped.length ? `, bỏ qua <b>${skipped.length}</b> dòng lỗi` : ''} trong tệp <b>${h(file.name)}</b>.</p>
      ${skipped.length ? `<p class="muted db-hint">${skipped.slice(0, 5).map(h).join('<br>')}${skipped.length > 5 ? '<br>…' : ''}</p>` : ''}
      ${unknownCodes.length ? `<p class="muted db-hint">Không tìm thấy mã mục tiêu trong lớp hiện tại: ${unknownCodes.map(h).join(', ')}. Các câu vẫn được nhập nhưng chưa gắn những mục tiêu này.</p>` : ''}
      ${ambiguousCodes.length ? `<p class="muted db-hint">Mã mục tiêu trùng giữa nhiều bài học nên chưa thể chọn mục tiêu tương ứng: ${ambiguousCodes.map(h).join(', ')}. Hãy nhập từ chi tiết bài tập sau khi chọn bài học hoặc gắn mục tiêu thủ công trong Ngân hàng câu hỏi.</p>` : ''}
      <p class="muted">${assignmentId ? 'Câu hỏi sẽ được thêm vào ngân hàng và gắn trực tiếp với bài tập này.' : 'Mã mục tiêu hợp lệ trong tệp sẽ được gắn tự động; câu chưa có mục tiêu có thể được gắn sau trong “Ngân hàng câu hỏi”.'}</p>`,
    okLabel: (assignmentId ? 'Nhập và thêm ' : 'Nhập ') + parsed.length + ' câu hỏi',
    onOk: async () => {
      const created = await dbCall(EducMindDB.createQuestions(parsed.map((x) => x.row)));
      if (created.length !== parsed.length) throw new Error('Máy chủ không trả đủ mã câu hỏi đã nhập; hãy tải lại trang để kiểm tra trước khi nhập lại.');
      const objectiveLinks = parsed.flatMap((item, i) => item.objectiveIds.map((objective_id) => ({ question_id: created[i].id, objective_id })));
      if (objectiveLinks.length) await dbCall(EducMindDB.addQuestionObjectives(objectiveLinks));
      if (assignmentId) {
        if (!created.length) throw new Error('Đã nhập nhưng máy chủ không trả về danh sách câu hỏi để gắn vào bài tập.');
        const links = await dbCall(EducMindDB.listAssignmentQuestions([assignmentId]));
        let order = links.reduce((max, link) => Math.max(max, Number(link.display_order) || 0), 0);
        await dbCall(EducMindDB.addAssignmentQuestions(created.map((q) => ({
          assignment_id: assignmentId,
          question_id: q.id,
          display_order: ++order,
        }))));
        toast('Đã nhập và thêm ' + created.length + ' câu hỏi vào bài tập.');
        await dbGo('assignments', { id: assignmentId });
      } else {
        toast('Đã nhập ' + parsed.length + ' câu hỏi vào ngân hàng.');
        await dbGo('questions', {});
      }
    },
  });
  return false;
});
