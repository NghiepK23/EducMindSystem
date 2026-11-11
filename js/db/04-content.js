/* EducMind · js/db/04-content.js
   Nội dung học tập: Chủ đề → Bài học → Mục tiêu. Giáo viên soạn và xuất bản; học sinh xem bài đã xuất bản kèm mức nắm vững. */

/* Nạp cây nội dung của lớp đang chọn. Dùng chung cho nhiều trang (bài tập, câu hỏi, đánh giá) để hiện tên bài học / mục tiêu. */
async function dbLoadContent() {
  if (!DB.course) return { topics: [], lessons: [], objectives: [] };
  const [topics, lessons] = await Promise.all([dbCall(EducMindDB.listTopics(DB.course.id)), dbCall(EducMindDB.listLessons(DB.course.id))]);
  const topicIds = new Set(topics.map((t) => t.id));
  const live = lessons.filter((l) => topicIds.has(l.topic_id));
  const objectives = await dbCallIn(EducMindDB.listObjectives, live.map((l) => l.id));
  return { topics, lessons: live, objectives };
}
/* Nhãn mục tiêu: "MT1 · Nhận biết mạng LAN" */
const dbObjLabel = (o) => (o ? `${h(o.code)} · ${h(o.description)}` : 'Mục tiêu đã xóa');
/* Danh sách ô chọn mục tiêu, nhóm theo bài học. name là tên trường của biểu mẫu, picked là tập mã mục tiêu đang chọn. */
function dbObjectivePicker(content, name, picked, onlyLesson) {
  const byLesson = dbGroup(content.objectives, 'lesson_id');
  const lessons = content.lessons.filter((l) => (byLesson[l.id] || []).length && (!onlyLesson || l.id === onlyLesson));
  if (!lessons.length) return `<p class="muted">Chưa có mục tiêu nào. Hãy thêm mục tiêu ở trang “Bài học &amp; mục tiêu” trước.</p>`;
  return `<div class="db-objpick">${lessons.map((l) => `<fieldset><legend>${h(l.title)}</legend>${byLesson[l.id].map((o) =>
    `<label class="objrow"><input type="checkbox" name="${name}" data-multi value="${h(o.id)}" ${picked.has(o.id) ? 'checked' : ''}><span>${dbObjLabel(o)}</span></label>`).join('')}</fieldset>`).join('')}</div>`;
}
/* Đồng bộ bảng liên kết mục tiêu (assignment_objectives / question_objectives): thêm cái mới chọn, gỡ cái bỏ chọn. */
async function dbSyncLinks(current, wanted, add, remove) {
  const cur = new Set(current), want = new Set(wanted);
  const toAdd = [...want].filter((x) => !cur.has(x)), toRemove = [...cur].filter((x) => !want.has(x));
  if (toRemove.length) await remove(toRemove);
  if (toAdd.length) await add(toAdd);
}

