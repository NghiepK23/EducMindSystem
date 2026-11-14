/* EducMind · js/db/14-ai.js
   Trang “AI tạo câu hỏi nháp” (chỉ giáo viên):
     - Gửi yêu cầu sinh câu hỏi cho một bài học (chọn mục tiêu, loại câu, độ khó, Bloom, số lượng).
       Gemini chạy trong hàng đợi nền ở Supabase Edge Function.
     - Bản nháp chưa ảnh hưởng điểm hay mức nắm vững; giáo viên duyệt / sửa-và-duyệt / từ chối
       trước khi câu hỏi thật sự vào ngân hàng (kèm mục tiêu đã chọn). */

const DB_AI_MAX_Q = 20;
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
    const requestIds = requests.map((r) => r.id);
    const [outputs, jobs] = await Promise.all([
      dbCallIn(EducMindDB.listAiOutputs, requestIds),
      dbCallIn(EducMindDB.listAiJobs, requestIds),
    ]);
    dbAiStartPoll();
    return { ...content, requests, outputs, jobs };
  },
  view(d) {
    if (!dbIsTeacher()) return `<section class="panel">${dbEmpty('Chỉ giáo viên mới dùng được AI tạo câu hỏi.')}</section>`;
    if (!DB.classId) return `<section class="panel">${dbEmpty('Hãy chọn một lớp trước.')}</section>`;
    const byObj = dbById(d.objectives), byLesson = dbById(d.lessons);
    const pending = d.outputs.filter((o) => o.review_status === 'PENDING_REVIEW');
    return `${dbAiForm(d)}
    <section class="panel" aria-labelledby="db-h-aip">
      <div class="row between"><div><h2 id="db-h-aip">Bản nháp chờ duyệt</h2><p class="lead">${pending.length} bản nháp${pending.length ? ' · duyệt để đưa vào ngân hàng câu hỏi' : ''}</p></div>${pending.length ? dbBtn('Duyệt tất cả', 'aiApproveAll', {}, 'light') : ''}</div>
      ${pending.length ? pending.map((o, i) => dbAiRow(o, byObj, i)).join('') : dbEmpty('Chưa có bản nháp nào. Gửi yêu cầu AI ở khung trên để bắt đầu.')}
    </section>
    ${dbAiHistory(d, byLesson)}`;
  },
};

function dbAiForm(d) {
  const lessons = d.lessons;
  const objBy = dbGroup(d.objectives, 'lesson_id');
  return `<section class="panel" aria-labelledby="db-h-aif">
    <h2 id="db-h-aif">Tạo câu hỏi bằng AI</h2>
    <p class="lead">AI chỉ nhận tên lớp, chủ đề, mô tả và mục tiêu bài học đã chọn. Ứng dụng không giới hạn lượt/ngày; Google áp dụng hạn mức của dự án API key riêng của bạn.</p>
    <p class="muted">Trước khi tạo, hãy lưu API key cá nhân tại Tài khoản → Quản lý API key Gemini.</p>
    <form data-act="aiGenerate" class="db-ai-form" novalidate>
      ${dbField('Bài học', 'db-ai-lesson', `<select id="db-ai-lesson" name="lesson" data-change="aiLessonPick" required><option value="">Chọn bài học</option>${lessons.map((l) => `<option value="${h(l.id)}">${h(l.title)}</option>`).join('')}</select>`)}
      <div class="field"><span class="db-label">Mục tiêu cần sinh câu hỏi (bỏ trống = mọi mục tiêu của bài)</span>
        ${lessons.map((l) => `<div class="db-ai-objs" data-lesson="${h(l.id)}" hidden>${(objBy[l.id] || []).map((o) => `<label class="db-check"><input type="checkbox" name="obj" value="${h(o.id)}"> <span class="db-obj-code">${h(o.code)}</span> ${h(o.description)}</label>`).join('') || '<span class="muted">Bài học chưa có mục tiêu.</span>'}</div>`).join('')}
      </div>
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
/* Hiện danh sách mục tiêu của bài học đang chọn (không vẽ lại trang). */
DB_ACT.aiLessonPick = (el) => {
  document.querySelectorAll('.db-ai-objs').forEach((x) => { x.hidden = x.dataset.lesson !== el.value; });
};

function dbAiRow(o, byObj, index) {
  const obj = byObj[o.objective_id] || {};
  const options = Array.isArray(o.options) ? o.options : [];
  return `<article class="db-ai-row" data-id="${h(o.id)}">
    <div class="db-ai-row-body">
      <span class="db-ai-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <div class="db-ai-content">
        <div class="db-qtext">${h(o.content)}</div>
        <div class="db-ai-meta">
          <span class="db-ai-tag">${h(DB_QKIND[o.kind] || o.kind)}</span>
          <span class="db-ai-tag">${h(DB_QDIFF[o.difficulty] || o.difficulty)}</span>
          ${o.bloom_level ? `<span class="db-ai-tag">${h(DB_QBLOOM[o.bloom_level] || o.bloom_level)}</span>` : ''}
          <span class="db-ai-tag db-ai-objective">Mục tiêu <b>${h(obj.code || '—')}</b></span>
        </div>
        ${options.length ? `<ul class="db-ai-options" aria-label="Các lựa chọn">${options.map((x, i) => `<li><span class="db-ai-option-letter">${dbLetter(i)}</span><span>${h(x)}</span></li>`).join('')}</ul>` : ''}
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
  const rows = d.requests.map((r) => {
    const outputs = d.outputs.filter((o) => o.request_id === r.id);
    const jobs = d.jobs.filter((j) => j.request_id === r.id);
    const n = outputs.length;
    const st = DB_AIST[r.status] || [r.status, 'plain'];
    const progress = r.status === 'PROCESSING' || r.status === 'FAILED' ? ` · ${n}/${r.quantity} câu đã tạo` : '';
    return `<tr><th scope="row">${h((byLesson[r.lesson_id] || {}).title || '')}</th>
      <td>${h(r.quantity)}</td><td>${n} bản nháp</td>
      <td>${dbPill(st[0] + progress, st[1])}${r.error_message ? `<div class="muted">${h(r.error_message)}</div>` : ''}${r.status === 'FAILED' && jobs.some((j) => j.status === 'FAILED') ? dbBtn('Thử lại phần lỗi', 'aiRetry', { id: r.id }, 'light mini') : ''}</td>
      <td>${dbDateTime(r.created_at)}</td></tr>`;
  });
  return `<section class="panel" aria-labelledby="db-h-aih"><h2 id="db-h-aih">Lịch sử yêu cầu</h2>
    ${rows.length ? dbTable(['Bài học', 'Số lượng', 'Kết quả', 'Trạng thái', 'Gửi lúc'], rows, 'Lịch sử yêu cầu AI') : dbEmpty('Chưa có yêu cầu nào.')}</section>`;
}

