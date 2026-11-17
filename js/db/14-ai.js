/* EducMind · js/db/14-ai.js
   Trang “AI tạo câu hỏi nháp” (chỉ giáo viên):
     - Gửi yêu cầu sinh câu hỏi theo mục tiêu bài học, có thể kèm giáo án đã được giáo viên đồng ý.
       Gemini chạy trong hàng đợi nền ở Supabase Edge Function.
     - Bản nháp chưa ảnh hưởng điểm hay mức nắm vững; giáo viên duyệt / sửa-và-duyệt / từ chối
       trước khi câu hỏi thật sự vào ngân hàng (kèm mục tiêu đã chọn). */

const DB_AI_MAX_Q = 20;
const DB_AI_SOURCE_MAX = 10000;
const DB_AI_ALL_LESSONS = 'ALL';
const DB_AIRS = { PENDING_REVIEW: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối', EDITED_AND_APPROVED: 'Đã sửa và duyệt' };
const DB_AIST = { PROCESSING: ['Đang xử lý', 'prog'], COMPLETED: ['Hoàn tất', 'good'], FAILED: ['Thất bại', 'need'] };
let dbAiPollTimer = null, dbAiPollBusy = false, dbAiLastResume = 0;

DB_PAGES.ai = {
  title: 'AI tạo câu hỏi nháp',
  sub: 'AI soạn sẵn câu hỏi nháp cho bài học; bạn duyệt, có thể sửa trước khi đưa vào ngân hàng. Bản nháp chưa ảnh hưởng điểm hay mức nắm vững.',
  async load() {
    if (!DB.classId) return {};
    const content = await dbLoadContent();
    const requests = await dbCall(EducMindDB.listAiRequests());
    const assignments = dbIsTeacher() && DB.course ? await dbCall(EducMindDB.listAssignments(DB.course.id)) : [];
    const requestIds = requests.map((r) => r.id);
    const [outputs, jobs] = await Promise.all([
      dbCallIn(EducMindDB.listAiOutputs, requestIds),
      dbCallIn(EducMindDB.listAiJobs, requestIds),
    ]);
    dbAiStartPoll();
    return { ...content, requests, outputs, jobs, assignments };
  },
  view(d) {
    if (!dbIsTeacher()) return `<section class="panel">${dbEmpty('Chỉ giáo viên mới dùng được AI tạo câu hỏi.')}</section>`;
    if (!DB.classId) return `<section class="panel">${dbEmpty('Hãy chọn một lớp trước.')}</section>`;
    const byObj = dbById(d.objectives), byLesson = dbById(d.lessons);
    const pending = d.outputs.filter((o) => o.review_status === 'PENDING_REVIEW');
    return `${dbAiForm(d)}
    <section class="panel" aria-labelledby="db-h-aip">
      <div class="row between"><div><h2 id="db-h-aip">Bản nháp chờ duyệt</h2><p class="lead">${pending.length} bản nháp${pending.length ? ' · duyệt để đưa vào ngân hàng câu hỏi' : ''}</p></div>${pending.length ? `<div class="db-ai-bulk-actions">${dbBtn('Duyệt tất cả', 'aiApproveAll', {}, 'light')}${dbBtn('Từ chối tất cả', 'aiRejectAll', {}, 'light danger-soft')}</div>` : ''}</div>
      ${pending.length ? pending.map((o, i) => dbAiRow(o, byObj, byLesson, i)).join('') : dbEmpty('Chưa có bản nháp nào. Gửi yêu cầu AI ở khung trên để bắt đầu.')}
    </section>
    ${dbAiHistory(d, byLesson)}`;
  },
};

function dbAiForm(d) {
  const lessons = d.lessons;
  const objBy = dbGroup(d.objectives, 'lesson_id');
  const assignment = (d.assignments || []).find((a) => a.id === DB.arg.assignment_id);
  const selectedLesson = assignment?.lesson_id || DB.arg.lesson_id || '';
  const showAllObjectives = selectedLesson === DB_AI_ALL_LESSONS;
  const lessonSelected = lessons.some((l) => l.id === selectedLesson);
  return `<section class="panel" aria-labelledby="db-h-aif">
    <h2 id="db-h-aif">Tạo câu hỏi bằng AI</h2>
    <p class="lead">Tải giáo án hoặc dán nội dung để Gemini tham khảo cùng mục tiêu bài học. Câu hỏi được lưu ở dạng bản nháp chờ giáo viên duyệt.</p>
    <p class="muted">Hãy lưu API key cá nhân tại Tài khoản → Quản lý API key Gemini. Ứng dụng không giới hạn số yêu cầu; hạn mức sử dụng do Gemini quyết định.</p>
    ${assignment ? `<div class="notice">${ic('info', 16)}<div>Các câu được duyệt từ yêu cầu này sẽ tự thêm vào bài tập nháp <b>${h(assignment.title)}</b>. Hãy duyệt câu hỏi trước khi xuất bản bài tập.</div></div>` : ''}
    <form data-act="aiGenerate" class="db-ai-form" novalidate data-assignment-id="${h(assignment ? assignment.id : '')}">
      ${dbField('Bài học', 'db-ai-lesson', `<select id="db-ai-lesson" name="lesson" data-change="aiLessonPick" required><option value="">Chọn bài học</option>${assignment ? '' : `<option value="${DB_AI_ALL_LESSONS}" ${showAllObjectives ? 'selected' : ''}>Tất cả</option>`}${lessons.map((l) => `<option value="${h(l.id)}" ${l.id === selectedLesson ? 'selected' : ''}>${h(l.title)}</option>`).join('')}</select>`)}
      <div class="field"><span id="db-ai-objective-label" class="db-label">${showAllObjectives ? 'Chọn mục tiêu cần sinh câu hỏi (có thể chọn từ nhiều bài)' : 'Mục tiêu cần sinh câu hỏi (bỏ trống = mọi mục tiêu của bài)'}</span>
        ${lessons.map((l) => `<div class="db-ai-objs" data-lesson="${h(l.id)}" ${showAllObjectives || (lessonSelected && l.id === selectedLesson) ? '' : 'hidden'}><b class="db-ai-obj-lesson">${h(l.title)}</b>${(objBy[l.id] || []).map((o) => `<label class="db-check"><input type="checkbox" name="obj" value="${h(o.id)}"> <span class="db-obj-code">${h(o.code)}</span> ${h(o.description)}</label>`).join('') || '<span class="muted">Bài học chưa có mục tiêu.</span>'}</div>`).join('')}
      </div>
      <details class="db-ai-plan" ${DB.arg.source === 'plan' ? 'open' : ''}>
        <summary>Thêm giáo án làm nguồn câu hỏi (không bắt buộc)</summary>
        <p class="muted">Định dạng .docx, .txt, .md, .csv hoặc .xlsx. Phần văn bản trích xuất được gửi Gemini và lưu cùng yêu cầu AI trong Supabase.</p>
        <div class="row db-source-actions">
          ${dbBtn('Tải mẫu giáo án', 'downloadLessonPlanTemplate', {}, 'light')}
          <label class="btn light" for="db-ai-plan-file">Chọn tệp giáo án</label>
          <input id="db-ai-plan-file" class="sr" type="file" accept=".docx,.txt,.md,.csv,.xlsx" data-change="aiPlanFilePicked">
          <span id="db-ai-plan-file-name" class="muted" role="status">Chưa chọn tệp.</span>
        </div>
        ${dbField('Hoặc dán nội dung giáo án', 'db-ai-plan-text', `<textarea id="db-ai-plan-text" name="source_document_text" rows="6" maxlength="${DB_AI_SOURCE_MAX}" placeholder="I. MỤC TIÊU BÀI HỌC&#10;- Trình bày được…&#10;II. NỘI DUNG&#10;…"></textarea>`)}
        <label class="db-check db-ai-consent"><input type="checkbox" name="source_consent"> Tôi đã kiểm tra và đồng ý gửi nội dung giáo án lên Gemini, đồng thời lưu cùng yêu cầu AI trong Supabase. Không đưa tên, thông tin cá nhân hoặc dữ liệu học sinh vào tệp.</label>
      </details>
      <div class="db-form-grid">
        ${dbField('Dạng câu hỏi', 'db-ai-kind', `<select id="db-ai-kind" name="kind"><option value="AUTO">Tự động</option>${Object.entries(DB_QKIND).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`)}
        ${dbField('Độ khó', 'db-ai-diff', `<select id="db-ai-diff" name="difficulty"><option value="AUTO">Tự động</option>${Object.entries(DB_QDIFF).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`)}
        ${dbField('Cấp độ Bloom', 'db-ai-bloom', `<select id="db-ai-bloom" name="bloom"><option value="AUTO">Tự động</option>${Object.entries(DB_QBLOOM).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>`)}
        ${dbField('Số lượng (tối đa ' + DB_AI_MAX_Q + ')', 'db-ai-qty', `<input id="db-ai-qty" name="qty" type="number" min="1" max="${DB_AI_MAX_Q}" step="1" value="5" required>`)}
      </div>
      ${dbFormError()}
      <div class="row db-form-actions"><button type="submit" class="btn">${ic('spark', 16)} Tạo câu hỏi bằng AI</button></div>
    </form>
  </section>`;
}
async function dbInvokeAiRequest(requestId) {
  if (!supabaseClient) throw new Error('Chưa kết nối được Supabase.');
  const { data, error } = await supabaseClient.functions.invoke('ai-generate', { body: { request_id: requestId } });
  if (error) {
    let message = error.message || 'Không gọi được Edge Function.';
    if (error.context instanceof Response) {
      try {
        const detail = await error.context.clone().json();
        if (detail && typeof detail.error === 'string') message = detail.error;
      } catch (_) { /* Phản hồi không phải JSON; giữ thông báo của SDK. */ }
    }
    throw new Error(message);
  }
  if (!data || data.accepted !== true) throw new Error('Máy chủ chưa xác nhận đã tiếp nhận yêu cầu AI.');
}
async function dbEnqueueAiRequest(lessonId, quantity, params, onCreated) {
  if (!supabaseClient) throw new Error('Chưa kết nối được Supabase.');
  const req = await dbCall(EducMindDB.createAiRequest(lessonId, quantity, params || {}));
  if (onCreated) onCreated(req.id);
  await dbInvokeAiRequest(req.id);
  return req;
}
DB_ACT.downloadLessonPlanTemplate = () => {
  const text = [
    'MẪU GIÁO ÁN DÙNG ĐỂ ĐỀ XUẤT CÂU HỎI',
    '',
    'Lưu ý: Không ghi tên, thông tin cá nhân hoặc dữ liệu học sinh.',
    'Giữ nguyên các tiêu đề mục tiêu và nội dung để hệ thống trích xuất chính xác hơn.',
    '',
    'TÊN BÀI HỌC:',
    '',
    'I. MỤC TIÊU BÀI HỌC',
    '- [Mã mục tiêu nếu có] Nội dung học sinh cần đạt',
    '- [Mã mục tiêu nếu có] Nội dung học sinh cần đạt',
    '',
    'II. NỘI DUNG TRỌNG TÂM',
    '- Khái niệm, sự kiện hoặc kiến thức chính:',
    '- Ví dụ, dữ kiện hoặc cách giải thích:',
    '',
    'III. YÊU CẦU KHI TẠO CÂU HỎI (không bắt buộc)',
    '- Nội dung cần ưu tiên:',
    '- Nội dung cần tránh:',
    '',
    'IV. GHI CHÚ CHO GIÁO VIÊN (không bắt buộc)',
    '- Kiểm tra lại độ chính xác, đáp án và mức độ phù hợp trước khi duyệt câu hỏi.',
  ].join('\n');
  DBTF.download(new Blob(['\ufeff', text], { type: 'text/plain;charset=utf-8' }), 'Mau_giao_an_tao_cau_hoi.txt');
  toast('Đã tải mẫu giáo án.');
};
DB_ACT.aiPlanFilePicked = async (el) => {
  const file = el.files && el.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) throw new Error('Tệp giáo án vượt giới hạn 20 MB.');
  const text = await objPlanFileText(file);
  if (!text.trim()) throw new Error('Không trích xuất được nội dung từ tệp giáo án.');
  if (text.length > DB_AI_SOURCE_MAX) throw new Error('Giáo án vượt giới hạn ' + DB_AI_SOURCE_MAX.toLocaleString('vi-VN') + ' ký tự. Hãy rút gọn phần liên quan đến bài học.');
  const form = el.closest('form'), textarea = form && form.querySelector('#db-ai-plan-text');
  if (textarea) textarea.value = text;
  const label = form && form.querySelector('#db-ai-plan-file-name');
  if (label) label.textContent = `Đã đọc ${file.name} · ${text.length} ký tự.`;
};
/* Hiện danh sách mục tiêu của bài học đang chọn (không vẽ lại trang). */
DB_ACT.aiLessonPick = (el) => {
  const label = document.getElementById('db-ai-objective-label');
  if (label) label.textContent = el.value === DB_AI_ALL_LESSONS
    ? 'Chọn mục tiêu cần sinh câu hỏi (có thể chọn từ nhiều bài)'
    : 'Mục tiêu cần sinh câu hỏi (bỏ trống = mọi mục tiêu của bài)';
  document.querySelectorAll('.db-ai-objs').forEach((x) => {
    x.hidden = el.value !== DB_AI_ALL_LESSONS && (!el.value || x.dataset.lesson !== el.value);
  });
};

function dbAiRow(o, byObj, byLesson, index) {
  const obj = byObj[o.objective_id] || {};
  const lesson = byLesson[obj.lesson_id] || {};
  const options = Array.isArray(o.options) ? o.options : [];
  const correctIndexes = o.kind === 'SINGLE_CHOICE' && o.correct_answer != null ? [Number(o.correct_answer)]
    : o.kind === 'MULTIPLE_CHOICE' && o.correct_answer != null ? [].concat(o.correct_answer).map(Number)
    : o.kind === 'TRUE_FALSE' && o.correct_answer != null ? [o.correct_answer === true || String(o.correct_answer).toLowerCase() === 'true' ? 0 : 1]
    : [];
  const hasOptionAnswers = ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE'].includes(o.kind);
  return `<article class="db-ai-row" data-id="${h(o.id)}">
    <div class="db-ai-row-body">
      <span class="db-ai-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="db-ai-content">
        <div class="db-qtext">${h(o.content)}</div>
        <div class="db-ai-meta">
          <span class="db-ai-tag">${h(DB_QKIND[o.kind] || o.kind)}</span>
          <span class="db-ai-tag">${h(DB_QDIFF[o.difficulty] || o.difficulty)}</span>
          ${o.bloom_level ? `<span class="db-ai-tag">${h(DB_QBLOOM[o.bloom_level] || o.bloom_level)}</span>` : ''}
          <span class="db-ai-tag db-ai-objective">Mục tiêu <b>${h(obj.code || '—')}</b>${lesson.title ? ` · ${h(lesson.title)}` : ''}</span>
        </div>
        ${options.length ? `<ul class="db-ai-options" aria-label="Các lựa chọn; dấu tích cho biết đáp án đúng">${options.map((x, i) => {
          const correct = correctIndexes.includes(i);
          return `<li class="${correct ? 'is-correct' : ''}"><span class="db-ai-option-letter">${dbLetter(i)}</span><span class="db-ai-option-text">${h(x)}</span>${correct ? '<span class="db-ai-correct-label">✓ Đáp án đúng</span>' : ''}</li>`;
        }).join('')}</ul>` : ''}
        ${!hasOptionAnswers ? `<div class="db-ai-answer">${o.correct_answer == null
          ? '<b>Chấm điểm:</b> Giáo viên chấm tay (chưa có đáp án tham khảo).'
          : `<b>Đáp án tham khảo:</b> ${h(dbAnswerKeyText(o))}`}</div>` : ''}
      </div>
    </div>
    <div class="db-ai-actions" role="group" aria-label="Thao tác bản nháp">
      ${dbBtn('Duyệt', 'aiApprove', { id: o.id }, 'mini')}
      ${dbBtn('Sửa và duyệt', 'aiEditApprove', { id: o.id }, 'light mini')}
      ${dbBtn('Từ chối', 'aiReject', { id: o.id }, 'light mini danger-soft')}
    </div>
  </article>`;
}
function dbAiHistory(d, byLesson) {
  const byObjective = dbById(d.objectives);
  const rows = d.requests.map((r) => {
    const outputs = d.outputs.filter((o) => o.request_id === r.id);
    const jobs = d.jobs.filter((j) => j.request_id === r.id);
    const n = outputs.length;
    const st = DB_AIST[r.status] || [r.status, 'plain'];
    const progress = r.status === 'PROCESSING' || r.status === 'FAILED' ? ` · ${n}/${r.quantity} câu đã tạo` : '';
    const selectedObjectiveIds = Array.isArray(r.parameters?.objectives) ? r.parameters.objectives : [];
    const objectiveLessonIds = [...new Set(selectedObjectiveIds.map((id) => byObjective[id]?.lesson_id).filter(Boolean))];
    const lessonNames = objectiveLessonIds.map((id) => byLesson[id]?.title).filter(Boolean);
    const lessonLabel = lessonNames.length ? lessonNames.join(', ') : (byLesson[r.lesson_id] || {}).title || '';
    return `<tr><th scope="row">${h(lessonLabel)}</th>
      <td>${h(r.quantity)}</td><td>${n} bản nháp</td>
      <td>${dbPill(st[0] + progress, st[1])}${r.error_message ? `<div class="muted">${h(r.error_message)}</div>` : ''}${r.status === 'FAILED' && jobs.some((j) => j.status === 'FAILED') ? dbBtn('Thử lại phần lỗi', 'aiRetry', { id: r.id }, 'light mini') : ''}</td>
      <td>${dbDateTime(r.created_at)}</td>
      <td>${r.status === 'PROCESSING' ? '<span class="muted">Đang xử lý</span>' : dbBtn('Xóa', 'aiDeleteRequest', { id: r.id }, 'light mini danger-soft')}</td></tr>`;
  });
  return `<details class="panel db-ai-history" aria-labelledby="db-h-aih" open>
    <summary class="db-ai-history-summary"><span id="db-h-aih">Lịch sử yêu cầu</span><span class="muted">${rows.length} yêu cầu</span></summary>
    ${rows.length ? dbTable(['Bài học', 'Số lượng', 'Kết quả', 'Trạng thái', 'Gửi lúc', '<span class="sr">Thao tác</span>'], rows, 'Lịch sử yêu cầu AI') : dbEmpty('Chưa có yêu cầu nào.')}</details>`;
}

/* ===== Thao tác ===== */
/* Gửi yêu cầu vào hàng đợi; tiến độ được nạp lại từ Supabase trong lúc xử lý. */
DB_ACT.aiGenerate = (form) => dbRun(form, async (v) => {
  const qty = Number(v.qty);
  if (!v.lesson) throw new Error('Hãy chọn bài học cần sinh câu hỏi.');
  if (!Number.isInteger(qty) || qty < 1 || qty > DB_AI_MAX_Q) throw new Error('Số lượng phải từ 1 đến ' + DB_AI_MAX_Q + '.');
  const objectiveIds = [...form.querySelectorAll('.db-ai-objs:not([hidden]) input[name="obj"]:checked')].map((x) => x.value);
  let lessonId = v.lesson;
  if (v.lesson === DB_AI_ALL_LESSONS) {
    const selectedObjectives = (DB.data.objectives || []).filter((o) => objectiveIds.includes(o.id));
    const selectedLessonIds = [...new Set(selectedObjectives.map((o) => o.lesson_id))];
    if (!objectiveIds.length) throw new Error('Khi chọn Tất cả, hãy chọn ít nhất một mục tiêu để tạo câu hỏi.');
    if (selectedObjectives.length !== objectiveIds.length) throw new Error('Danh sách mục tiêu đã thay đổi. Hãy tải lại trang rồi thử lại.');
    if (!selectedLessonIds.length) throw new Error('Không xác định được bài học của mục tiêu đã chọn. Hãy tải lại trang rồi thử lại.');
    lessonId = selectedLessonIds[0];
  }
  let sourceText = String(v.source_document_text || '').trim();
  const sourceFile = form.querySelector('#db-ai-plan-file')?.files?.[0];
  if (sourceFile && !sourceText) {
    if (sourceFile.size > 20 * 1024 * 1024) throw new Error('Tệp giáo án vượt giới hạn 20 MB.');
    sourceText = await objPlanFileText(sourceFile);
    if (!sourceText.trim()) throw new Error('Không trích xuất được nội dung từ tệp giáo án.');
  }
  if (sourceText.length > DB_AI_SOURCE_MAX) throw new Error('Giáo án vượt giới hạn ' + DB_AI_SOURCE_MAX.toLocaleString('vi-VN') + ' ký tự.');
  if (sourceText && !v.source_consent) throw new Error('Xác nhận đã kiểm tra và đồng ý gửi giáo án lên Gemini.');
  const assignmentId = form.dataset.assignmentId || '';
  if (assignmentId) {
    const assignment = (DB.data.assignments || []).find((a) => a.id === assignmentId);
    if (!assignment || assignment.lesson_id !== lessonId) throw new Error('Bài tập nháp không còn khớp với bài học đã chọn. Hãy mở lại bài tập rồi thử lại.');
    if (assignment.status !== 'DRAFT') throw new Error('Chỉ có thể thêm câu AI vào bài tập đang ở trạng thái nháp.');
  }
  const params = {
    objectives: objectiveIds,
    kind: v.kind || 'AUTO', difficulty: v.difficulty || 'AUTO', bloom: v.bloom || 'AUTO',
  };
  if (sourceText) params.source_document_text = sourceText;
  if (assignmentId) params.assignment_id = assignmentId;
  if (form.dataset.aiRequestId) await dbInvokeAiRequest(form.dataset.aiRequestId);
  else await dbEnqueueAiRequest(lessonId, qty, params, (id) => { form.dataset.aiRequestId = id; });
  toast('Đã đưa yêu cầu vào xử lý nền. Bạn có thể tiếp tục làm việc; kết quả sẽ cập nhật trong lịch sử.');
});

DB_ACT.aiRetry = (el) => dbRun(el, async () => {
  if (!supabaseClient) throw new Error('Chưa kết nối được Supabase.');
  const { data, error } = await supabaseClient.functions.invoke('ai-generate', {
    body: { request_id: el.dataset.id, retry: true },
  });
  if (error) throw new Error(error.message || 'Không thể thử lại tác vụ AI.');
  if (!data || data.accepted !== true) throw new Error('Máy chủ chưa xác nhận yêu cầu thử lại.');
  toast('Đã đưa các lô bị lỗi vào xử lý lại.');
});

DB_ACT.aiDeleteRequest = (el) => {
  const request = DB.data.requests.find((r) => r.id === el.dataset.id);
  if (!request) return;
  if (request.status === 'PROCESSING') {
    toast('Không thể xóa yêu cầu đang xử lý.');
    return;
  }
  dbConfirm('Xóa yêu cầu AI?', 'Yêu cầu và các bản nháp trong lịch sử của yêu cầu này sẽ bị xóa. Câu hỏi đã duyệt trong ngân hàng vẫn được giữ.', 'Xóa yêu cầu', async () => {
    await dbCall(EducMindDB.deleteAiRequest(request.id));
    toast('Đã xóa yêu cầu AI khỏi lịch sử.');
  }, true);
};

function dbAiStartPoll() {
  if (dbAiPollTimer && DB.timers.includes(dbAiPollTimer)) return;
  dbAiPollTimer = setInterval(async () => {
    if (DB.page !== 'ai' || dbAiPollBusy || !DB.data?.requests?.some((r) => r.status === 'PROCESSING')) return;
    dbAiPollBusy = true;
    try {
      const active = DB.data.requests.filter((r) => r.status === 'PROCESSING');
      if (Date.now() - dbAiLastResume > 60000 && supabaseClient) {
        dbAiLastResume = Date.now();
        await Promise.all(active.map(async (r) => {
          const { error } = await supabaseClient.functions.invoke('ai-generate', { body: { request_id: r.id } });
          if (error) console.warn('Could not resume AI request:', error.message);
        }));
      }
      const requests = await dbCall(EducMindDB.listAiRequests());
      const ids = requests.map((r) => r.id);
      const [outputs, jobs] = await Promise.all([
        dbCallIn(EducMindDB.listAiOutputs, ids),
        dbCallIn(EducMindDB.listAiJobs, ids),
      ]);
      if (DB.page === 'ai' && DB.data) {
        DB.data = { ...DB.data, requests, outputs, jobs };
        render();
      }
    } catch (error) {
      dbLogError(error);
    } finally {
      dbAiPollBusy = false;
    }
  }, 8000);
  DB.timers.push(dbAiPollTimer);
}

/* Duyệt nhanh một bản nháp: giữ nguyên nội dung, đưa vào ngân hàng kèm mục tiêu. */
DB_ACT.aiApprove = (el) => dbRun(el, async () => {
  const o = DB.data.outputs.find((x) => x.id === el.dataset.id);
  if (!o) throw new Error('Không tìm thấy bản nháp.');
  const linked = await dbApproveAiOutput(o, o.content, o.options, o.correct_answer, o.difficulty, o.bloom_level, null);
  toast(linked === true ? 'Đã duyệt và thêm câu hỏi vào bài tập nháp.' : (linked === 'bank'
    ? 'Đã duyệt vào ngân hàng; bài tập không còn ở trạng thái nháp nên câu chưa được thêm vào đó.'
    : 'Đã duyệt — câu hỏi đã vào ngân hàng của lớp.'));
});
DB_ACT.aiApproveAll = (el) => dbRun(el, async () => {
  const pend = DB.data.outputs.filter((o) => o.review_status === 'PENDING_REVIEW');
  let linked = 0, bankOnly = 0;
  for (const o of pend) {
    const result = await dbApproveAiOutput(o, o.content, o.options, o.correct_answer, o.difficulty, o.bloom_level, null);
    if (result === true) linked++;
    else if (result === 'bank') bankOnly++;
  }
  toast('Đã duyệt ' + pend.length + ' bản nháp' + (linked ? ' và thêm vào bài tập nháp.' : ' vào ngân hàng câu hỏi.')
    + (bankOnly ? ' ' + bankOnly + ' câu được giữ trong ngân hàng vì bài tập không còn ở trạng thái nháp.' : ''));
});
DB_ACT.aiRejectAll = () => {
  const pending = DB.data.outputs.filter((o) => o.review_status === 'PENDING_REVIEW');
  if (!pending.length) {
    toast('Không có bản nháp nào đang chờ duyệt.');
    return;
  }
  dbOpenDialog({
    title: `Từ chối ${pending.length} bản nháp?`,
    body: `<p class="muted">Tất cả bản nháp đang chờ duyệt sẽ bị loại khỏi hàng chờ và không vào ngân hàng câu hỏi.</p>
      ${dbField('Lý do (không bắt buộc)', 'db-aj-all-n', '<input id="db-aj-all-n" name="note" maxlength="300" placeholder="Ví dụ: Nội dung chưa phù hợp">')}`,
    okLabel: 'Từ chối tất cả',
    danger: true,
    onOk: async (v) => {
      const current = DB.data.outputs.filter((o) => o.review_status === 'PENDING_REVIEW');
      if (!current.length) {
        DB.dialog = null;
        render();
        toast('Không còn bản nháp nào đang chờ duyệt.');
        return false;
      }
      const note = (v.note || '').trim();
      const results = await Promise.allSettled(current.map((o) => dbCall(EducMindDB.updateAiOutput(o.id, {
        review_status: 'REJECTED',
        review_note: note,
      }))));
      const rejected = new Set();
      const failures = [];
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') rejected.add(current[i].id);
        else {
          dbLogError(result.reason);
          failures.push(result.reason);
        }
      });
      DB.data.outputs = DB.data.outputs.map((o) => rejected.has(o.id)
        ? { ...o, review_status: 'REJECTED', review_note: note }
        : o);
      if (failures.length) {
        DB.dialog = null;
        render();
        toast(`Đã từ chối ${rejected.size}/${current.length} bản nháp. ${failures.length} bản chưa cập nhật: ${dbErrText(failures[0])}`);
        return false;
      }
      toast(`Đã từ chối ${current.length} bản nháp.`);
    },
  });
};
async function dbApproveAiOutput(o, content, options, correct, difficulty, bloom, grade) {
  const request = DB.data.requests.find((r) => r.id === o.request_id), assignmentId = request?.parameters?.assignment_id;
  if (assignmentId) {
    const assignment = (DB.data.assignments || []).find((a) => a.id === assignmentId);
    if (assignment && assignment.status === 'DRAFT') {
      await dbCall(EducMindDB.approveAiOutputForAssignment(o.id, content, options, correct, difficulty, bloom, grade, assignmentId));
      return true;
    }
    await dbCall(EducMindDB.approveAiOutput(o.id, content, options, correct, difficulty, bloom, grade));
    return 'bank';
  }
  await dbCall(EducMindDB.approveAiOutput(o.id, content, options, correct, difficulty, bloom, grade));
  return false;
}

/* Sửa nội dung/đáp án rồi duyệt: một hộp thoại cho từng dạng câu hỏi. */
DB_ACT.aiEditApprove = (el) => {
  const o = DB.data.outputs.find((x) => x.id === el.dataset.id);
  if (!o) return;
  const request = DB.data.requests.find((r) => r.id === o.request_id);
  const assignment = (DB.data.assignments || []).find((a) => a.id === request?.parameters?.assignment_id);
  const opts = Array.isArray(o.options) ? o.options : [], choice = o.kind === 'SINGLE_CHOICE' || o.kind === 'MULTIPLE_CHOICE';
  const ansLetters = o.kind === 'SINGLE_CHOICE' && o.correct_answer != null ? dbLetter(Number(o.correct_answer))
    : o.kind === 'MULTIPLE_CHOICE' && o.correct_answer != null ? [].concat(o.correct_answer).map((i) => dbLetter(Number(i))).join(', ')
    : o.kind === 'TRUE_FALSE' ? (o.correct_answer === true || String(o.correct_answer).toLowerCase() === 'true' ? 'Đúng' : 'Sai')
    : (o.correct_answer == null ? '' : String(o.correct_answer));
  dbOpenDialog({
    title: 'Sửa và duyệt bản nháp',
    wide: true,
    body: `${dbField('Nội dung câu hỏi', 'db-ae-c', `<textarea id="db-ae-c" name="content" rows="3" required>${h(o.content)}</textarea>`)}
      ${choice ? dbField('Các lựa chọn (mỗi dòng một lựa chọn)', 'db-ae-o', `<textarea id="db-ae-o" name="options" rows="4">${h(opts.join('\n'))}</textarea>`) : ''}
      ${choice ? dbField(o.kind === 'TRUE_FALSE' ? 'Đáp án đúng' : 'Đáp án đúng (chữ cái, nhiều đáp án cách nhau bằng dấu phẩy)', 'db-ae-a', o.kind === 'TRUE_FALSE'
        ? `<select id="db-ae-a" name="answer"><option value="Đúng" ${ansLetters === 'Đúng' ? 'selected' : ''}>Đúng</option><option value="Sai" ${ansLetters === 'Sai' ? 'selected' : ''}>Sai</option></select>`
        : `<input id="db-ae-a" name="answer" maxlength="20" value="${h(ansLetters)}" placeholder="VD: A hoặc A, C">`) : ''}
      <div class="db-form-grid">
        ${dbField('Độ khó', 'db-ae-d', `<select id="db-ae-d" name="difficulty">${Object.entries(DB_QDIFF).map(([k, v]) => `<option value="${k}" ${o.difficulty === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${dbField('Cấp độ Bloom', 'db-ae-b', `<select id="db-ae-b" name="bloom_level"><option value="">—</option>${Object.entries(DB_QBLOOM).map(([k, v]) => `<option value="${k}" ${o.bloom_level === k ? 'selected' : ''}>${v}</option>`).join('')}</select>`)}
        ${dbField('Khối', 'db-ae-g', `<select id="db-ae-g" name="grade"><option value="">—</option>${educmindGradeOptions()}</select>`)}
      </div>`,
    okLabel: assignment && assignment.status === 'DRAFT' ? 'Duyệt và thêm vào bài tập' : 'Duyệt vào ngân hàng',
    onOk: async (v) => {
      const parsed = dbAiParseEdit(o, v);
      const linked = await dbApproveAiOutput(o, parsed.content, parsed.options, parsed.correct_answer, parsed.difficulty, parsed.bloom_level, parsed.grade);
      toast(linked === true ? 'Đã sửa, duyệt và thêm câu hỏi vào bài tập nháp.' : (linked === 'bank'
        ? 'Đã sửa và duyệt vào ngân hàng; bài tập không còn ở trạng thái nháp nên câu chưa được thêm vào đó.'
        : 'Đã sửa và duyệt — câu hỏi đã vào ngân hàng của lớp.'));
    },
  });
};
/* Đọc hộp thoại sửa bản nháp thành tham số cho RPC duyệt. */
function dbAiParseEdit(o, v) {
  const content = (v.content || '').trim();
  if (!content) throw new Error('Nhập nội dung câu hỏi.');
  let options = Array.isArray(o.options) ? o.options : [], correct_answer = o.correct_answer;
  if (o.kind === 'SINGLE_CHOICE' || o.kind === 'MULTIPLE_CHOICE') {
    options = String(v.options || '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (options.length < 2) throw new Error('Cần ít nhất hai lựa chọn.');
    const idx = String(v.answer || '').split(/[,;]|và/).map((x) => { const t = x.trim().toUpperCase(); return /^[A-Z]$/.test(t) ? t.charCodeAt(0) - 65 : -1; }).filter((x) => x >= 0);
    if (!idx.length) throw new Error('Nhập chữ cái của đáp án đúng (VD: A hoặc A, C).');
    if (idx.some((x) => x >= options.length)) throw new Error('Đáp án vượt quá số lựa chọn.');
    if (o.kind === 'SINGLE_CHOICE') {
      if (idx.length !== 1) throw new Error('Câu một lựa chọn chỉ có đúng một đáp án đúng.');
      correct_answer = idx[0];
    } else correct_answer = idx;
  } else if (o.kind === 'TRUE_FALSE') {
    options = ['Đúng', 'Sai'];
    const t = String(v.answer || '').trim().toLowerCase();
    if (t !== 'đúng' && t !== 'sai') throw new Error('Chọn đáp án Đúng hoặc Sai.');
    correct_answer = t === 'đúng';
  }
  const grade = v.grade ? Number(v.grade) : null;
  if (grade != null && !educmindGradeIsValid(grade)) throw new Error(`Khối phải là số từ ${EDUCMIND_GRADE_MIN} đến ${EDUCMIND_GRADE_MAX}.`);
  return { content, options, correct_answer, difficulty: v.difficulty || 'MEDIUM', bloom_level: v.bloom_level || null, grade };
}

/* Từ chối bản nháp (có ghi lý do). */
DB_ACT.aiReject = (el) => {
  const o = DB.data.outputs.find((x) => x.id === el.dataset.id);
  if (!o) return;
  dbOpenDialog({
    title: 'Từ chối bản nháp',
    body: `<p class="muted">Bản nháp sẽ bị loại khỏi hàng chờ và không vào ngân hàng câu hỏi.</p>
      ${dbField('Lý do (không bắt buộc)', 'db-aj-n', `<input id="db-aj-n" name="note" maxlength="300" placeholder="Ví dụ: Nội dung chưa phù hợp">`)}`,
    okLabel: 'Từ chối',
    danger: true,
    onOk: async (v) => {
      await dbCall(EducMindDB.updateAiOutput(o.id, { review_status: 'REJECTED', review_note: (v.note || '').trim() }));
      toast('Đã từ chối bản nháp.');
    },
  });
};