/* ===== Giáo viên: Bài học & mục tiêu ===== */
DB_PAGES.content = {
  title: 'Bài học & mục tiêu',
  sub: 'Học sinh chỉ thấy bài học khi cả chủ đề và bài học đều đã xuất bản.',
  load: dbLoadContent,
  view(d) {
    const lessonsBy = dbGroup(d.lessons, 'topic_id'), objBy = dbGroup(d.objectives, 'lesson_id');
    const topics = d.topics.map((t) => {
      const lessons = lessonsBy[t.id] || [];
      const pub = t.status === 'PUBLISHED';
      return `<section class="panel db-topic" aria-labelledby="db-t-${h(t.id)}">
        <div class="row between db-topic-head">
          <div><h2 id="db-t-${h(t.id)}">${h(t.title)}</h2><p class="lead">${dbStatusPill(t.status)} · ${lessons.length} bài học${t.description ? ' · ' + h(t.description) : ''}</p></div>
          <div class="row">${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleTopic', { id: t.id }, pub ? 'light mini' : 'mini')}${dbBtn('Sửa', 'editTopic', { id: t.id }, 'light mini')}${dbBtn('Xóa', 'deleteTopic', { id: t.id }, 'light mini danger-soft')}</div>
        </div>
        ${lessons.map((l) => dbLessonBlock(l, objBy[l.id] || [])).join('') || dbEmpty('Chủ đề chưa có bài học.')}
        <form data-act="createLesson" data-topic="${h(t.id)}" class="db-form-row db-add-row" novalidate>
          ${dbField('Thêm bài học vào chủ đề này', 'db-nl-' + h(t.id), `<input id="db-nl-${h(t.id)}" name="title" maxlength="200" placeholder="Tên bài học" required>`)}
          <button type="submit" class="btn light">Thêm bài học</button>${dbFormError()}
        </form>
      </section>`;
    }).join('');
    return `
    <section class="panel" aria-labelledby="db-h-topic">
      <h2 id="db-h-topic">Chủ đề</h2>
      <p class="lead">${d.topics.length ? d.topics.length + ' chủ đề · ' + d.lessons.length + ' bài học · ' + d.objectives.length + ' mục tiêu' : 'Lớp chưa có nội dung. Bắt đầu bằng việc thêm một chủ đề.'}</p>
      <form data-act="createTopic" class="db-form-row" novalidate>
        ${dbField('Tên chủ đề mới', 'db-new-topic', `<input id="db-new-topic" name="title" maxlength="200" placeholder="Ví dụ: Mạng máy tính" required>`)}
        <button type="submit" class="btn">Thêm chủ đề</button>${dbFormError()}
      </form>
    </section>${topics}`;
  },
};
function dbLessonBlock(l, objectives) {
  const pub = l.status === 'PUBLISHED';
  return `<div class="db-lesson" id="db-l-${h(l.id)}">
    <div class="row between">
      <div><b>${h(l.title)}</b> ${dbStatusPill(l.status)}${l.description ? `<div class="muted">${h(l.description)}</div>` : ''}</div>
      <div class="row">${dbBtn(pub ? 'Gỡ xuất bản' : 'Xuất bản', 'toggleLesson', { id: l.id }, pub ? 'light mini' : 'mini')}${dbBtn('Sửa', 'editLesson', { id: l.id }, 'light mini')}${dbBtn('Xóa', 'deleteLesson', { id: l.id }, 'light mini danger-soft')}</div>
    </div>
    ${objectives.length ? `<ul class="db-objectives">${objectives.map((o) => `<li><span class="db-obj-code">${h(o.code)}</span><span class="db-obj-text">${h(o.description)}</span>
        <span class="row">${dbBtn('Sửa', 'editObjective', { id: o.id }, 'light mini')}${dbBtn('Xóa', 'deleteObjective', { id: o.id }, 'light mini danger-soft')}</span></li>`).join('')}</ul>` : `<p class="muted db-noobj">Chưa có mục tiêu. Mục tiêu là cơ sở để hệ thống tính mức nắm vững.</p>`}
    <form data-act="createObjective" data-lesson="${h(l.id)}" class="db-form-row db-add-row" novalidate>
      ${dbField('Mã', 'db-oc-' + h(l.id), `<input id="db-oc-${h(l.id)}" name="code" maxlength="20" value="${h(dbNextObjectiveCode(objectives))}" class="db-input-code" required>`)}
      ${dbField('Mục tiêu mới', 'db-od-' + h(l.id), `<input id="db-od-${h(l.id)}" name="description" maxlength="500" placeholder="Ví dụ: Phân biệt mạng LAN và WAN" required>`)}
      <button type="submit" class="btn light">Thêm mục tiêu</button>${dbFormError()}
    </form>
  </div>`;
}
/* Mã gợi ý cho mục tiêu tiếp theo của bài học: MT1, MT2, … (mã không trùng trong cùng một bài học). */
function dbNextObjectiveCode(objectives) {
  const used = new Set(objectives.map((o) => o.code));
  let n = objectives.length + 1;
  while (used.has('MT' + n)) n++;
  return 'MT' + n;
}
const dbNextOrder = (list) => list.reduce((m, x) => Math.max(m, x.display_order || 0), 0) + 1;