/* ===== Thao tác ===== */
/* Gửi yêu cầu vào hàng đợi; tiến độ được nạp lại từ Supabase trong lúc xử lý. */
DB_ACT.aiGenerate = (form) => dbRun(form, async (v) => {
  const qty = Number(v.qty);
  if (!v.lesson) throw new Error('Hãy chọn bài học cần sinh câu hỏi.');
  if (!Number.isInteger(qty) || qty < 1 || qty > DB_AI_MAX_Q) throw new Error('Số lượng phải từ 1 đến ' + DB_AI_MAX_Q + '.');
  const params = {
    objectives: [...form.querySelectorAll('.db-ai-objs:not([hidden]) input[name="obj"]:checked')].map((x) => x.value),
    kind: v.kind || 'AUTO', difficulty: v.difficulty || 'AUTO', bloom: v.bloom || 'AUTO',
  };
  const req = await dbCall(EducMindDB.createAiRequest(v.lesson, qty, params));
  if (!supabaseClient) throw new Error('Chưa kết nối được Supabase.');
  const { data, error } = await supabaseClient.functions.invoke('ai-generate', { body: { request_id: req.id } });
  if (error) {
    let message = error.message || 'Không gọi được Edge Function.';
    if (error.context instanceof Response) {
      try {
        const detail = await error.context.clone().json();
        if (detail && typeof detail.error === 'string') message = detail.error;
      } catch (_) { /* Phản hồi không phải JSON; giữ thông báo lỗi của SDK. */ }
    }
    throw new Error(message);
  }
  if (!data || data.accepted !== true) throw new Error('Máy chủ chưa xác nhận đã tiếp nhận yêu cầu AI.');
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
  await dbCall(EducMindDB.approveAiOutput(o.id, o.content, o.options, o.correct_answer, o.difficulty, o.bloom_level, null));
  toast('Đã duyệt — câu hỏi đã vào ngân hàng của lớp.');
});
DB_ACT.aiApproveAll = (el) => dbRun(el, async () => {
  const pend = DB.data.outputs.filter((o) => o.review_status === 'PENDING_REVIEW');
  for (const o of pend) await dbCall(EducMindDB.approveAiOutput(o.id, o.content, o.options, o.correct_answer, o.difficulty, o.bloom_level, null));
  toast('Đã duyệt ' + pend.length + ' bản nháp vào ngân hàng câu hỏi.');
});

/* Sửa nội dung/đáp án rồi duyệt: một hộp thoại cho từng dạng câu hỏi. */
DB_ACT.aiEditApprove = (el) => {
  const o = DB.data.outputs.find((x) => x.id === el.dataset.id);
  if (!o) return;
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
        ${dbField('Khối', 'db-ae-g', `<select id="db-ae-g" name="grade"><option value="">—</option>${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">Khối ${i + 1}</option>`).join('')}</select>`)}
      </div>`,
    okLabel: 'Duyệt vào ngân hàng',
    onOk: async (v) => {
      const parsed = dbAiParseEdit(o, v);
      await dbCall(EducMindDB.approveAiOutput(o.id, parsed.content, parsed.options, parsed.correct_answer, parsed.difficulty, parsed.bloom_level, parsed.grade));
      toast('Đã sửa và duyệt — câu hỏi đã vào ngân hàng của lớp.');
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
  return { content, options, correct_answer, difficulty: v.difficulty || 'MEDIUM', bloom_level: v.bloom_level || null, grade: v.grade ? Number(v.grade) : null };
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