DB_ACT.createTopic = (form) => dbRun(form, async (v) => {
  if (!v.title) throw new Error('Nhập tên chủ đề.');
  const course = await dbEnsureCourse();
  await dbCall(EducMindDB.createTopic({ course_id: course.id, title: v.title, display_order: dbNextOrder(DB.data.topics || []) }));
}, 'Đã thêm chủ đề (bản nháp).');
DB_ACT.toggleTopic = (el) => dbRun(el, async () => {
  const t = DB.data.topics.find((x) => x.id === el.dataset.id);
  await dbCall(EducMindDB.updateTopic(t.id, { status: t.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }));
  toast(t.status === 'PUBLISHED' ? 'Đã gỡ xuất bản chủ đề.' : 'Đã xuất bản chủ đề.');
});
DB_ACT.editTopic = (el) => {
  const t = DB.data.topics.find((x) => x.id === el.dataset.id);
  dbOpenDialog({
    title: 'Sửa chủ đề', okLabel: 'Lưu thay đổi',
    body: dbField('Tên chủ đề', 'db-et-title', `<input id="db-et-title" name="title" maxlength="200" value="${h(t.title)}" required>`)
      + dbField('Mô tả', 'db-et-desc', `<textarea id="db-et-desc" name="description" rows="3" maxlength="1000">${h(t.description)}</textarea>`),
    onOk: async (v) => {
      if (!v.title) throw new Error('Nhập tên chủ đề.');
      await dbCall(EducMindDB.updateTopic(t.id, { title: v.title, description: v.description || '' }));
      toast('Đã lưu chủ đề.');
    },
  });
};
DB_ACT.deleteTopic = (el) => {
  const t = DB.data.topics.find((x) => x.id === el.dataset.id);
  if (DB.data.lessons.some((l) => l.topic_id === t.id)) return toast('Hãy xóa hoặc chuyển các bài học trong chủ đề này trước.');
  dbConfirm('Xóa chủ đề?', `Chủ đề “${h(t.title)}” sẽ bị ẩn khỏi lớp.`, 'Xóa chủ đề', async () => {
    await dbCall(EducMindDB.updateTopic(t.id, { deleted_at: new Date().toISOString() }));
    toast('Đã xóa chủ đề.');
  }, true);
};
DB_ACT.createLesson = (form) => dbRun(form, async (v) => {
  if (!v.title) throw new Error('Nhập tên bài học.');
  const course = await dbEnsureCourse(), topicId = form.dataset.topic;
  await dbCall(EducMindDB.createLesson({ course_id: course.id, topic_id: topicId, title: v.title, display_order: dbNextOrder(DB.data.lessons.filter((l) => l.topic_id === topicId)) }));
}, 'Đã thêm bài học (bản nháp).');
DB_ACT.toggleLesson = (el) => dbRun(el, async () => {
  const l = DB.data.lessons.find((x) => x.id === el.dataset.id);
  const topic = DB.data.topics.find((t) => t.id === l.topic_id);
  await dbCall(EducMindDB.updateLesson(l.id, { status: l.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED' }));
  toast(l.status === 'PUBLISHED' ? 'Đã gỡ xuất bản bài học.' : topic && topic.status !== 'PUBLISHED' ? 'Đã xuất bản bài học. Học sinh sẽ thấy bài khi chủ đề cũng được xuất bản.' : 'Đã xuất bản bài học.');
});
DB_ACT.editLesson = (el) => {
  const l = DB.data.lessons.find((x) => x.id === el.dataset.id);
  dbOpenDialog({
    title: 'Sửa bài học', okLabel: 'Lưu thay đổi',
    body: dbField('Tên bài học', 'db-el-title', `<input id="db-el-title" name="title" maxlength="200" value="${h(l.title)}" required>`)
      + dbField('Mô tả', 'db-el-desc', `<textarea id="db-el-desc" name="description" rows="3" maxlength="2000">${h(l.description)}</textarea>`)
      + dbField('Chủ đề', 'db-el-topic', `<select id="db-el-topic" name="topic_id">${DB.data.topics.map((t) => `<option value="${h(t.id)}" ${t.id === l.topic_id ? 'selected' : ''}>${h(t.title)}</option>`).join('')}</select>`),
    onOk: async (v) => {
      if (!v.title) throw new Error('Nhập tên bài học.');
      await dbCall(EducMindDB.updateLesson(l.id, { title: v.title, description: v.description || '', topic_id: v.topic_id }));
      toast('Đã lưu bài học.');
    },
  });
};
DB_ACT.deleteLesson = (el) => {
  const l = DB.data.lessons.find((x) => x.id === el.dataset.id);
  dbConfirm('Xóa bài học?', `Bài học “${h(l.title)}” sẽ bị ẩn khỏi lớp. Bài tập, bài kiểm tra và kết quả học tập đã có vẫn được giữ.`, 'Xóa bài học', async () => {
    await dbCall(EducMindDB.updateLesson(l.id, { deleted_at: new Date().toISOString() }));
    toast('Đã xóa bài học.');
  }, true);
};
function dbReadObjective(v) {
  if (!v.code) throw new Error('Nhập mã mục tiêu (ví dụ MT1).');
  if (!v.description) throw new Error('Nhập nội dung mục tiêu.');
  return { code: v.code, description: v.description };
}
DB_ACT.createObjective = (form) => dbRun(form, async (v) => {
  const o = dbReadObjective(v), lessonId = form.dataset.lesson;
  if (DB.data.objectives.some((x) => x.lesson_id === lessonId && x.code === o.code)) throw new Error('Mã ' + o.code + ' đã có trong bài học này.');
  await dbCall(EducMindDB.createObjective({ lesson_id: lessonId, ...o }));
}, 'Đã thêm mục tiêu.');
DB_ACT.editObjective = (el) => {
  const o = DB.data.objectives.find((x) => x.id === el.dataset.id);
  dbOpenDialog({
    title: 'Sửa mục tiêu', okLabel: 'Lưu thay đổi',
    body: dbField('Mã', 'db-eo-code', `<input id="db-eo-code" name="code" maxlength="20" value="${h(o.code)}" required>`)
      + dbField('Nội dung mục tiêu', 'db-eo-desc', `<textarea id="db-eo-desc" name="description" rows="3" maxlength="500" required>${h(o.description)}</textarea>`),
    onOk: async (v) => {
      const x = dbReadObjective(v);
      if (DB.data.objectives.some((y) => y.lesson_id === o.lesson_id && y.id !== o.id && y.code === x.code)) throw new Error('Mã ' + x.code + ' đã có trong bài học này.');
      await dbCall(EducMindDB.updateObjective(o.id, x));
      toast('Đã lưu mục tiêu.');
    },
  });
};
DB_ACT.deleteObjective = (el) => {
  const o = DB.data.objectives.find((x) => x.id === el.dataset.id);
  dbConfirm('Xóa mục tiêu?', `“${dbObjLabel(o)}”. Mục tiêu đã gắn với bài tập, câu hỏi hoặc đã có kết quả học tập thì không xóa được.`, 'Xóa mục tiêu', async () => {
    const r = await dbCall(EducMindDB.deleteObjective(o.id));
    if (!r.length) throw new Error('Không xóa được mục tiêu này.');
    toast('Đã xóa mục tiêu.');
  }, true);
};

/* ===== Học sinh: Bài học ===== */
DB_PAGES.lessons = {
  title: 'Bài học',
  sub: 'Các bài học giáo viên đã xuất bản, kèm mức nắm vững của em ở từng mục tiêu.',
  async load() {
    const content = await dbLoadContent();
    const mastery = await dbCallIn(EducMindDB.listMastery, content.objectives.map((o) => o.id));
    return { ...content, mastery: Object.fromEntries(mastery.map((m) => [m.objective_id, m])) };
  },
  view(d) {
    if (!d.topics.length) return `<section class="panel">${dbEmpty('Giáo viên chưa xuất bản bài học nào cho lớp này.')}</section>`;
    const lessonsBy = dbGroup(d.lessons, 'topic_id'), objBy = dbGroup(d.objectives, 'lesson_id');
    return d.topics.map((t) => `<section class="panel db-topic" aria-labelledby="db-st-${h(t.id)}">
      <h2 id="db-st-${h(t.id)}">${h(t.title)}</h2>${t.description ? `<p class="lead">${h(t.description)}</p>` : ''}
      ${(lessonsBy[t.id] || []).map((l) => `<div class="db-lesson" id="db-l-${h(l.id)}">
        <b>${h(l.title)}</b>${l.description ? `<div class="muted">${h(l.description)}</div>` : ''}
        ${(objBy[l.id] || []).length ? `<ul class="db-objectives">${objBy[l.id].map((o) => `<li><span class="db-obj-code">${h(o.code)}</span><span class="db-obj-text">${h(o.description)}</span><span>${dbMasteryPill(d.mastery[o.id] ? d.mastery[o.id].mastery_score : null)}</span></li>`).join('')}</ul>` : ''}
      </div>`).join('') || dbEmpty('Chủ đề chưa có bài học được xuất bản.')}
    </section>`).join('');
  },
};
